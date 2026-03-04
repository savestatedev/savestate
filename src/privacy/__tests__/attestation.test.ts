/**
 * Tests for deletion attestations
 */

import { describe, it, expect } from 'vitest';
import {
  createPIIAttestation,
  createDenyListAttestation,
  createRetentionAttestation,
  createManualDeletionAttestation,
  createAttestationLog,
  addAttestation,
  finalizeAttestationLog,
  verifyAttestationLog,
  summarizeAttestations,
} from '../attestation.js';
import type { PIIMatch, DenyListEvaluation } from '../types.js';

describe('Deletion Attestations', () => {
  const snapshotId = 'snapshot-test-123';

  describe('createPIIAttestation', () => {
    it('creates attestation for PII redaction', () => {
      const matches: PIIMatch[] = [
        { type: 'email', start: 0, end: 15, originalHash: 'abc123', confidence: 0.95 },
        { type: 'phone', start: 20, end: 32, originalHash: 'def456', confidence: 0.85 },
      ];

      const attestation = createPIIAttestation(matches, 'test@email.com and 555-1234', snapshotId);

      expect(attestation.type).toBe('redaction');
      expect(attestation.category).toContain('PII:');
      expect(attestation.snapshotId).toBe(snapshotId);
      expect(attestation.sizeBytes).toBe(27); // Total matched chars
      expect(attestation.triggeredBy?.type).toBe('pii-rule');
      expect(attestation.proof.algorithm).toBe('sha256');
      expect(attestation.proof.merkleRoot).toBeDefined();
    });
  });

  describe('createDenyListAttestation', () => {
    it('creates attestation for deny-list block', () => {
      const evaluation: DenyListEvaluation = {
        matched: true,
        matchedRules: [
          {
            rule: {
              id: 'rule-1',
              name: 'Block secrets',
              type: 'contains',
              pattern: 'secret',
              action: 'block',
              enabled: true,
            },
            matches: [{ start: 0, end: 6, content: 'secret' }],
          },
        ],
        action: 'block',
        evaluatedAt: new Date().toISOString(),
        processingTimeMs: 1,
      };

      const attestation = createDenyListAttestation(evaluation, 'secret data', snapshotId);

      expect(attestation.type).toBe('denial');
      expect(attestation.category).toBe('DenyList:block');
      expect(attestation.sizeBytes).toBe(11); // Full content blocked
      expect(attestation.triggeredBy?.type).toBe('deny-list');
      expect(attestation.triggeredBy?.ruleId).toBe('rule-1');
    });
  });

  describe('createRetentionAttestation', () => {
    it('creates attestation for retention policy', () => {
      const attestation = createRetentionAttestation(
        'Conversation older than 90 days',
        'hashxyz',
        1024,
        '90-day-retention',
        snapshotId,
      );

      expect(attestation.type).toBe('expiration');
      expect(attestation.category).toBe('Retention');
      expect(attestation.sizeBytes).toBe(1024);
      expect(attestation.triggeredBy?.type).toBe('retention');
      expect(attestation.triggeredBy?.ruleName).toBe('90-day-retention');
    });
  });

  describe('createManualDeletionAttestation', () => {
    it('creates attestation for user-requested deletion', () => {
      const attestation = createManualDeletionAttestation(
        'Memory entry about personal health',
        'hashdef',
        256,
        'User requested removal of health information',
        snapshotId,
      );

      expect(attestation.type).toBe('manual');
      expect(attestation.category).toBe('UserRequest');
      expect(attestation.triggeredBy?.type).toBe('user-request');
      expect(attestation.reason).toContain('User requested');
    });
  });

  describe('Attestation Log Management', () => {
    it('creates empty log', () => {
      const log = createAttestationLog(snapshotId);

      expect(log.version).toBe('1.0.0');
      expect(log.snapshotId).toBe(snapshotId);
      expect(log.count).toBe(0);
      expect(log.attestations).toHaveLength(0);
      expect(log.summary.totalBytesDeleted).toBe(0);
    });

    it('adds attestations and updates summary', () => {
      let log = createAttestationLog(snapshotId);

      const piiMatches: PIIMatch[] = [
        { type: 'email', start: 0, end: 15, originalHash: 'abc', confidence: 0.9 },
      ];
      const att1 = createPIIAttestation(piiMatches, 'test@email.com', snapshotId);
      log = addAttestation(log, att1);

      expect(log.count).toBe(1);
      expect(log.summary.byType['redaction']).toBe(1);
      expect(log.summary.totalBytesDeleted).toBe(15);

      const att2 = createManualDeletionAttestation('test', 'hash', 100, 'reason', snapshotId);
      log = addAttestation(log, att2);

      expect(log.count).toBe(2);
      expect(log.summary.byType['manual']).toBe(1);
      expect(log.summary.totalBytesDeleted).toBe(115);
    });

    it('finalizes log with Merkle root', () => {
      let log = createAttestationLog(snapshotId);

      const att1 = createManualDeletionAttestation('item1', 'hash1', 50, 'r1', snapshotId);
      const att2 = createManualDeletionAttestation('item2', 'hash2', 50, 'r2', snapshotId);

      log = addAttestation(log, att1);
      log = addAttestation(log, att2);

      const finalized = finalizeAttestationLog(log);

      expect(finalized.proof).toBeDefined();
      expect(finalized.proof.merkleRoot).toBeDefined();
      expect(finalized.proof.merkleRoot.length).toBe(64); // SHA-256 hex
    });
  });

  describe('verifyAttestationLog', () => {
    it('validates consistent log', () => {
      let log = createAttestationLog(snapshotId);
      log = addAttestation(log, createManualDeletionAttestation('x', 'h', 10, 'r', snapshotId));
      const finalized = finalizeAttestationLog(log);

      const result = verifyAttestationLog(finalized);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects count mismatch', () => {
      let log = createAttestationLog(snapshotId);
      log = addAttestation(log, createManualDeletionAttestation('x', 'h', 10, 'r', snapshotId));

      // Manually corrupt the count
      const corrupted = { ...log, count: 5 };
      const result = verifyAttestationLog(corrupted);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Count mismatch');
    });

    it('detects tampered Merkle root', () => {
      let log = createAttestationLog(snapshotId);
      log = addAttestation(log, createManualDeletionAttestation('x', 'h', 10, 'r', snapshotId));
      const finalized = finalizeAttestationLog(log);

      // Tamper with Merkle root
      const tampered = {
        ...finalized,
        proof: { merkleRoot: 'deadbeef'.repeat(8) },
      };

      const result = verifyAttestationLog(tampered);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Merkle root mismatch');
    });
  });

  describe('summarizeAttestations', () => {
    it('generates human-readable summary', () => {
      let log = createAttestationLog(snapshotId);

      const piiMatches: PIIMatch[] = [
        { type: 'email', start: 0, end: 15, originalHash: 'abc', confidence: 0.9 },
      ];
      log = addAttestation(log, createPIIAttestation(piiMatches, 'test@email.com', snapshotId));
      log = addAttestation(log, createManualDeletionAttestation('data', 'h', 500, 'user req', snapshotId));

      const summary = summarizeAttestations(log);

      expect(summary).toContain('Deletion Attestation Summary');
      expect(summary).toContain(snapshotId);
      expect(summary).toContain('Total Attestations: 2');
      expect(summary).toContain('redaction: 1');
      expect(summary).toContain('manual: 1');
    });
  });
});
