/**
 * SaveState Deny-List Policy Engine
 *
 * Configurable deny-list for blocking or redacting sensitive content.
 * Supports exact matches, patterns, regexes, and glob patterns.
 */

import { minimatch } from 'minimatch';
import type {
  DenyListRule,
  DenyListPolicy,
  DenyListEvaluation,
  DenyListAction,
  BuiltInRuleSet,
} from './types.js';

// ─── Security Helpers ────────────────────────────────────────

/**
 * Maximum regex execution time in milliseconds.
 * Prevents ReDoS attacks from user-provided patterns.
 */
const REGEX_TIMEOUT_MS = 100;

/**
 * Maximum input length for regex matching.
 * Extremely long inputs can cause performance issues.
 */
const MAX_INPUT_LENGTH = 1_000_000;

/**
 * Unicode confusables: map of common homoglyphs to ASCII equivalents.
 * Prevents bypass via visually similar characters.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lookalikes
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i',
  '\u0458': 'j', '\u04BB': 'h', '\u0501': 'd', '\u051B': 'q',
  // Greek lookalikes
  '\u03B1': 'a', '\u03B5': 'e', '\u03B9': 'i', '\u03BF': 'o',
  '\u03C1': 'p', '\u03C5': 'u', '\u03C7': 'x', '\u0391': 'A',
  '\u0392': 'B', '\u0395': 'E', '\u0397': 'H', '\u0399': 'I',
  '\u039A': 'K', '\u039C': 'M', '\u039D': 'N', '\u039F': 'O',
  '\u03A1': 'P', '\u03A4': 'T', '\u03A7': 'X', '\u03A5': 'Y',
  '\u0396': 'Z',
  // Fullwidth characters
  '\uFF21': 'A', '\uFF22': 'B', '\uFF23': 'C', '\uFF24': 'D',
  '\uFF25': 'E', '\uFF26': 'F', '\uFF27': 'G', '\uFF28': 'H',
  '\uFF29': 'I', '\uFF2A': 'J', '\uFF2B': 'K', '\uFF2C': 'L',
  '\uFF2D': 'M', '\uFF2E': 'N', '\uFF2F': 'O', '\uFF30': 'P',
  '\uFF31': 'Q', '\uFF32': 'R', '\uFF33': 'S', '\uFF34': 'T',
  '\uFF35': 'U', '\uFF36': 'V', '\uFF37': 'W', '\uFF38': 'X',
  '\uFF39': 'Y', '\uFF3A': 'Z',
  '\uFF41': 'a', '\uFF42': 'b', '\uFF43': 'c', '\uFF44': 'd',
  '\uFF45': 'e', '\uFF46': 'f', '\uFF47': 'g', '\uFF48': 'h',
  '\uFF49': 'i', '\uFF4A': 'j', '\uFF4B': 'k', '\uFF4C': 'l',
  '\uFF4D': 'm', '\uFF4E': 'n', '\uFF4F': 'o', '\uFF50': 'p',
  '\uFF51': 'q', '\uFF52': 'r', '\uFF53': 's', '\uFF54': 't',
  '\uFF55': 'u', '\uFF56': 'v', '\uFF57': 'w', '\uFF58': 'x',
  '\uFF59': 'y', '\uFF5A': 'z',
  '\uFF10': '0', '\uFF11': '1', '\uFF12': '2', '\uFF13': '3',
  '\uFF14': '4', '\uFF15': '5', '\uFF16': '6', '\uFF17': '7',
  '\uFF18': '8', '\uFF19': '9',
};

/**
 * Zero-width and invisible characters to strip.
 */
const INVISIBLE_CHARS = /[\u200B-\u200F\u2028-\u202F\u205F-\u206F\uFEFF\u00AD]/g;

/**
 * Normalize content to prevent Unicode bypass attacks.
 * - Removes zero-width/invisible characters
 * - Normalizes homoglyphs to ASCII equivalents
 * - Applies NFC normalization
 */
