/**
 * Integrity-Aware Retrieval
 * 
 * Provides memory retrieval with integrity checking based on mode:
 * - stable_only: Only return valid, verified memories
 * - include_suspect: Include suspect memories but flag them
 * - execute_safe: Pre-validated memories safe for action execution
 */

import {
  IntegrityMetadata,
  IntegrityRetrievalOptions,
  IntegrityRetrievalResult,
  RetrievalMode,
  ValidityStatus,
} from './types.js';
import { IntegrityValidator, ValidatableData } from './validator.js';

/**
 * Filter memories based on retrieval mode
 */
export function filterByMode<T extends { integrity?: IntegrityMetadata }>(
  items: T[],
  mode: RetrievalMode
): T[] {
  switch (mode) {
    case 'stable_only':
      // Only valid items
      return items.filter(
        item => !item.integrity || item.integrity.validity_status === 'valid'
      );

    case 'include_suspect':
      // Valid and suspect, exclude invalid
      return items.filter(
        item =>
          !item.integrity ||
          item.integrity.validity_status === 'valid' ||
          item.integrity.validity_status === 'suspect' ||
          item.integrity.validity_status === 'unverified'
      );

    case 'execute_safe':
      // Only valid items that have been recently validated
      return items.filter(item => {
        if (!item.integrity) return false;
        if (item.integrity.validity_status !== 'valid') return false;
        
        // Check validation freshness (must be validated within last hour)
        if (item.integrity.last_validated_at) {
          const validatedAt = new Date(item.integrity.last_validated_at).getTime();
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          return validatedAt > oneHourAgo;
        }
        
        return false;
      });

    default:
      return items;
  }
}

/**
 * Check if a single item passes integrity checks for a mode
 */
export function passesIntegrityCheck(
  integrity: IntegrityMetadata | undefined,
  mode: RetrievalMode,
  options?: { maxValidationAgeS?: number }
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!integrity) {
    // No integrity metadata - depends on mode
    if (mode === 'execute_safe') {
      return { passed: false, warnings: ['No integrity metadata for execute_safe mode'] };
    }
    warnings.push('No integrity metadata present');
    return { passed: true, warnings };
  }

  switch (mode) {
    case 'stable_only':
      if (integrity.validity_status === 'invalid') {
        return { passed: false, warnings: ['Item is marked invalid'] };
      }
      if (integrity.validity_status === 'suspect') {
        return { passed: false, warnings: ['Item is marked suspect'] };
      }
      return { passed: true, warnings };

    case 'include_suspect':
      if (integrity.validity_status === 'invalid') {
        return { passed: false, warnings: ['Item is marked invalid'] };
      }
      if (integrity.validity_status === 'suspect') {
        warnings.push('Item is marked suspect');
      }
      if (integrity.validity_status === 'unverified') {
        warnings.push('Item has not been verified');
      }
      return { passed: true, warnings };

    case 'execute_safe':
      if (integrity.validity_status !== 'valid') {
        return { 
          passed: false, 
          warnings: [`Item status '${integrity.validity_status}' not valid for execute_safe`] 
        };
      }

      // Check validation freshness
      const maxAge = options?.maxValidationAgeS ?? 3600; // Default 1 hour
      if (integrity.last_validated_at) {
        const validatedAt = new Date(integrity.last_validated_at).getTime();
        const threshold = Date.now() - maxAge * 1000;
        if (validatedAt < threshold) {
          return { 
            passed: false, 
            warnings: [`Validation is stale (older than ${maxAge}s)`] 
          };
        }
      } else {
        return { 
          passed: false, 
          warnings: ['No validation timestamp for execute_safe mode'] 
        };
      }

      return { passed: true, warnings };

    default:
      return { passed: true, warnings };
  }
}

/**
 * Integrity-aware retrieval service
 */
export class IntegrityRetrieval {
  constructor(private validator: IntegrityValidator) {}

