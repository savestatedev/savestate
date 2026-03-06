import { randomUUID } from 'node:crypto';

export type CommitmentType = 
  | 'customer_promise' 
  | 'ticket_status_change' 
  | 'escalation_closure' 
  | 'account_tool_write';

export type Criticality = 'c1' | 'c2' | 'c3';

export type CommitmentState = 'proposed' | 'verified' | 'active' | 'fulfilled' | 'rejected' | 'expired';

export interface Commitment {
  id: string;
  type: CommitmentType;
  criticality: Criticality;
  state: CommitmentState;
  description: string;
  proposedAt: string;
  verifiedAt?: string;
  activeAt?: string;
  fulfilledAt?: string;
  rejectedAt?: string;
  expiresAt?: string;
  proposer: string;
  verifier?: string;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details?: string;
}

export interface VerificationMethod {
  type: 'automatic' | 'manual' | 'threshold';
  config: Record<string, any>;
}

// In-memory store for commitments (in a real app, this would be in a database)
const commitments = new Map<string, Commitment>();

/**
 * Propose a new commitment.
 */
export function proposeCommitment(params: {
  type: CommitmentType;
  criticality: Criticality;
  description: string;
  proposer: string;
  expiresAt?: string;
  verificationMethod?: VerificationMethod;
}): Commitment {
  const commitment: Commitment = {
    id: randomUUID(),
    type: params.type,
    criticality: params.criticality,
    state: 'proposed',
    description: params.description,
    proposedAt: new Date().toISOString(),
    proposer: params.proposer,
    expiresAt: params.expiresAt,
    auditTrail: [
      {
        timestamp: new Date().toISOString(),
        action: 'proposed',
        actor: params.proposer,
        details: `Commitment proposed with criticality ${params.criticality}`,
      },
    ],
  };

  commitments.set(commitment.id, commitment);
  return commitment;
}

/**
 * Verify a commitment.
 */
export function verifyCommitment(id: string, verifier: string, approved: boolean): Commitment | null {
  const commitment = commitments.get(id);
  if (!commitment) return null;

  if (approved) {
    commitment.state = 'verified';
    commitment.verifiedAt = new Date().toISOString();
    commitment.verifier = verifier;
    commitment.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'verified',
      actor: verifier,
      details: 'Commitment verified',
    });
  } else {
    commitment.state = 'rejected';
    commitment.rejectedAt = new Date().toISOString();
    commitment.verifier = verifier;
    commitment.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'rejected',
      actor: verifier,
      details: 'Commitment rejected',
    });
  }

  return commitment;
}

/**
 * Gate a high-impact action. Returns true if the action is allowed, false if blocked.
 */
export function gateAction(actionType: CommitmentType): { allowed: boolean; reason?: string } {
  // C3 (critical) actions require active commitments
  if (actionType === 'customer_promise' || actionType === 'escalation_closure') {
    // Check for any active commitments of the same type
    const active = Array.from(commitments.values()).filter(
      (c) => c.type === actionType && c.state === 'active'
    );

    if (active.length === 0) {
      return {
        allowed: false,
        reason: `No active commitment found for action type: ${actionType}. This action requires explicit authorization.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Get audit trail for a commitment.
 */
export function getAuditTrail(id: string): AuditEntry[] {
  const commitment = commitments.get(id);
  return commitment?.auditTrail || [];
}

/**
 * Get all commitments (for debugging/listing).
 */
export function listCommitments(): Commitment[] {
  return Array.from(commitments.values());
}