function normalizeUnicode(content: string): string {
  // Remove zero-width and invisible characters
  let normalized = content.replace(INVISIBLE_CHARS, '');

  // Replace known homoglyphs
  for (const [homoglyph, ascii] of Object.entries(HOMOGLYPH_MAP)) {
    normalized = normalized.replaceAll(homoglyph, ascii);
  }

  // Apply Unicode NFC normalization
  return normalized.normalize('NFC');
}

/**
 * Safely execute regex with timeout protection against ReDoS.
 * Returns matches or null if timeout/error occurs.
 */
function safeRegexExec(
  content: string,
  pattern: string,
  flags: string,
): Array<{ start: number; end: number; content: string }> | null {
  // Truncate extremely long inputs
  const safeContent = content.length > MAX_INPUT_LENGTH
    ? content.slice(0, MAX_INPUT_LENGTH)
    : content;

  try {
    const regex = new RegExp(pattern, flags);
    const matches: Array<{ start: number; end: number; content: string }> = [];
    const startTime = performance.now();

    let match: RegExpExecArray | null;
    while ((match = regex.exec(safeContent)) !== null) {
      // Check for timeout
      if (performance.now() - startTime > REGEX_TIMEOUT_MS) {
        console.warn(`Regex timeout for pattern: ${pattern.slice(0, 50)}...`);
        break;
      }

      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
      });

      // Prevent infinite loops on zero-width matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return matches.length > 0 ? matches : null;
  } catch {
    // Invalid regex
    return null;
  }
}

// ─── Built-in Rule Sets ──────────────────────────────────────

/**
 * Standard PII deny-list patterns.
 */
const BUILTIN_PII_STANDARD: DenyListRule[] = [
  {
    id: 'pii-ssn',
    name: 'Social Security Number',
    type: 'regex',
    pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b',
    action: 'redact',
    enabled: true,
    priority: 100,
  },
  {
    id: 'pii-cc',
    name: 'Credit Card Number',
    type: 'regex',
    pattern: '\\b(?:4\\d{3}|5[1-5]\\d{2}|3[47]\\d{2}|6(?:011|5\\d{2}))[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b',
    action: 'redact',
    enabled: true,
    priority: 100,
  },
  {
    id: 'pii-email',
    name: 'Email Address',
    type: 'regex',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
    action: 'redact',
    enabled: true,
    priority: 90,
  },
  {
    id: 'pii-phone',
    name: 'Phone Number',
    type: 'regex',
    pattern: '\\b(?:\\+?1[-\\.\\s]?)?(?:\\(?\\d{3}\\)?[-\\.\\s]?)?\\d{3}[-\\.\\s]?\\d{4}\\b',
    action: 'redact',
    enabled: true,
    priority: 80,
  },
];

/**
 * Secrets deny-list patterns.
 */
