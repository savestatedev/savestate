/**
 * SaveState Privacy Controls
 *
 * Explicit privacy controls for PII redaction, deny-list policies,
 * field-level encryption, and deletion attestations.
 *
 * @module privacy
 */

// ─── Types ───────────────────────────────────────────────────

export type {
  PIIType,
  PIIMatch,
  PIIDetectionResult,
  PIIRedactionResult,
  RedactionMethod,
  DenyListRule,
  DenyListPolicy,
  DenyListEvaluation,
  DenyListAction,
  BuiltInRuleSet,
  EncryptedField,
  FieldEncryptionConfig,
  DeletionAttestation,
  DeletionAttestationLog,
  PrivacyConfig,
  PrivacyPipelineResult,
} from './types.js';

// ─── PII Detection & Redaction ───────────────────────────────

export {
  detectPII,
  redactPII,
  containsPII,
  summarizePII,
} from './pii.js';

// ─── Deny-List Policy Engine ─────────────────────────────────

export {
  evaluateDenyList,
  applyDenyList,
  createPolicy,
  addRule,
  removeRule,
  getBuiltinRuleSets,
  getBuiltinRules,
} from './deny-list.js';

// ─── Field-Level Encryption ──────────────────────────────────

export {
  encryptField,
  decryptField,
  isEncryptedField,
  encryptFields,
  decryptFields,
  rotateFieldKeys,
  defaultFieldEncryptionConfig,
} from './field-encryption.js';

// ─── Deletion Attestations ───────────────────────────────────

export {
  createPIIAttestation,
  createDenyListAttestation,
  createRetentionAttestation,
  createManualDeletionAttestation,
  createAttestationLog,
  addAttestation,
  finalizeAttestationLog,
  verifyAttestationLog,
  summarizeAttestations,
} from './attestation.js';

// ─── Privacy Pipeline ────────────────────────────────────────

import type {
  PrivacyConfig,
  PrivacyPipelineResult,
  DeletionAttestation,
} from './types.js';
import { redactPII, containsPII } from './pii.js';
import { applyDenyList, createPolicy } from './deny-list.js';
import { encryptFields } from './field-encryption.js';
import {
  createPIIAttestation,
  createDenyListAttestation,
  createAttestationLog,
  addAttestation,
  finalizeAttestationLog,
} from './attestation.js';

/**
 * Default privacy configuration.
 */
export function defaultPrivacyConfig(): PrivacyConfig {
  return {
    version: '1.0.0',
    enabled: true,
    pii: {
      enabled: true,
      types: ['email', 'phone', 'ssn', 'credit_card', 'api_key', 'password'],
      method: 'mask',
      confidenceThreshold: 0.7,
    },
    denyList: createPolicy('default', {
      includes: ['pii-standard', 'secrets'],
    }),
    fieldEncryption: {
      alwaysEncrypt: ['$.memory.core[*].content'],
      encryptIfPII: ['$.conversations.**.content'],
      keyId: `key-${Date.now()}`,
      strength: 'standard',
    },
    attestations: {
      enabled: true,
      sign: false,
      includeInArchive: true,
    },
  };
}

/**
 * Apply the full privacy pipeline to content.
 *
 * This is the main entry point for privacy controls. It:
 * 1. Detects and redacts PII
 * 2. Evaluates deny-list policies
 * 3. Creates deletion attestations
 *
 * @param content - The content to process
 * @param snapshotId - The snapshot this content belongs to
 * @param config - Privacy configuration
 * @returns Processing results with attestations
 */
export function applyPrivacyPipeline(
  content: string,
  snapshotId: string,
  config: PrivacyConfig,
): PrivacyPipelineResult {
  const startTime = performance.now();
  const attestations: DeletionAttestation[] = [];

  if (!config.enabled) {
    return {
      content,
      modified: false,
      attestations: [],
      processingTimeMs: performance.now() - startTime,
    };
  }

  let processedContent = content;
  let modified = false;
  let piiResult;
  let denyListResult;

  // Step 1: Pre-evaluate deny-list on ORIGINAL content (before any redaction)
  // This allows blocking rules to take effect before PII redaction modifies the content
  if (config.denyList.enabled) {
    const { content: denyListContent, evaluation } = applyDenyList(
      content, // Use original content for deny-list evaluation
      config.denyList,
    );

    denyListResult = evaluation;

    if (evaluation.matched && evaluation.action === 'block') {
      // Content is blocked entirely - skip all other processing
      processedContent = '[BLOCKED BY POLICY]';
      modified = true;

      // Create attestation for deny-list block
      if (config.attestations.enabled) {
        const denyListAttestation = createDenyListAttestation(
          evaluation,
          content,
          snapshotId,
        );
        attestations.push(denyListAttestation);
      }

      // Return early - no further processing needed
      return {
        content: processedContent,
        modified,
        pii: piiResult,
        denyList: denyListResult,
        attestations,
        processingTimeMs: performance.now() - startTime,
      };
    }
  }

  // Step 2: PII Detection and Redaction
  if (config.pii.enabled) {
    piiResult = redactPII(processedContent, {
      types: config.pii.types,
      method: config.pii.method,
      confidenceThreshold: config.pii.confidenceThreshold,
      customPatterns: config.pii.customPatterns,
    });

    if (piiResult.detection.matchCount > 0) {
      processedContent = piiResult.redacted;
      modified = true;

      // Create attestation for redacted PII
      if (config.attestations.enabled) {
        const piiAttestation = createPIIAttestation(
          piiResult.detection.matches,
          content,
          snapshotId,
        );
        attestations.push(piiAttestation);
      }
    }
  }

  // Step 3: Apply deny-list redaction (non-blocking matches)
  if (config.denyList.enabled && denyListResult?.matched && denyListResult.action === 'redact') {
    const { content: denyListContent } = applyDenyList(
      processedContent,
      config.denyList,
    );

    processedContent = denyListContent;
    modified = true;

    // Create attestation for deny-list redaction
    if (config.attestations.enabled) {
      const denyListAttestation = createDenyListAttestation(
        denyListResult,
        content,
        snapshotId,
      );
      attestations.push(denyListAttestation);
    }
  }

  return {
    content: processedContent,
    modified,
    pii: piiResult,
    denyList: denyListResult,
    attestations,
    processingTimeMs: performance.now() - startTime,
  };
}

