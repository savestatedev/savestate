/**
 * Tests for PII detection and redaction
 */

import { describe, it, expect } from 'vitest';
import { detectPII, redactPII, containsPII, summarizePII } from '../pii.js';

describe('PII Detection', () => {
  describe('detectPII', () => {
    it('detects email addresses', () => {
      const result = detectPII('Contact me at john.doe@example.com');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('email');
      expect(result.matches[0].confidence).toBeGreaterThan(0.9);
    });

    it('detects multiple emails', () => {
      const result = detectPII('Email alice@test.com or bob@test.org');
      expect(result.matchCount).toBe(2);
    });

    it('detects phone numbers', () => {
      const result = detectPII('Call me at 555-123-4567');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('phone');
    });

    it('detects SSNs', () => {
      const result = detectPII('SSN: 123-45-6789');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('ssn');
    });

    it('detects credit card numbers with Luhn validation', () => {
      // Valid Visa card (passes Luhn)
      const result = detectPII('Card: 4532015112830366');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('credit_card');
    });

    it('detects API keys', () => {
      // OpenAI API keys are sk- followed by 48 alphanumeric characters
      // Test with only api_key type to avoid password pattern matching "key:"
      const result = detectPII('OpenAI sk-abcdefghijklmnopqrstuvwxyz123456789012345678ABCD here', ['api_key']);
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('api_key');
    });

    it('detects AWS access keys', () => {
      const result = detectPII('AWS key: AKIAIOSFODNN7EXAMPLE');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('api_key');
    });

    it('detects password patterns', () => {
      const result = detectPII('Config: password=mySecretPass123');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('password');
    });

    it('detects IP addresses', () => {
      const result = detectPII('Server IP: 192.168.1.100');
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('ip_address');
    });

    it('returns empty for clean content', () => {
      const result = detectPII('Hello, this is a normal message with no PII.');
      expect(result.matchCount).toBe(0);
    });

    it('supports custom patterns', () => {
      const result = detectPII('Employee ID: EMP-12345', ['email'], [
        { name: 'employee_id', pattern: 'EMP-\\d{5}' },
      ]);
      expect(result.matchCount).toBe(1);
      expect(result.matches[0].type).toBe('custom');
    });

    it('handles overlapping matches by keeping higher confidence', () => {
      // Content with potential overlaps
      const result = detectPII('Contact: test@example.com or 555-555-5555');
      expect(result.matchCount).toBe(2); // Should not have duplicates
    });
  });

  describe('redactPII', () => {
    it('redacts with mask method (default)', () => {
      const result = redactPII('Email: test@example.com');
      expect(result.redacted).toBe('Email: [REDACTED:EMAIL]');
      expect(result.method).toBe('mask');
    });

    it('redacts with hash method', () => {
      const result = redactPII('Email: test@example.com', { method: 'hash' });
      expect(result.redacted).toMatch(/Email: \[HASH:[a-f0-9]+\]/);
    });

    it('redacts with tokenize method', () => {
      const result = redactPII('Email: test@example.com', { method: 'tokenize' });
      expect(result.redacted).toMatch(/Email: \[TOKEN:email:[a-f0-9]+\]/);
    });

    it('redacts with remove method', () => {
      const result = redactPII('Email: test@example.com', { method: 'remove' });
      expect(result.redacted).toBe('Email: ');
    });

    it('respects confidence threshold', () => {
      // Bank account numbers have low confidence without context
      const result = redactPII('Number: 12345678901234', {
        types: ['bank_account'],
        confidenceThreshold: 0.9,
      });
      // Should not redact due to missing banking context
      expect(result.redacted).toBe('Number: 12345678901234');
    });

    it('redacts multiple PII types', () => {
      const content = 'Email: a@b.com, Phone: 555-123-4567, SSN: 123-45-6789';
      const result = redactPII(content);
      expect(result.redacted).toContain('[REDACTED:EMAIL]');
      expect(result.redacted).toContain('[REDACTED:PHONE]');
      expect(result.redacted).toContain('[REDACTED:SSN]');
    });

    it('preserves non-PII content', () => {
      const result = redactPII('Hello World! Email: test@test.com. Goodbye!');
      expect(result.redacted).toBe('Hello World! Email: [REDACTED:EMAIL]. Goodbye!');
    });
  });

  describe('containsPII', () => {
    it('returns true when PII is present', () => {
      expect(containsPII('Contact: test@example.com')).toBe(true);
    });

    it('returns false when no PII is present', () => {
      expect(containsPII('Hello, world!')).toBe(false);
    });

    it('respects confidence threshold', () => {
      // Very high threshold should reduce matches
      expect(containsPII('Some text', ['email'], 0.99)).toBe(false);
    });
  });

  describe('summarizePII', () => {
    it('provides breakdown by type', () => {
      const content = 'Emails: a@b.com, c@d.com. Phone: 555-1234567';
      const summary = summarizePII(content);
      expect(summary.email).toBe(2);
      expect(summary.phone).toBe(1);
    });
  });
});