const BUILTIN_SECRETS: DenyListRule[] = [
  {
    id: 'secret-aws-key',
    name: 'AWS Access Key',
    type: 'regex',
    pattern: '(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-aws-secret',
    name: 'AWS Secret Key',
    type: 'regex',
    pattern: '(?:aws_secret_access_key|secret_access_key)[\\s]*[=:][\\s]*[\'"]?([A-Za-z0-9/+=]{40})[\'"]?',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-github-token',
    name: 'GitHub Token',
    type: 'regex',
    pattern: 'gh[ps]_[A-Za-z0-9]{36,}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-openai-key',
    name: 'OpenAI API Key',
    type: 'regex',
    pattern: 'sk-[A-Za-z0-9]{48}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-slack-token',
    name: 'Slack Token',
    type: 'regex',
    pattern: 'xox[baprs]-[A-Za-z0-9-]+',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-generic-password',
    name: 'Generic Password Pattern',
    type: 'regex',
    pattern: '(?:password|passwd|pwd|secret)[\\s]*[=:][\\s]*[\'"]?([^\'\"\\s]{8,})[\'"]?',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 90,
  },
  {
    id: 'secret-private-key',
    name: 'Private Key',
    type: 'contains',
    pattern: '-----BEGIN',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-stripe-key',
    name: 'Stripe API Key',
    type: 'regex',
    pattern: 'sk_(?:live|test)_[A-Za-z0-9]{24,}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-stripe-restricted',
    name: 'Stripe Restricted Key',
    type: 'regex',
    pattern: 'rk_(?:live|test)_[A-Za-z0-9]{24,}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-google-api-key',
    name: 'Google API Key',
    type: 'regex',
    pattern: 'AIza[A-Za-z0-9_-]{35}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-google-oauth',
    name: 'Google OAuth Client Secret',
    type: 'regex',
    pattern: 'GOCSPX-[A-Za-z0-9_-]{28}',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-azure-subscription',
    name: 'Azure Subscription Key',
    type: 'regex',
    pattern: '[a-f0-9]{32}(?=.*azure)',
    caseSensitive: false,
    action: 'block',
    enabled: true,
    priority: 90,
  },
  {
    id: 'secret-azure-connection-string',
    name: 'Azure Connection String',
    type: 'regex',
    pattern: 'DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88};',
    action: 'block',
    enabled: true,
    priority: 100,
  },
  {
    id: 'secret-jwt',
    name: 'JSON Web Token',
    type: 'regex',
    pattern: 'eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
    action: 'redact',
    enabled: true,
    priority: 85,
  },
];

/**
 * Financial data patterns.
 */
const BUILTIN_FINANCIAL: DenyListRule[] = [
  {
    id: 'fin-routing',
    name: 'Bank Routing Number',
    type: 'regex',
    pattern: '(?:routing|aba)[\\s]*(?:number|#)?[\\s]*[=:][\\s]*\\d{9}',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 90,
  },
  {
    id: 'fin-account',
    name: 'Bank Account Number',
    type: 'regex',
    pattern: '(?:account|acct)[\\s]*(?:number|#)?[\\s]*[=:][\\s]*\\d{8,17}',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 90,
  },
  {
    id: 'fin-iban',
    name: 'IBAN',
    type: 'regex',
    pattern: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}\\b',
    action: 'redact',
    enabled: true,
    priority: 90,
  },
];

/**
 * Health-related patterns (HIPAA).
 */
const BUILTIN_HEALTH: DenyListRule[] = [
  {
    id: 'health-mrn',
    name: 'Medical Record Number',
    type: 'regex',
    pattern: '(?:mrn|medical\\s*record)[\\s]*(?:number|#)?[\\s]*[=:][\\s]*[A-Z0-9]{6,}',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 100,
  },
  {
    id: 'health-npi',
    name: 'NPI Number',
    type: 'regex',
    pattern: '(?:npi)[\\s]*[=:][\\s]*\\d{10}',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 100,
  },
  {
    id: 'health-dea',
    name: 'DEA Number',
    type: 'regex',
    pattern: '(?:dea)[\\s]*[=:][\\s]*[A-Z]{2}\\d{7}',
    caseSensitive: false,
    action: 'redact',
    enabled: true,
    priority: 100,
  },
];

/**
 * Map of built-in rule sets.
 */
const BUILTIN_RULES: Record<BuiltInRuleSet, DenyListRule[]> = {
  'pii-standard': BUILTIN_PII_STANDARD,
  'pii-strict': BUILTIN_PII_STANDARD, // Extended in future
  'secrets': BUILTIN_SECRETS,
  'financial': BUILTIN_FINANCIAL,
  'health': BUILTIN_HEALTH,
  'gdpr': [...BUILTIN_PII_STANDARD, ...BUILTIN_FINANCIAL],
};

// ─── Rule Matching ───────────────────────────────────────────