/**
 * Apply privacy controls to a memory object structure.
 *
 * Processes memory entries, applying PII redaction and field encryption.
 *
 * @param memory - The memory object to process
 * @param snapshotId - The snapshot ID
 * @param config - Privacy configuration
 * @param passphrase - Passphrase for field encryption
 * @returns Processed memory and attestation log
 */
export async function processMemoryPrivacy(
  memory: { core: Array<{ id: string; content: string; [key: string]: unknown }> },
  snapshotId: string,
  config: PrivacyConfig,
  passphrase: string,
): Promise<{
  memory: typeof memory;
  attestationLog: ReturnType<typeof finalizeAttestationLog>;
  stats: {
    entriesProcessed: number;
    entriesModified: number;
    piiDetected: number;
    denyListMatches: number;
    fieldsEncrypted: number;
  };
}> {
  let log = createAttestationLog(snapshotId);
  const stats = {
    entriesProcessed: 0,
    entriesModified: 0,
    piiDetected: 0,
    denyListMatches: 0,
    fieldsEncrypted: 0,
  };

  const processedCore = [];

  for (const entry of memory.core) {
    stats.entriesProcessed++;

    // Apply content-level privacy pipeline
    const result = applyPrivacyPipeline(entry.content, snapshotId, config);

    if (result.modified) {
      stats.entriesModified++;
    }

    if (result.pii?.detection.matchCount) {
      stats.piiDetected += result.pii.detection.matchCount;
    }

    if (result.denyList?.matched) {
      stats.denyListMatches += result.denyList.matchedRules.length;
    }

    // Add attestations to log
    for (const attestation of result.attestations) {
      log = addAttestation(log, attestation);
    }

    processedCore.push({
      ...entry,
      content: result.content,
    });
  }

  // Apply field-level encryption if configured
  let finalMemory: typeof memory = { ...memory, core: processedCore };

  if (config.fieldEncryption.alwaysEncrypt.length > 0 || config.fieldEncryption.encryptIfPII.length > 0) {
    const { result, encryptedPaths } = await encryptFields(
      finalMemory as Record<string, unknown>,
      config.fieldEncryption,
      passphrase,
      (content) => containsPII(content, config.pii.types, config.pii.confidenceThreshold),
    );

    finalMemory = result as typeof memory;
    stats.fieldsEncrypted = encryptedPaths.length;
  }

  return {
    memory: finalMemory,
    attestationLog: finalizeAttestationLog(log),
    stats,
  };
}

/**
 * Validate that content passes privacy policies (dry-run).
 *
 * Checks content against privacy rules without modifying it.
 * Useful for pre-flight validation.
 *
 * @param content - Content to validate
 * @param config - Privacy configuration
 * @returns Validation results
 */
export function validatePrivacy(
  content: string,
  config: PrivacyConfig,
): {
  valid: boolean;
  issues: Array<{
    type: 'pii' | 'deny-list';
    severity: 'error' | 'warning';
    message: string;
    details?: unknown;
  }>;
} {
  const issues: Array<{
    type: 'pii' | 'deny-list';
    severity: 'error' | 'warning';
    message: string;
    details?: unknown;
  }> = [];

  // Check PII
  if (config.pii.enabled) {
    const piiResult = redactPII(content, {
      types: config.pii.types,
      confidenceThreshold: config.pii.confidenceThreshold,
    });

    if (piiResult.detection.matchCount > 0) {
      for (const match of piiResult.detection.matches) {
        issues.push({
          type: 'pii',
          severity: 'warning',
          message: `PII detected: ${match.type} (confidence: ${(match.confidence * 100).toFixed(0)}%)`,
          details: { type: match.type, start: match.start, end: match.end },
        });
      }
    }
  }

  // Check deny-list
  if (config.denyList.enabled) {
    const { evaluation } = applyDenyList(content, config.denyList);

    if (evaluation.matched) {
      for (const { rule, matches } of evaluation.matchedRules) {
        issues.push({
          type: 'deny-list',
          severity: rule.action === 'block' ? 'error' : 'warning',
          message: `Deny-list match: ${rule.name} (action: ${rule.action})`,
          details: { ruleId: rule.id, matchCount: matches.length },
        });
      }
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
