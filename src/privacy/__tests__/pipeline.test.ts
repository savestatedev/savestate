/**
 * Tests for privacy pipeline integration
 */

import { describe, it, expect } from 'vitest';
import {
  applyPrivacyPipeline,
  validatePrivacy,
  defaultPrivacyConfig,
} from '../index.js';

describe('Privacy Pipeline', () => {
  describe('defaultPrivacyConfig', () => {
    it('returns valid default configuration', () => {
      const config = defaultPrivacyConfig();

      expect(config.version).toBe('1.0.0');
      expect(config.enabled).toBe(true);
      expect(config.pii.enabled).toBe(true);
      expect(config.pii.types).toContain('email');
      expect(config.pii.types).toContain('api_key');
      expect(config.denyList.enabled).toBe(true);
      expect(config.attestations.enabled).toBe(true);
    });
  });

  describe('applyPrivacyPipeline', () => {
    it('returns unmodified content when disabled', () => {
      const config = defaultPrivacyConfig();
      config.enabled = false;

      const result = applyPrivacyPipeline(
        'Email: test@example.com',
        'snapshot-1',
        config,
      );

      expect(result.content).toBe('Email: test@example.com');
      expect(result.modified).toBe(false);
      expect(result.attestations).toHaveLength(0);
    });

    it('redacts PII and creates attestation', () => {
      const config = defaultPrivacyConfig();

      const result = applyPrivacyPipeline(
        'Contact: john@example.com, SSN: 123-45-6789',
        'snapshot-1',
        config,
      );

      expect(result.modified).toBe(true);
      expect(result.content).toContain('[REDACTED:EMAIL]');
      expect(result.content).toContain('[REDACTED:SSN]');
      expect(result.pii?.detection.matchCount).toBe(2);
      expect(result.attestations.length).toBeGreaterThan(0);
      expect(result.attestations[0].type).toBe('redaction');
    });

    it('blocks content matching deny-list', () => {
      const config = defaultPrivacyConfig();
      // AWS key pattern triggers block action

      const result = applyPrivacyPipeline(
        'AWS Key: AKIAIOSFODNN7EXAMPLE',
        'snapshot-1',
        config,
      );

      expect(result.modified).toBe(true);
      expect(result.content).toBe('[BLOCKED BY POLICY]');
      expect(result.denyList?.matched).toBe(true);
      expect(result.denyList?.action).toBe('block');
    });

    it('applies both PII and deny-list in sequence', () => {
      const config = defaultPrivacyConfig();

      const result = applyPrivacyPipeline(
        'Email: a@b.com, Password: password=secret123',
        'snapshot-1',
        config,
      );

      expect(result.modified).toBe(true);
      // PII redaction runs first
      expect(result.content).toContain('[REDACTED:');
    });

    it('measures processing time', () => {
      const config = defaultPrivacyConfig();

      const result = applyPrivacyPipeline(
        'Some content',
        'snapshot-1',
        config,
      );

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('skips attestations when disabled', () => {
      const config = defaultPrivacyConfig();
      config.attestations.enabled = false;

      const result = applyPrivacyPipeline(
        'Email: test@example.com',
        'snapshot-1',
        config,
      );

      expect(result.modified).toBe(true);
      expect(result.attestations).toHaveLength(0);
    });
  });

  describe('validatePrivacy', () => {
    it('returns valid for clean content', () => {
      const config = defaultPrivacyConfig();

      const result = validatePrivacy('Hello, world!', config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('reports PII as warnings', () => {
      const config = defaultPrivacyConfig();

      const result = validatePrivacy('Email: test@example.com', config);

      expect(result.valid).toBe(true); // PII/redact rules are warnings, not errors
      // Both PII detection AND deny-list email rule will flag this
      expect(result.issues.length).toBeGreaterThanOrEqual(1);
      expect(result.issues.some(i => i.type === 'pii' && i.severity === 'warning')).toBe(true);
    });

    it('reports blocking deny-list rules as errors', () => {
      const config = defaultPrivacyConfig();

      const result = validatePrivacy('Key: AKIAIOSFODNN7EXAMPLE', config);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.severity === 'error')).toBe(true);
      expect(result.issues.some(i => i.type === 'deny-list')).toBe(true);
    });

    it('reports multiple issues', () => {
      const config = defaultPrivacyConfig();

      const result = validatePrivacy(
        'Email: a@b.com, AWS: AKIAIOSFODNN7EXAMPLE',
        config,
      );

      expect(result.issues.length).toBeGreaterThan(1);
    });
  });
});
