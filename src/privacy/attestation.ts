/**
 * SaveState Deletion Attestations
 *
 * Provides cryptographic proof of data that was excluded, redacted,
 * or deleted during snapshot creation. Enables compliance auditing
 * and "never store" guarantees.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  DeletionAttestation,
  DeletionAttestationLog,
  PIIMatch,
  DenyListEvaluation,
} from './types.js';

// ─── Hash Functions ──────────────────────────────────────────

/**
 * Create a SHA-256 hash of content.
 */
function sha256(content: string | Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Create a Merkle root from multiple content hashes.
 */
function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return sha256('');
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  // Pad to even length
  const paddedHashes = [...hashes];
  if (paddedHashes.length % 2 !== 0) {
    paddedHashes.push(paddedHashes[paddedHashes.length - 1]);
  }

  // Build tree level by level
  let currentLevel = paddedHashes;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const combined = currentLevel[i] + currentLevel[i + 1];
      nextLevel.push(sha256(combined));
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

// ─── Attestation Creation ────────────────────────────────────

/**
 * Create attestation ID.
 */
function createAttestationId(): string {
  return `att-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

/**
 * Create an attestation for PII that was redacted.
 *
 * @param matches - The PII matches that were redacted
 * @param originalContent - The original content (used for size calculation)
 * @param snapshotId - The snapshot this belongs to
 * @returns Deletion attestation
 */
export function createPIIAttestation(
  matches: PIIMatch[],
  originalContent: string,
  snapshotId: string,
): DeletionAttestation {
  // Collect all hashes
  const contentHashes = matches.map((m) => m.originalHash);

  // Calculate total size of redacted content
  let totalSize = 0;
  for (const match of matches) {
    totalSize += match.end - match.start;
  }

  // Get categories (PII types)
  const types = [...new Set(matches.map((m) => m.type))];

  return {
    id: createAttestationId(),
    type: 'redaction',
    timestamp: new Date().toISOString(),
    category: `PII:${types.join(',')}`,
    contentHash: sha256(originalContent),
    sizeBytes: totalSize,
    reason: `PII redaction: ${matches.length} instance(s) of ${types.join(', ')}`,
    triggeredBy: {
      type: 'pii-rule',
      ruleName: 'PII Detection Pipeline',
    },
    proof: {
      algorithm: 'sha256',
      merkleRoot: computeMerkleRoot(contentHashes),
    },
    snapshotId,
  };
}

/**
 * Create an attestation for content blocked by deny-list.
 *
 * @param evaluation - The deny-list evaluation results
 * @param originalContent - The original content
 * @param snapshotId - The snapshot this belongs to
 * @returns Deletion attestation
 */
export function createDenyListAttestation(
  evaluation: DenyListEvaluation,
  originalContent: string,
  snapshotId: string,
): DeletionAttestation {
  const matchedRuleNames = evaluation.matchedRules.map((m) => m.rule.name);
  const matchedRuleIds = evaluation.matchedRules.map((m) => m.rule.id);

  // Collect all matched content hashes
  const contentHashes: string[] = [];
  let totalSize = 0;

  for (const { matches } of evaluation.matchedRules) {
    for (const match of matches) {
      contentHashes.push(sha256(match.content));
      totalSize += match.end - match.start;
    }
  }

  return {
    id: createAttestationId(),
    type: 'denial',
    timestamp: new Date().toISOString(),
    category: `DenyList:${evaluation.action}`,
    contentHash: sha256(originalContent),
    sizeBytes: evaluation.action === 'block' ? originalContent.length : totalSize,
    reason: `Deny-list ${evaluation.action}: matched rules [${matchedRuleNames.join(', ')}]`,
    triggeredBy: {
      type: 'deny-list',
      ruleId: matchedRuleIds.join(','),
      ruleName: matchedRuleNames.join(', '),
    },
    proof: {
      algorithm: 'sha256',
      merkleRoot: computeMerkleRoot(contentHashes),
    },
    snapshotId,
  };
}

/**
 * Create an attestation for content excluded due to retention policy.
 *
 * @param contentDescription - Description of what was excluded
 * @param contentHash - Hash of the excluded content
 * @param sizeBytes - Size of excluded content
 * @param policyName - Name of the retention policy
 * @param snapshotId - The snapshot this belongs to
 * @returns Deletion attestation
 */
export function createRetentionAttestation(
  contentDescription: string,
  contentHash: string,
  sizeBytes: number,
  policyName: string,
  snapshotId: string,
): DeletionAttestation {
  return {
    id: createAttestationId(),
    type: 'expiration',
    timestamp: new Date().toISOString(),
    category: 'Retention',
    contentHash,
    sizeBytes,
    reason: `Retention policy: ${policyName} — ${contentDescription}`,
    triggeredBy: {
      type: 'retention',
      ruleName: policyName,
    },
    proof: {
      algorithm: 'sha256',
    },
    snapshotId,
  };
}

/**
 * Create an attestation for manual deletion request.
 *
 * @param contentDescription - Description of what was deleted
 * @param contentHash - Hash of the deleted content
 * @param sizeBytes - Size of deleted content
 * @param reason - Reason for deletion
 * @param snapshotId - The snapshot this belongs to
 * @returns Deletion attestation
 */
export function createManualDeletionAttestation(
  contentDescription: string,
  contentHash: string,
  sizeBytes: number,
  reason: string,
  snapshotId: string,
): DeletionAttestation {
  return {
    id: createAttestationId(),
    type: 'manual',
    timestamp: new Date().toISOString(),
    category: 'UserRequest',
    contentHash,
    sizeBytes,
    reason: `Manual deletion: ${reason}`,
    triggeredBy: {
      type: 'user-request',
    },
    proof: {
      algorithm: 'sha256',
    },
    snapshotId,
  };
}

// ─── Attestation Log ─────────────────────────────────────────

/**
 * Create a new attestation log for a snapshot.
 *
 * @param snapshotId - The snapshot ID
 * @returns Empty attestation log
 */
export function createAttestationLog(snapshotId: string): DeletionAttestationLog {
  return {
    version: '1.0.0',
    snapshotId,
    createdAt: new Date().toISOString(),
    count: 0,
    summary: {
      byType: {},
      byCategory: {},
      totalBytesDeleted: 0,
    },
    attestations: [],
  };
}

/**
 * Add an attestation to the log.
 *
 * @param log - The attestation log
 * @param attestation - The attestation to add
 * @returns Updated log
 */
export function addAttestation(
  log: DeletionAttestationLog,
  attestation: DeletionAttestation,
): DeletionAttestationLog {
  const newLog = { ...log };

  newLog.attestations = [...log.attestations, attestation];
  newLog.count = newLog.attestations.length;

  // Update summary
  newLog.summary.byType[attestation.type] =
    (newLog.summary.byType[attestation.type] || 0) + 1;
  newLog.summary.byCategory[attestation.category] =
    (newLog.summary.byCategory[attestation.category] || 0) + 1;
  newLog.summary.totalBytesDeleted += attestation.sizeBytes;

  return newLog;
}

/**
 * Finalize the attestation log by computing the overall Merkle root.
 *
 * @param log - The attestation log
 * @returns Finalized log with proof
 */
export function finalizeAttestationLog(
  log: DeletionAttestationLog,
): DeletionAttestationLog & { proof: { merkleRoot: string } } {
  const allHashes = log.attestations.map((a) => a.contentHash);
  const merkleRoot = computeMerkleRoot(allHashes);

  return {
    ...log,
    proof: {
      merkleRoot,
    },
  };
}

// ─── Verification ────────────────────────────────────────────

/**
 * Verify that an attestation log is internally consistent.
 *
 * @param log - The attestation log to verify
 * @returns Verification result
 */
export function verifyAttestationLog(
  log: DeletionAttestationLog & { proof?: { merkleRoot: string } },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check count matches
  if (log.count !== log.attestations.length) {
    errors.push(`Count mismatch: expected ${log.count}, found ${log.attestations.length}`);
  }

  // Check summary totals
  const actualByType: Record<string, number> = {};
  const actualByCategory: Record<string, number> = {};
  let actualTotalBytes = 0;

  for (const att of log.attestations) {
    actualByType[att.type] = (actualByType[att.type] || 0) + 1;
    actualByCategory[att.category] = (actualByCategory[att.category] || 0) + 1;
    actualTotalBytes += att.sizeBytes;
  }

  if (actualTotalBytes !== log.summary.totalBytesDeleted) {
    errors.push(
      `Total bytes mismatch: expected ${log.summary.totalBytesDeleted}, found ${actualTotalBytes}`,
    );
  }

  // Verify Merkle root if present
  if (log.proof?.merkleRoot) {
    const allHashes = log.attestations.map((a) => a.contentHash);
    const expectedRoot = computeMerkleRoot(allHashes);

    if (expectedRoot !== log.proof.merkleRoot) {
      errors.push(`Merkle root mismatch: expected ${expectedRoot}, found ${log.proof.merkleRoot}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a human-readable summary of deletion attestations.
 */
export function summarizeAttestations(log: DeletionAttestationLog): string {
  const lines: string[] = [
    `Deletion Attestation Summary for Snapshot: ${log.snapshotId}`,
    `Created: ${log.createdAt}`,
    `Total Attestations: ${log.count}`,
    `Total Data Excluded: ${formatBytes(log.summary.totalBytesDeleted)}`,
    '',
    'By Type:',
  ];

  for (const [type, count] of Object.entries(log.summary.byType)) {
    lines.push(`  - ${type}: ${count}`);
  }

  lines.push('', 'By Category:');
  for (const [category, count] of Object.entries(log.summary.byCategory)) {
    lines.push(`  - ${category}: ${count}`);
  }

  return lines.join('\n');
}

/**
 * Format bytes as human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