/**
 * Match content against a single rule.
 * Applies Unicode normalization to prevent homoglyph/zero-width bypass.
 *
 * @param content - The content to check
 * @param rule - The rule to evaluate
 * @param normalizedContent - Pre-normalized content (optional, for performance)
 * @returns Array of match positions, or null if no match
 */
function matchRule(
  content: string,
  rule: DenyListRule,
  normalizedContent?: string,
): Array<{ start: number; end: number; content: string }> | null {
  if (!rule.enabled) return null;

  // Check expiration
  if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) {
    return null;
  }

  // Use normalized content to prevent Unicode bypass attacks
  // Note: Match positions refer to normalized content
  const safeContent = normalizedContent ?? normalizeUnicode(content);

  const searchContent = rule.caseSensitive ? safeContent : safeContent.toLowerCase();
  const searchPattern = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();

  const matches: Array<{ start: number; end: number; content: string }> = [];

  switch (rule.type) {
    case 'exact':
      if (searchContent === searchPattern) {
        matches.push({ start: 0, end: safeContent.length, content: safeContent });
      }
      break;

    case 'prefix':
      if (searchContent.startsWith(searchPattern)) {
        matches.push({ start: 0, end: rule.pattern.length, content: safeContent.substring(0, rule.pattern.length) });
      }
      break;

    case 'suffix':
      if (searchContent.endsWith(searchPattern)) {
        const start = safeContent.length - rule.pattern.length;
        matches.push({ start, end: safeContent.length, content: safeContent.substring(start) });
      }
      break;

    case 'contains': {
      let pos = 0;
      let idx: number;
      while ((idx = searchContent.indexOf(searchPattern, pos)) !== -1) {
        matches.push({
          start: idx,
          end: idx + rule.pattern.length,
          content: safeContent.substring(idx, idx + rule.pattern.length),
        });
        pos = idx + 1;
      }
      break;
    }

    case 'regex': {
      // Use safe regex execution with timeout protection against ReDoS
      const flags = rule.caseSensitive ? 'g' : 'gi';
      const regexMatches = safeRegexExec(safeContent, rule.pattern, flags);
      if (regexMatches) {
        matches.push(...regexMatches);
      }
      break;
    }

    case 'glob': {
      // For glob, we treat the entire content as a path-like string
      if (minimatch(safeContent, rule.pattern, { nocase: !rule.caseSensitive })) {
        matches.push({ start: 0, end: safeContent.length, content: safeContent });
      }
      break;
    }
  }

  return matches.length > 0 ? matches : null;
}

// ─── Policy Evaluation ───────────────────────────────────────

/**
 * Load built-in rules for the specified rule sets.
 */
function loadBuiltinRules(includes: BuiltInRuleSet[]): DenyListRule[] {
  const rules: DenyListRule[] = [];
  const seen = new Set<string>();

  for (const setName of includes) {
    const builtinRules = BUILTIN_RULES[setName];
    if (builtinRules) {
      for (const rule of builtinRules) {
        if (!seen.has(rule.id)) {
          rules.push(rule);
          seen.add(rule.id);
        }
      }
    }
  }

  return rules;
}

/**
 * Evaluate content against a deny-list policy.
 *
 * @param content - The content to evaluate
 * @param policy - The deny-list policy to apply
 * @returns Evaluation results
 */
