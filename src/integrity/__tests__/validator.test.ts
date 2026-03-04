/**
 * Integrity Validator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntegrityValidator,
  DEFAULT_POLICY,
  ValidatableData,
  hashEvidenceBundle,
  createEvidenceBundle,
  verifyEvidenceBundle,
  EvidenceItem,
} from '../index.js';

describe('IntegrityValidator', () => {
  let validator: IntegrityValidator;

  beforeEach(() => {
    validator = new IntegrityValidator();
  });

  describe('validate', () => {
    it('should pass validation for fresh data with evidence', () => {
      const data: ValidatableData = {
        created_at: new Date().toISOString(),
        evidence_bundle_hash: 'abc123',
      };

      const result = validator.validate(data);

      expect(result.valid).toBe(true);
      expect(result.status).toBe('valid');
      expect(result.errors).toHaveLength(0);
    });

    it('should fail TTL check for old data', () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const data: ValidatableData = {
        created_at: oldDate.toISOString(),
        ttl_s: 86400 * 30, // 30 day TTL
      };

      const result = validator.validate(data);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rule_results.some(r => r.rule_id === 'ttl-check' && !r.passed)).toBe(true);
    });

    it('should warn when evidence is missing', () => {
      const data: ValidatableData = {
        created_at: new Date().toISOString(),
        // No evidence_bundle_hash
      };

      const result = validator.validate(data);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.status).toBe('suspect');
    });

    it('should use custom TTL from data if provided', () => {
      const data: ValidatableData = {
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        ttl_s: 30 * 60, // 30 minute TTL (expired)
      };

      const result = validator.validate(data);

      expect(result.rule_results.some(r => r.rule_id === 'ttl-check' && !r.passed)).toBe(true);
    });
  });

  describe('createIntegrityMetadata', () => {
    it('should create metadata with valid status', () => {
      const metadata = validator.createIntegrityMetadata();

      expect(metadata.validity_status).toBe('valid');
      expect(metadata.policy_version).toBe(DEFAULT_POLICY.version);
      expect(metadata.last_validated_at).toBeDefined();
    });

    it('should include optional fields when provided', () => {
      const metadata = validator.createIntegrityMetadata({
        ttl_s: 3600,
        source_revision: 'abc123',
        evidence_bundle_hash: 'hash456',
      });

      expect(metadata.ttl_s).toBe(3600);
      expect(metadata.source_revision).toBe('abc123');
      expect(metadata.evidence_bundle_hash).toBe('hash456');
    });
  });

  describe('markInvalid', () => {
    it('should mark metadata as invalid with reason', () => {
      const original = validator.createIntegrityMetadata();
      const invalid = validator.markInvalid(original, 'source_changed');

      expect(invalid.validity_status).toBe('invalid');
      expect(invalid.invalid_reason).toBe('source_changed');
      expect(invalid.invalidated_at).toBeDefined();
    });
  });

  describe('markSuspect', () => {
    it('should mark metadata as suspect', () => {
      const original = validator.createIntegrityMetadata();
      const suspect = validator.markSuspect(original);

      expect(suspect.validity_status).toBe('suspect');
    });
  });

  describe('revalidate', () => {
    it('should update metadata after revalidation', () => {
      const original = validator.createIntegrityMetadata();
      const data: ValidatableData = {
        created_at: new Date().toISOString(),
        evidence_bundle_hash: 'fresh-evidence',
        integrity: original,
      };

      const revalidated = validator.revalidate(original, data);

      expect(revalidated.last_validated_at).toBeDefined();
      expect(new Date(revalidated.last_validated_at!).getTime())
        .toBeGreaterThanOrEqual(new Date(original.last_validated_at!).getTime());
    });
  });

  describe('custom policy', () => {
    it('should use custom policy when provided', () => {
      const customValidator = new IntegrityValidator({
        version: '2.0.0',
        name: 'strict',
        rules: [
          {
            rule_id: 'always-fail',
            name: 'Always Fail',
            description: 'Always fails for testing',
            severity: 'error',
            condition: { type: 'evidence_required' },
            enabled: true,
          },
        ],
        default_retrieval_mode: 'stable_only',
        strict_mode: true,
        created_at: new Date().toISOString(),
      });

      const data: ValidatableData = {
        created_at: new Date().toISOString(),
        // No evidence
      };

      const result = customValidator.validate(data);

      expect(result.policy_version).toBe('2.0.0');
      expect(result.status).toBe('invalid'); // strict_mode
    });

    it('should respect strict_mode for error handling', () => {
      const strictValidator = new IntegrityValidator({
        ...DEFAULT_POLICY,
        strict_mode: true,
      });

      const data: ValidatableData = {
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        ttl_s: 86400 * 30,
      };

      const result = strictValidator.validate(data);

      expect(result.valid).toBe(false);
      expect(result.status).toBe('invalid');
    });
  });
});

describe('Evidence Bundle', () => {
  describe('hashEvidenceBundle', () => {
    it('should produce deterministic hash', () => {
      const items: EvidenceItem[] = [
        {
          type: 'source_document',
          reference: 'https://example.com/doc',
          content_hash: 'abc123',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ];

      const hash1 = hashEvidenceBundle(items);
      const hash2 = hashEvidenceBundle(items);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hash for different items', () => {
      const items1: EvidenceItem[] = [
        {
          type: 'source_document',
          reference: 'doc1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ];

      const items2: EvidenceItem[] = [
        {
          type: 'source_document',
          reference: 'doc2',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ];

      expect(hashEvidenceBundle(items1)).not.toBe(hashEvidenceBundle(items2));
    });
  });

  describe('createEvidenceBundle', () => {
    it('should create bundle with hash', () => {
      const items: EvidenceItem[] = [
        {
          type: 'user_input',
          reference: 'user:123',
          timestamp: new Date().toISOString(),
        },
      ];

      const bundle = createEvidenceBundle(items);

      expect(bundle.bundle_id).toBeDefined();
      expect(bundle.items).toEqual(items);
      expect(bundle.hash).toBeDefined();
      expect(bundle.created_at).toBeDefined();
    });
  });

  describe('verifyEvidenceBundle', () => {
    it('should verify valid bundle', () => {
      const items: EvidenceItem[] = [
        {
          type: 'api_response',
          reference: 'api/v1/data',
          content_hash: 'response-hash',
          timestamp: new Date().toISOString(),
        },
      ];

      const bundle = createEvidenceBundle(items);

      expect(verifyEvidenceBundle(bundle)).toBe(true);
    });

    it('should reject tampered bundle', () => {
      const items: EvidenceItem[] = [
        {
          type: 'api_response',
          reference: 'api/v1/data',
          timestamp: new Date().toISOString(),
        },
      ];

      const bundle = createEvidenceBundle(items);

      // Tamper with the bundle
      bundle.items[0].reference = 'api/v1/other';

      expect(verifyEvidenceBundle(bundle)).toBe(false);
    });
  });
});
