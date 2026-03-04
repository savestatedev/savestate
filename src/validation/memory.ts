import { z } from 'zod';

export type MemorySourceType =
  | 'user_input'
  | 'tool_output'
  | 'web_scrape'
  | 'system'
  | 'agent_inference'
  | 'external';

export type CanonicalMemorySourceType =
  | 'user_input'
  | 'tool_output'
  | 'web_scrape'
  | 'system';

export type MemoryContentFormat = 'text' | 'json' | 'html' | 'markdown';

export interface MemoryValidationConfig {
  maxEntryLength: number;
  quarantineThreshold: number;
  maxJsonDepth: number;
  maxJsonNodes: number;
  maxJsonKeys: number;
  maxJsonArrayItems: number;
  maxJsonStringLength: number;
}

export interface MemoryValidationInput {
  content: string;
  sourceType: MemorySourceType;
  sourceId: string;
  declaredContentType?: string;
}

export interface MemoryValidationResult {
  accepted: boolean;
  quarantined: boolean;
  sourceType: CanonicalMemorySourceType;
  sourceId: string;
  normalizedContent: string;
  normalizedContentType: 'text' | 'json' | 'markdown';
  detectedFormat: MemoryContentFormat;
  confidenceScore: number;
  anomalyFlags: string[];
  validationNotes: string[];
  rejectionReason?: string;
}

export const DEFAULT_MEMORY_VALIDATION_CONFIG: MemoryValidationConfig = {
  maxEntryLength: 16_000,
  quarantineThreshold: 0.45,
  maxJsonDepth: 12,
  maxJsonNodes: 5_000,
  maxJsonKeys: 1_000,
  maxJsonArrayItems: 2_000,
  maxJsonStringLength: 4_000,
};

