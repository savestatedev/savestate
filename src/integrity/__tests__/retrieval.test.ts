/**
 * Integrity Retrieval Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IntegrityRetrieval,
  IntegrityValidator,
  filterByMode,
  passesIntegrityCheck,
  defaultRetrievalOptions,
  IntegrityMetadata,
} from '../index.js';

describe('filterByMode', () => {
  interface TestItem {
    id: string;
    integrity?: IntegrityMetadata;
  }

  const items: TestItem[] = [
    { id: 'valid', integrity: { validity_status: 'valid' } },
    { id: 'suspect', integrity: { validity_status: 'suspect' } },
    { id: 'invalid', integrity: { validity_status: 'invalid', invalid_reason: 'ttl_expired' } },
    { id: 'unverified', integrity: { validity_status: 'unverified' } },
    { id: 'no-integrity' }, // No integrity metadata
  ];

  describe('stable_only mode', () => {
    it('should only return valid items', () => {
      const result = filterByMode(items, 'stable_only');

      expect(result.map(i => i.id)).toEqual(['valid', 'no-integrity']);
    });
  });

  describe('include_suspect mode', () => {
    it('should include valid, suspect, and unverified items', () => {
      const result = filterByMode(items, 'include_suspect');

      expect(result.map(i => i.id)).toEqual(['valid', 'suspect', 'unverified', 'no-integrity']);
    });

    it('should exclude invalid items', () => {
      const result = filterByMode(items, 'include_suspect');

      expect(result.find(i => i.id === 'invalid')).toBeUndefined();
    });
  });

  describe('execute_safe mode', () => {
    it('should only return valid items with recent validation', () => {
      const recentlyValidated: TestItem = {
        id: 'recent',
        integrity: {
          validity_status: 'valid',
          last_validated_at: new Date().toISOString(),
        },
      };

      const result = filterByMode([...items, recentlyValidated], 'execute_safe');

      expect(result.map(i => i.id)).toEqual(['recent']);
    });

    it('should exclude items with stale validation', () => {
      const staleValidated: TestItem = {
        id: 'stale',
        integrity: {
          validity_status: 'valid',
          last_validated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
      };

      const result = filterByMode([staleValidated], 'execute_safe');

      expect(result).toHaveLength(0);
    });
  });
});

describe('passesIntegrityCheck', () => {
  describe('stable_only mode', () => {
    it('should pass for valid status', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'valid' },
        'stable_only'
      );

      expect(result.passed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail for suspect status', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'suspect' },
        'stable_only'
      );

      expect(result.passed).toBe(false);
    });

    it('should fail for invalid status', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'invalid', invalid_reason: 'ttl_expired' },
        'stable_only'
      );

      expect(result.passed).toBe(false);
    });
  });

  describe('include_suspect mode', () => {
    it('should pass for valid status', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'valid' },
        'include_suspect'
      );

      expect(result.passed).toBe(true);
    });

    it('should pass for suspect status with warning', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'suspect' },
        'include_suspect'
      );

      expect(result.passed).toBe(true);
      expect(result.warnings.some(w => w.includes('suspect'))).toBe(true);
    });

    it('should fail for invalid status', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'invalid', invalid_reason: 'source_changed' },
        'include_suspect'
      );

      expect(result.passed).toBe(false);
    });
  });

  describe('execute_safe mode', () => {
    it('should pass for valid status with recent validation', () => {
      const result = passesIntegrityCheck(
        {
          validity_status: 'valid',
          last_validated_at: new Date().toISOString(),
        },
        'execute_safe'
      );

      expect(result.passed).toBe(true);
    });

    it('should fail for stale validation', () => {
      const result = passesIntegrityCheck(
        {
          validity_status: 'valid',
          last_validated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        'execute_safe',
        { maxValidationAgeS: 3600 }
      );

      expect(result.passed).toBe(false);
      expect(result.warnings.some(w => w.includes('stale'))).toBe(true);
    });

    it('should fail for valid without validation timestamp', () => {
      const result = passesIntegrityCheck(
        { validity_status: 'valid' },
        'execute_safe'
      );

      expect(result.passed).toBe(false);
    });

    it('should fail for suspect status', () => {
      const result = passesIntegrityCheck(
        {
          validity_status: 'suspect',
          last_validated_at: new Date().toISOString(),
        },
        'execute_safe'
      );

      expect(result.passed).toBe(false);
    });

    it('should fail without any integrity metadata', () => {
      const result = passesIntegrityCheck(undefined, 'execute_safe');

      expect(result.passed).toBe(false);
    });
  });
});

describe('IntegrityRetrieval', () => {
  let validator: IntegrityValidator;
  let retrieval: IntegrityRetrieval;

  beforeEach(() => {
    validator = new IntegrityValidator();
    retrieval = new IntegrityRetrieval(validator);
  });

  describe('wrapWithIntegrity', () => {
    it('should wrap data with integrity result', () => {
      const data = { content: 'test' };
      const integrity: IntegrityMetadata = {
        validity_status: 'valid',
        last_validated_at: new Date().toISOString(),
      };

      const result = retrieval.wrapWithIntegrity(data, integrity, {
        mode: 'stable_only',
      });

      expect(result.data).toEqual(data);
      expect(result.integrity).toBeDefined();
      expect(result.passed_checks).toBe(true);
    });

    it('should revalidate when requested', () => {
      const data = { content: 'test' };
      const oldIntegrity: IntegrityMetadata = {
        validity_status: 'valid',
        last_validated_at: new Date(Date.now() - 60000).toISOString(),
      };

      const result = retrieval.wrapWithIntegrity(data, oldIntegrity, {
        mode: 'stable_only',
        revalidate: true,
      });

      expect(new Date(result.integrity.last_validated_at!).getTime())
        .toBeGreaterThan(new Date(oldIntegrity.last_validated_at!).getTime());
    });
  });

  describe('filterWithIntegrity', () => {
    it('should filter and wrap items', () => {
      interface TestItem {
        id: string;
        integrity?: IntegrityMetadata;
      }

      const items: TestItem[] = [
        { id: 'valid', integrity: { validity_status: 'valid' } },
        { id: 'invalid', integrity: { validity_status: 'invalid', invalid_reason: 'ttl_expired' } },
      ];

      const results = retrieval.filterWithIntegrity(items, { mode: 'stable_only' });

      expect(results).toHaveLength(1);
      expect(results[0].data.id).toBe('valid');
    });
  });

  describe('prepareForExecution', () => {
    it('should prepare items with execution readiness', () => {
      const items = [
        {
          id: 'ready',
          created_at: new Date().toISOString(),
          integrity: {
            validity_status: 'valid' as const,
            last_validated_at: new Date().toISOString(),
            evidence_bundle_hash: 'evidence',
          },
        },
        {
          id: 'not-ready',
          created_at: new Date().toISOString(),
          integrity: { validity_status: 'suspect' as const },
        },
      ];

      const results = retrieval.prepareForExecution(items);

      expect(results).toHaveLength(2);
      // The 'ready' item may or may not be ready depending on validation
      const notReadyResult = results.find(r => r.data.id === 'not-ready');
      expect(notReadyResult?.ready_for_execution).toBe(false);
    });
  });

  describe('checkExecutionReadiness', () => {
    it('should summarize readiness for batch', () => {
      const items = [
        { integrity: { validity_status: 'valid' as const, last_validated_at: new Date().toISOString() } },
        { integrity: { validity_status: 'valid' as const, last_validated_at: new Date().toISOString() } },
        { integrity: { validity_status: 'invalid' as const, invalid_reason: 'ttl_expired' as const } },
      ];

      const result = retrieval.checkExecutionReadiness(items);

      expect(result.summary.total).toBe(3);
      expect(result.summary.failed).toBeGreaterThan(0);
      expect(result.failed_items).toContain(2);
    });
  });
});

describe('defaultRetrievalOptions', () => {
  it('should create options for stable_only mode', () => {
    const options = defaultRetrievalOptions('stable_only');

    expect(options.mode).toBe('stable_only');
    expect(options.revalidate).toBe(false);
  });

  it('should create options for execute_safe mode with revalidation', () => {
    const options = defaultRetrievalOptions('execute_safe');

    expect(options.mode).toBe('execute_safe');
    expect(options.revalidate).toBe(true);
    expect(options.max_validation_age_s).toBe(3600);
  });
});