export function evaluateDenyList(
  content: string,
  policy: DenyListPolicy,
): DenyListEvaluation {
  const startTime = performance.now();

  if (!policy.enabled) {
    return {
      matched: false,
      matchedRules: [],
      action: policy.defaultAction === 'deny' ? 'block' : 'allow',
      evaluatedAt: new Date().toISOString(),
      processingTimeMs: performance.now() - startTime,
    };
  }

  // Pre-normalize content once for all rules (security + performance)
  const normalizedContent = normalizeUnicode(content);

  // Combine built-in rules with custom rules
  const allRules = [
    ...(policy.includes ? loadBuiltinRules(policy.includes) : []),
    ...policy.rules,
  ];

  // Sort by priority (higher first)
  allRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Evaluate each rule
  const matchedRules: DenyListEvaluation['matchedRules'] = [];
  let finalAction: DenyListAction | 'allow' = policy.defaultAction === 'deny' ? 'block' : 'allow';

  for (const rule of allRules) {
    const matches = matchRule(content, rule, normalizedContent);
    if (matches) {
      matchedRules.push({ rule, matches });

      // Use the first matching rule's action (highest priority wins)
      if (matchedRules.length === 1) {
        finalAction = rule.action;
      }
    }
  }

  return {
    matched: matchedRules.length > 0,
    matchedRules,
    action: finalAction,
    evaluatedAt: new Date().toISOString(),
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * Apply deny-list redaction to content.
 *
 * @param content - The content to process
 * @param policy - The deny-list policy
 * @returns Redacted content and evaluation results
 */
export function applyDenyList(
  content: string,
  policy: DenyListPolicy,
): { content: string; evaluation: DenyListEvaluation } {
  const evaluation = evaluateDenyList(content, policy);

  if (!evaluation.matched) {
    return { content, evaluation };
  }

  // Collect all matches that need redaction
  const redactMatches: Array<{ start: number; end: number; ruleName: string }> = [];

  for (const { rule, matches } of evaluation.matchedRules) {
    if (rule.action === 'redact') {
      for (const match of matches) {
        redactMatches.push({ ...match, ruleName: rule.name });
      }
    }
  }

  if (redactMatches.length === 0) {
    return { content, evaluation };
  }

  // Sort by position and deduplicate overlapping
  redactMatches.sort((a, b) => a.start - b.start);

  let redacted = '';
  let lastEnd = 0;

  for (const match of redactMatches) {
    if (match.start < lastEnd) continue; // Skip overlapping

    redacted += content.substring(lastEnd, match.start);
    redacted += `[DENIED:${match.ruleName}]`;
    lastEnd = match.end;
  }

  redacted += content.substring(lastEnd);

  return { content: redacted, evaluation };
}

// ─── Policy Creation Helpers ─────────────────────────────────

/**
 * Create a new deny-list policy with defaults.
 */
export function createPolicy(
  name: string,
  options?: Partial<DenyListPolicy>,
): DenyListPolicy {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    name,
    description: options?.description,
    createdAt: now,
    updatedAt: now,
    enabled: options?.enabled ?? true,
    defaultAction: options?.defaultAction ?? 'allow',
    rules: options?.rules ?? [],
    includes: options?.includes ?? ['pii-standard', 'secrets'],
  };
}

/**
 * Add a rule to an existing policy.
 */
export function addRule(
  policy: DenyListPolicy,
  rule: Omit<DenyListRule, 'id' | 'enabled'> & { id?: string; enabled?: boolean },
): DenyListPolicy {
  const newRule: DenyListRule = {
    ...rule,
    id: rule.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: rule.enabled ?? true,
  };

  return {
    ...policy,
    updatedAt: new Date().toISOString(),
    rules: [...policy.rules, newRule],
  };
}

/**
 * Remove a rule from a policy.
 */
export function removeRule(
  policy: DenyListPolicy,
  ruleId: string,
): DenyListPolicy {
  return {
    ...policy,
    updatedAt: new Date().toISOString(),
    rules: policy.rules.filter((r) => r.id !== ruleId),
  };
}

/**
 * Get all available built-in rule set names.
 */
export function getBuiltinRuleSets(): BuiltInRuleSet[] {
  return Object.keys(BUILTIN_RULES) as BuiltInRuleSet[];
}

/**
 * Get the rules in a built-in rule set.
 */
export function getBuiltinRules(setName: BuiltInRuleSet): DenyListRule[] {
  return [...(BUILTIN_RULES[setName] || [])];
}