  /**
   * Wrap data with integrity checking
   */
  wrapWithIntegrity<T>(
    data: T,
    integrity: IntegrityMetadata | undefined,
    options: IntegrityRetrievalOptions
  ): IntegrityRetrievalResult<T> {
    // Optionally revalidate
    let currentIntegrity = integrity;
    if (options.revalidate && currentIntegrity) {
      const validatable: ValidatableData = {
        created_at: currentIntegrity.last_validated_at || new Date().toISOString(),
        ttl_s: currentIntegrity.ttl_s,
        integrity: currentIntegrity,
        evidence_bundle_hash: currentIntegrity.evidence_bundle_hash,
        source_revision: currentIntegrity.source_revision,
      };
      currentIntegrity = this.validator.revalidate(currentIntegrity, validatable);
    }

    const { passed, warnings } = passesIntegrityCheck(
      currentIntegrity,
      options.mode,
      { maxValidationAgeS: options.max_validation_age_s }
    );

    return {
      data,
      integrity: currentIntegrity || this.validator.createIntegrityMetadata(),
      passed_checks: passed,
      warnings,
      evidence_hash: currentIntegrity?.evidence_bundle_hash,
    };
  }

  /**
   * Retrieve and filter items with integrity checking
   */
  filterWithIntegrity<T extends { integrity?: IntegrityMetadata }>(
    items: T[],
    options: IntegrityRetrievalOptions
  ): Array<IntegrityRetrievalResult<T>> {
    // First filter by mode
    const filtered = filterByMode(items, options.mode);

    // Then wrap each with full integrity result
    return filtered.map(item =>
      this.wrapWithIntegrity(item, item.integrity, options)
    );
  }

  /**
   * Prepare items for safe execution (revalidate all)
   */
  prepareForExecution<T extends { integrity?: IntegrityMetadata; created_at: string }>(
    items: T[]
  ): Array<IntegrityRetrievalResult<T> & { ready_for_execution: boolean }> {
    return items.map(item => {
      // Revalidate the item
      const validatable: ValidatableData = {
        created_at: item.created_at,
        ttl_s: item.integrity?.ttl_s,
        integrity: item.integrity,
        evidence_bundle_hash: item.integrity?.evidence_bundle_hash,
        source_revision: item.integrity?.source_revision,
      };

      const result = this.validator.validate(validatable);
      const updatedIntegrity = item.integrity 
        ? this.validator.revalidate(item.integrity, validatable)
        : this.validator.createIntegrityMetadata();

      const { passed, warnings } = passesIntegrityCheck(
        updatedIntegrity,
        'execute_safe'
      );

      return {
        data: item,
        integrity: updatedIntegrity,
        passed_checks: passed,
        warnings: [...warnings, ...result.warnings],
        evidence_hash: updatedIntegrity.evidence_bundle_hash,
        ready_for_execution: passed && result.valid,
      };
    });
  }

  /**
   * Check if a batch of items is ready for action execution
   */
  checkExecutionReadiness<T extends { integrity?: IntegrityMetadata }>(
    items: T[]
  ): {
    ready: boolean;
    failed_items: number[];
    summary: {
      total: number;
      passed: number;
      failed: number;
    };
    warnings: string[];
  } {
    const results = items.map((item, index) => ({
      index,
      ...passesIntegrityCheck(item.integrity, 'execute_safe'),
    }));

    const failed = results.filter(r => !r.passed);
    const warnings = results.flatMap(r => r.warnings);

    return {
      ready: failed.length === 0,
      failed_items: failed.map(f => f.index),
      summary: {
        total: items.length,
        passed: items.length - failed.length,
        failed: failed.length,
      },
      warnings,
    };
  }
}

/**
 * Create default retrieval options
 */
export function defaultRetrievalOptions(
  mode: RetrievalMode = 'stable_only'
): IntegrityRetrievalOptions {
  return {
    mode,
    revalidate: mode === 'execute_safe',
    max_validation_age_s: mode === 'execute_safe' ? 3600 : undefined,
  };
}