const CONTROL_CHARACTER_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const REPLACEMENT_CHARACTER_PATTERN = /\uFFFD/;
const BASE64_BLOB_PATTERN = /\b(?:[A-Za-z0-9+/]{80,}={0,2})\b/;
const LONG_REPEAT_PATTERN = /(.)\1{15,}/;
const URL_PATTERN = /https?:\/\/\S+/gi;
const MARKDOWN_HINT_PATTERN =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>|\|.+\|)|```|\[[^\]]+\]\([^)]+\)/m;
const HTML_PATTERN =
  /<(?:!doctype|html|head|body|div|span|p|a|ul|ol|li|table|script|style)\b[^>]*>/i;

const structuredJsonSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function canonicalizeSourceType(sourceType: MemorySourceType): CanonicalMemorySourceType {
  switch (sourceType) {
    case 'user_input':
      return 'user_input';
    case 'tool_output':
      return 'tool_output';
    case 'web_scrape':
    case 'external':
      return 'web_scrape';
    case 'agent_inference':
    case 'system':
    default:
      return 'system';
  }
}

export function detectContentFormat(
  content: string,
  declaredContentType?: string
): MemoryContentFormat {
  const declared = declaredContentType?.toLowerCase().trim();
  if (declared) {
    if (declared.includes('json')) return 'json';
    if (declared.includes('html')) return 'html';
    if (declared.includes('markdown') || declared === 'md') return 'markdown';
    if (declared === 'text') return 'text';
  }

  const trimmed = content.trim();
  if (!trimmed) return 'text';

  const startsLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (startsLikeJson) {
    return 'json';
  }

  if (HTML_PATTERN.test(trimmed)) {
    return 'html';
  }

  if (MARKDOWN_HINT_PATTERN.test(trimmed)) {
    return 'markdown';
  }

  return 'text';
}

function decodeHtmlEntities(content: string): string {
  return content
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
}

function sanitizeHtmlToText(content: string): string {
  const withoutScripts = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const text = withoutScripts.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

function normalizeMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasEncodingArtifacts(content: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(content) || REPLACEMENT_CHARACTER_PATTERN.test(content);
}

interface JsonWalkState {
  nodes: number;
  keys: number;
}

function validateStructuredJson(
  payload: unknown,
  config: MemoryValidationConfig
): string | null {
  const rootResult = structuredJsonSchema.safeParse(payload);
  if (!rootResult.success) {
    return 'Structured tool output must be a JSON object or array';
  }

  const state: JsonWalkState = { nodes: 0, keys: 0 };

  const walk = (value: unknown, depth: number): string | null => {
    if (depth > config.maxJsonDepth) {
      return `JSON depth exceeds limit (${config.maxJsonDepth})`;
    }

    state.nodes += 1;
    if (state.nodes > config.maxJsonNodes) {
      return `JSON node count exceeds limit (${config.maxJsonNodes})`;
    }

    if (Array.isArray(value)) {
      if (value.length > config.maxJsonArrayItems) {
        return `JSON array size exceeds limit (${config.maxJsonArrayItems})`;
      }
      for (const item of value) {
        const issue = walk(item, depth + 1);
        if (issue) return issue;
      }
      return null;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      state.keys += entries.length;
      if (state.keys > config.maxJsonKeys) {
        return `JSON key count exceeds limit (${config.maxJsonKeys})`;
      }

      for (const [key, next] of entries) {
        if (!key.trim()) return 'JSON contains an empty key';
        if (key.length > 256) return 'JSON contains an oversized key';
        if (hasEncodingArtifacts(key)) return 'JSON key contains encoding artifacts';
        const issue = walk(next, depth + 1);
        if (issue) return issue;
      }
      return null;
    }

    if (typeof value === 'string' && value.length > config.maxJsonStringLength) {
      return `JSON string field exceeds limit (${config.maxJsonStringLength})`;
    }

    return null;
  };

  return walk(payload, 1);
}

function getAnomalyFlags(content: string): string[] {
  const flags = new Set<string>();

  if (BASE64_BLOB_PATTERN.test(content)) {
    flags.add('base64_blob');
  }

  if (LONG_REPEAT_PATTERN.test(content)) {
    flags.add('repeated_characters');
  }

  const urlCount = (content.match(URL_PATTERN) ?? []).length;
  if (urlCount >= 8) {
    flags.add('url_spam_pattern');
  }

  const tokens = content
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

  if (tokens.length >= 12) {
    const counts = new Map<string, number>();
    let maxCount = 0;
    for (const token of tokens) {
      const next = (counts.get(token) ?? 0) + 1;
      counts.set(token, next);
      if (next > maxCount) maxCount = next;
    }
    if (maxCount / tokens.length >= 0.35) {
      flags.add('repeated_tokens');
    }
  }

  return Array.from(flags);
}

function scoreLengthComplexity(content: string): {
  complexityScore: number;
  lengthComplexityPenalty: number;
} {
  const tokens = content
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { complexityScore: 0, lengthComplexityPenalty: 0.3 };
  }

  const uniqueCount = new Set(tokens).size;
  const uniqueRatio = uniqueCount / tokens.length;
  const punctuationRatio =
    (content.match(/[.,;:!?()[\]{}]/g) ?? []).length / Math.max(1, content.length);
  const normalizedLength = Math.min(1, Math.log10(content.length + 10) / 4);

  let complexityScore =
    uniqueRatio * 0.65 + normalizedLength * 0.25 + Math.min(1, punctuationRatio * 20) * 0.1;
  if (tokens.length < 5) complexityScore -= 0.1;
  complexityScore = clamp(complexityScore);

  const lengthComplexityRatio = content.length / Math.max(1, uniqueCount * 12);
  let lengthComplexityPenalty = 0;
  if (lengthComplexityRatio > 1.5) {
    lengthComplexityPenalty = clamp((lengthComplexityRatio - 1.5) / 4.5, 0, 1) * 0.3;
  }

  return { complexityScore, lengthComplexityPenalty };
}

function sourceTrustScore(sourceType: CanonicalMemorySourceType): number {
  switch (sourceType) {
    case 'user_input':
      return 0.95;
    case 'system':
      return 0.85;
    case 'tool_output':
      return 0.72;
    case 'web_scrape':
      return 0.58;
  }
}

export function computeConfidenceScore(
  sourceType: CanonicalMemorySourceType,
  content: string
): {
  confidenceScore: number;
  anomalyFlags: string[];
} {
  const anomalyFlags = getAnomalyFlags(content);
  const { complexityScore, lengthComplexityPenalty } = scoreLengthComplexity(content);

  const penalties: Record<string, number> = {
    base64_blob: 0.35,
    repeated_characters: 0.2,
    repeated_tokens: 0.2,
    url_spam_pattern: 0.15,
  };

  let anomalyPenalty = 0;
  for (const flag of anomalyFlags) {
    anomalyPenalty += penalties[flag] ?? 0;
  }

  const trust = sourceTrustScore(sourceType);
  const confidenceScore = clamp(trust * 0.6 + complexityScore * 0.4 - anomalyPenalty - lengthComplexityPenalty);

  return {
    confidenceScore,
    anomalyFlags,
  };
}

function rejectionResult(
  input: MemoryValidationInput,
  reason: string
): MemoryValidationResult {
  return {
    accepted: false,
    quarantined: false,
    sourceType: canonicalizeSourceType(input.sourceType),
    sourceId: input.sourceId,
    normalizedContent: '',
    normalizedContentType: 'text',
    detectedFormat: 'text',
    confidenceScore: 0,
    anomalyFlags: [],
    validationNotes: [],
    rejectionReason: reason,
  };
}

export function validateMemoryEntry(
  input: MemoryValidationInput,
  config: MemoryValidationConfig = DEFAULT_MEMORY_VALIDATION_CONFIG
): MemoryValidationResult {
  if (typeof input.content !== 'string') {
    return rejectionResult(input, 'Memory content must be a string');
  }

  const sourceType = canonicalizeSourceType(input.sourceType);
  const validationNotes: string[] = [];

  let content = input.content.replace(/\r\n/g, '\n');
  if (!content.trim()) {
    return rejectionResult(input, 'Memory content is empty');
  }

  if (hasEncodingArtifacts(content)) {
    return rejectionResult(input, 'Memory content contains encoding artifacts');
  }

  const detectedFormat = detectContentFormat(content, input.declaredContentType);
  let normalizedContentType: 'text' | 'json' | 'markdown' = 'text';

  if (detectedFormat === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return rejectionResult(input, 'Invalid JSON payload');
    }

    if (sourceType === 'tool_output' || sourceType === 'web_scrape') {
      const issue = validateStructuredJson(parsed, config);
      if (issue) {
        return rejectionResult(input, issue);
      }
      validationNotes.push('Structured output schema validated');
    }

    content = JSON.stringify(parsed);
    normalizedContentType = 'json';
  } else if (detectedFormat === 'html') {
    content = sanitizeHtmlToText(content);
    normalizedContentType = 'text';
    validationNotes.push('HTML sanitized to plain text');
  } else if (detectedFormat === 'markdown') {
    content = normalizeMarkdown(content);
    normalizedContentType = 'markdown';
    validationNotes.push('Markdown normalized');
  } else {
    content = content.trim();
    normalizedContentType = 'text';
  }

  if (!content.trim()) {
    return rejectionResult(input, 'Memory content is empty after normalization');
  }

  if (hasEncodingArtifacts(content)) {
    return rejectionResult(input, 'Memory content contains encoding artifacts after normalization');
  }

  if (content.length > config.maxEntryLength) {
    if (normalizedContentType === 'json') {
      return rejectionResult(input, `JSON memory exceeds max length (${config.maxEntryLength})`);
    }
    content = content.slice(0, config.maxEntryLength);
    validationNotes.push(`Content truncated to ${config.maxEntryLength} chars`);
  }

  const { confidenceScore, anomalyFlags } = computeConfidenceScore(sourceType, content);
  const quarantined = confidenceScore < config.quarantineThreshold;

  return {
    accepted: true,
    quarantined,
    sourceType,
    sourceId: input.sourceId,
    normalizedContent: content,
    normalizedContentType,
    detectedFormat,
    confidenceScore,
    anomalyFlags,
    validationNotes,
  };
}
