/**
 * SaveState PII Detection and Redaction
 *
 * Deterministic PII detection using pattern matching.
 * Supports standard PII types with configurable redaction methods.
 */

import { createHash } from 'node:crypto';
import type {
  PIIType,
  PIIMatch,
  PIIDetectionResult,
  PIIRedactionResult,
  RedactionMethod,
} from './types.js';

// ─── PII Patterns ────────────────────────────────────────────

/**
 * Compiled regex patterns for PII detection.
 * Each pattern is designed to minimize false positives while catching common formats.
 */
const PII_PATTERNS: Record<PIIType, RegExp | null> = {
  // Email: standard email format
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone: US/international formats
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // SSN: XXX-XX-XXXX format (with or without dashes)
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // Credit Card: Major card formats (Visa, MC, Amex, Discover)
  credit_card: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

  // IP Address: IPv4 format
  ip_address: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,

  // Date of Birth: Common date formats (MM/DD/YYYY, DD-MM-YYYY, etc.)
  date_of_birth: /\b(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}\b/g,

  // Address: Street address patterns (partial, context-dependent)
  address: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?\b/gi,

  // Name: Not pattern-matched (requires NLP), handled separately
  name: null,

  // Passport: US passport format
  passport: /\b[A-Z]\d{8}\b/g,

  // Driver License: Varies by state, common formats
  driver_license: /\b[A-Z]{1,2}\d{6,8}\b/g,

  // Bank Account: 8-17 digit numbers (context-dependent)
  bank_account: /\b\d{8,17}\b/g,

  // API Key: Common API key patterns (AWS, GitHub, etc.)
  api_key: /\b(?:(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{48}|xox[baprs]-[A-Za-z0-9-]+)\b/g,

  // Password: Patterns like password=, pwd:, etc.
  password: /(?:password|passwd|pwd|secret|token|key)[\s]*[=:]\s*['"]?([^'"\s]+)['"]?/gi,

  // Custom: Handled separately
  custom: null,
};

/**
 * Confidence scores for each PII type based on pattern reliability.
 */
const PII_CONFIDENCE: Record<PIIType, number> = {
  email: 0.95,
  phone: 0.85,
  ssn: 0.90,
  credit_card: 0.95,
  ip_address: 0.90,
  date_of_birth: 0.70,
  address: 0.75,
  name: 0.60,
  passport: 0.85,
  driver_license: 0.70,
  bank_account: 0.50, // High false positive rate
  api_key: 0.98,
  password: 0.90,
  custom: 0.80,
};

// ─── Luhn Algorithm for Credit Card Validation ───────────────

/**
 * Validate credit card number using Luhn algorithm.
 */
function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// ─── Hash Functions ──────────────────────────────────────────

/**
 * Create a deterministic hash of content for attestation.
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ─── PII Detection ───────────────────────────────────────────

/**
 * Detect PII in content using configured patterns.
 *
 * @param content - The text to scan for PII
 * @param types - PII types to detect (defaults to all)
 * @param customPatterns - Additional custom patterns to match
 * @returns Detection results with all matches
 */
export function detectPII(
  content: string,
  types: PIIType[] = Object.keys(PII_PATTERNS) as PIIType[],
  customPatterns?: Array<{ name: string; pattern: string; flags?: string }>,
): PIIDetectionResult {
  const startTime = performance.now();
  const matches: PIIMatch[] = [];

  for (const type of types) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    // Clone the regex to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const matchedText = match[0];
      let confidence = PII_CONFIDENCE[type];

      // Additional validation for specific types
      if (type === 'credit_card') {
        if (!luhnCheck(matchedText)) {
          confidence *= 0.5; // Lower confidence if Luhn fails
        }
      }

      if (type === 'bank_account') {
        // Only flag if preceded by context words
        const prefix = content.substring(Math.max(0, match.index - 30), match.index);
        if (!/(?:account|acct|routing|aba|swift)/i.test(prefix)) {
          continue; // Skip if no banking context
        }
      }

      matches.push({
        type,
        start: match.index,
        end: match.index + matchedText.length,
        originalHash: hashContent(matchedText),
        confidence,
      });
    }
  }

  // Handle custom patterns
  if (customPatterns) {
    for (const custom of customPatterns) {
      try {
        const regex = new RegExp(custom.pattern, custom.flags || 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          matches.push({
            type: 'custom',
            start: match.index,
            end: match.index + match[0].length,
            originalHash: hashContent(match[0]),
            confidence: PII_CONFIDENCE.custom,
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  // Sort matches by start position and remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const dedupedMatches = deduplicateMatches(matches);

  return {
    originalLength: content.length,
    matchCount: dedupedMatches.length,
    matches: dedupedMatches,
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * Remove overlapping matches, keeping the one with higher confidence.
 */
function deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
  if (matches.length === 0) return matches;

  const result: PIIMatch[] = [matches[0]];

  for (let i = 1; i < matches.length; i++) {
    const current = matches[i];
    const last = result[result.length - 1];

    // Check for overlap
    if (current.start < last.end) {
      // Keep the one with higher confidence
      if (current.confidence > last.confidence) {
        result[result.length - 1] = current;
      }
      // Otherwise keep the existing one
    } else {
      result.push(current);
    }
  }

  return result;
}

// ─── PII Redaction ───────────────────────────────────────────

/**
 * Redaction placeholder generators.
 */
const REDACTION_PLACEHOLDERS: Record<PIIType, string> = {
  email: '[REDACTED:EMAIL]',
  phone: '[REDACTED:PHONE]',
  ssn: '[REDACTED:SSN]',
  credit_card: '[REDACTED:CARD]',
  ip_address: '[REDACTED:IP]',
  date_of_birth: '[REDACTED:DOB]',
  address: '[REDACTED:ADDRESS]',
  name: '[REDACTED:NAME]',
  passport: '[REDACTED:PASSPORT]',
  driver_license: '[REDACTED:LICENSE]',
  bank_account: '[REDACTED:ACCOUNT]',
  api_key: '[REDACTED:API_KEY]',
  password: '[REDACTED:SECRET]',
  custom: '[REDACTED]',
};

/**
 * Redact PII from content using the specified method.
 *
 * @param content - The text to redact
 * @param options - Redaction options
 * @returns Redacted content and detection results
 */
export function redactPII(
  content: string,
  options: {
    types?: PIIType[];
    method?: RedactionMethod;
    confidenceThreshold?: number;
    customPatterns?: Array<{ name: string; pattern: string; flags?: string }>;
  } = {},
): PIIRedactionResult {
  const {
    types = Object.keys(PII_PATTERNS) as PIIType[],
    method = 'mask',
    confidenceThreshold = 0.7,
    customPatterns,
  } = options;

  const detection = detectPII(content, types, customPatterns);

  // Filter by confidence threshold
  const relevantMatches = detection.matches.filter(
    (m) => m.confidence >= confidenceThreshold,
  );

  if (relevantMatches.length === 0) {
    return {
      redacted: content,
      detection,
      method,
    };
  }

  // Build redacted string
  let redacted = '';
  let lastEnd = 0;

  for (const match of relevantMatches) {
    // Add content before this match
    redacted += content.substring(lastEnd, match.start);

    // Add redaction based on method
    switch (method) {
      case 'mask':
        redacted += REDACTION_PLACEHOLDERS[match.type];
        break;

      case 'hash':
        redacted += `[HASH:${match.originalHash}]`;
        break;

      case 'tokenize':
        // Tokenize uses the hash but with a marker for reversibility
        redacted += `[TOKEN:${match.type}:${match.originalHash}]`;
        break;

      case 'remove':
        // Add nothing
        break;
    }

    lastEnd = match.end;
  }

  // Add remaining content
  redacted += content.substring(lastEnd);

  // Update match count for filtered results
  const filteredDetection = {
    ...detection,
    matchCount: relevantMatches.length,
    matches: relevantMatches,
  };

  return {
    redacted,
    detection: filteredDetection,
    method,
  };
}

/**
 * Check if content contains PII without full redaction.
 *
 * @param content - The text to check
 * @param types - PII types to check for
 * @param confidenceThreshold - Minimum confidence to consider a match
 * @returns True if PII is detected
 */
export function containsPII(
  content: string,
  types?: PIIType[],
  confidenceThreshold = 0.7,
): boolean {
  const detection = detectPII(content, types);
  return detection.matches.some((m) => m.confidence >= confidenceThreshold);
}

/**
 * Get a summary of PII found in content.
 */
export function summarizePII(
  content: string,
  types?: PIIType[],
): Record<PIIType, number> {
  const detection = detectPII(content, types);
  const summary: Partial<Record<PIIType, number>> = {};

  for (const match of detection.matches) {
    summary[match.type] = (summary[match.type] || 0) + 1;
  }

  return summary as Record<PIIType, number>;
}
