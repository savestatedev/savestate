/**
 * Active Commitment Layer (ACL)
 * 
 * Enforces verified active commitments at action time with deterministic
 * conflict rules, human override paths, and audit traces.
 */

import { randomUUID } from 'crypto';

/**
 * Commitment criticality levels
 */
export enum Criticality {
  C1 = 'c1', // Low - informational only
  C2 = 'c2', // Medium - requires tracking
  C3 = 'c3', // High - requires verification
  C4 = 'c4', // Critical - requires explicit approval
}

/**
 * Commitment status
 */
export enum CommitmentStatus {
  PROPOSED = 'proposed',
  VERIFIED = 'verified',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  OVERRIDDEN = 'overridden',
}

/**
 * Verification method
 */
export enum VerificationMethod {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  AI_ANALYSIS = 'ai_analysis',
  WEBHOOK = 'webhook',
}

/**
 * Action types that can be gated
 */
export enum ActionType {
  CUSTOMER_PROMISE = 'customer_promise',
  TICKET_STATUS_CHANGE = 'ticket_status_change',
  ESCALATION_CLOSURE = 'escalation_closure',
  ACCOUNT_WRITE = 'account_write',
  EXTERNAL_API_CALL = 'external_api_call',
  STATE_MUTATION = 'state_mutation',
  DATA_EXPORT = 'data_export',
}

/**
 * Commitment schema
 */
export interface Commitment {
  /** Unique commitment ID */
  id: string;
  
  /** Commitment title/description */
  title: string;
  
  /** Detailed description */
  description?: string;
  
  /** Type of commitment */
  type: ActionType;
  
  /** Criticality level */
  criticality: Criticality;
  
  /** Current status */
  status: CommitmentStatus;
  
  /** Who made the commitment */
  owner: string;
  
  /** Target entity (customer ID, ticket ID, etc.) */
  target?: string;
  
  /** Commitment details */
  payload: Record<string, unknown>;
  
  /** Verification method */
  verificationMethod: VerificationMethod;
  
  /** Whether verified */
  verified: boolean;
  
  /** Who verified (if manual) */
  verifiedBy?: string;
  
  /** Verification timestamp */
  verifiedAt?: string;
  
  /** When commitment was made */
  createdAt: string;
  
  /** When commitment expires */
  expiresAt?: string;
  
  /** When commitment was completed */
  completedAt?: string;
  
  /** Override information */
  overriddenBy?: string;
  overrideReason?: string;
  overriddenAt?: string;
  
  /** Audit trail */
  auditTrail: AuditEntry[];
  
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Audit entry
 */
export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Gate decision
 */
export interface GateDecision {
  /** Whether action is allowed */
  allowed: boolean;
  
  /** Reason for decision */
  reason: string;
  
  /** Commitment ID if blocked */
  commitmentId?: string;
  
  /** Override allowed */
  overrideAllowed: boolean;
  
  /** Latency in ms */
  latencyMs: number;
  
  /** Audit entry */
  auditEntry: AuditEntry;
}

/**
 * Commitment proposal
 */
export interface CommitmentProposal {
  title: string;
  description?: string;
  type: ActionType;
  criticality: Criticality;
  owner: string;
  target?: string;
  payload: Record<string, unknown>;
  expiresInSeconds?: number;
  tags?: string[];
}

/**
 * Override request
 */
export interface OverrideRequest {
  commitmentId: string;
  actor: string;
  reason: string;
  bypassCriticality?: boolean;
}

/**
 * Commitment filter
 */
export interface CommitmentFilter {
  status?: CommitmentStatus[];
  type?: ActionType[];
  criticality?: Criticality[];
  owner?: string;
  target?: string;
  tags?: string[];
  fromDate?: string;
  toDate?: string;
}

/**
 * ACL Configuration
 */
export interface ACLConfig {
  /** Default expiration in seconds */
  defaultExpirationSeconds: number;
  
  /** Maximum commitments per owner */
  maxCommitmentsPerOwner: number;
  
  /** Enable automatic verification for C1 */
  autoVerifyC1: boolean;
  
  /** Enable automatic verification for C2 */
  autoVerifyC2: boolean;
  
  /** Require manual verification for C3+ */
  requireManualVerificationC3Plus: boolean;
  
  /** Enable overrides */
  allowOverrides: boolean;
  
  /** Override requires reason */
  overrideRequiresReason: boolean;
}

/**
 * Commitment conflict
 */
export interface CommitmentConflict {
  existingCommitment: Commitment;
  newCommitment: Commitment;
  conflictType: 'target_conflict' | 'type_conflict' | 'payload_conflict';
  resolution?: 'blocked' | 'requires_override' | 'allowed';
}

/**
 * Active Commitment Layer
 */
export class ActiveCommitmentLayer {
  private commitments: Map<string, Commitment> = new Map();
  private config: ACLConfig;

  constructor(config: Partial<ACLConfig> = {}) {
    this.config = {
      defaultExpirationSeconds: config.defaultExpirationSeconds ?? 30 * 24 * 60 * 60, // 30 days
      maxCommitmentsPerOwner: config.maxCommitmentsPerOwner ?? 100,
      autoVerifyC1: config.autoVerifyC1 ?? true,
      autoVerifyC2: config.autoVerifyC2 ?? false,
      requireManualVerificationC3Plus: config.requireManualVerificationC3Plus ?? true,
      allowOverrides: config.allowOverrides ?? true,
      overrideRequiresReason: config.overrideRequiresReason ?? true,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `commit_${randomUUID()}`;
  }

  /**
   * Create audit entry
   */
  private createAuditEntry(action: string, actor: string, details?: Record<string, unknown>): AuditEntry {
    return {
      id: this.generateId(),
      action,
      actor,
      timestamp: new Date().toISOString(),
      details,
    };
  }

  /**
   * Check if commitment is expired
   */
  private isExpired(commitment: Commitment): boolean {
    if (!commitment.expiresAt) return false;
    return new Date(commitment.expiresAt) < new Date();
  }

  /**
   * Update commitment status
   */
  private updateStatus(commitment: Commitment, status: CommitmentStatus, actor: string, details?: Record<string, unknown>): void {
    commitment.status = status;
    commitment.auditTrail.push(this.createAuditEntry(`status_change_${status}`, actor, details));
  }

  // ============ Public API ============

  /**
   * Propose a new commitment
   */
  propose(proposal: CommitmentProposal): { commitment: Commitment; conflicts: CommitmentConflict[] } {
    const startTime = Date.now();
    
    // Check max commitments per owner
    const ownerCommitments = Array.from(this.commitments.values())
      .filter(c => c.owner === proposal.owner && c.status === CommitmentStatus.ACTIVE);
    
    if (ownerCommitments.length >= this.config.maxCommitmentsPerOwner) {
      throw new Error(`Maximum commitments (${this.config.maxCommitmentsPerOwner}) reached for owner ${proposal.owner}`);
    }

    // Check for conflicts
    const conflicts = this.detectConflicts(proposal);

    // Determine initial status and verification
    let status = CommitmentStatus.PROPOSED;
    let verified = false;
    
    // Auto-verify based on criticality
    if (proposal.criticality === Criticality.C1 && this.config.autoVerifyC1) {
      status = CommitmentStatus.ACTIVE;
      verified = true;
    } else if (proposal.criticality === Criticality.C2 && this.config.autoVerifyC2) {
      status = CommitmentStatus.ACTIVE;
      verified = true;
    }

    const commitment: Commitment = {
      id: this.generateId(),
      title: proposal.title,
      description: proposal.description,
      type: proposal.type,
      criticality: proposal.criticality,
      status,
      owner: proposal.owner,
      target: proposal.target,
      payload: proposal.payload,
      verificationMethod: verified ? VerificationMethod.AUTOMATED : VerificationMethod.MANUAL,
      verified,
      createdAt: new Date().toISOString(),
      expiresAt: proposal.expiresInSeconds 
        ? new Date(Date.now() + proposal.expiresInSeconds * 1000).toISOString()
        : new Date(Date.now() + this.config.defaultExpirationSeconds * 1000).toISOString(),
      auditTrail: [
        this.createAuditEntry('proposed', proposal.owner, { criticality: proposal.criticality }),
      ],
      tags: proposal.tags,
    };

    this.commitments.set(commitment.id, commitment);

    return {
      commitment,
      conflicts,
    };
  }

  /**
   * Verify a commitment
   */
  verify(commitmentId: string, verifier: string, method: VerificationMethod = VerificationMethod.MANUAL): Commitment {
    const commitment = this.commitments.get(commitmentId);
    
    if (!commitment) {
      throw new Error(`Commitment ${commitmentId} not found`);
    }

    if (commitment.verified) {
      throw new Error(`Commitment ${commitmentId} already verified`);
    }

    commitment.verified = true;
    commitment.verifiedBy = verifier;
    commitment.verifiedAt = new Date().toISOString();
    commitment.verificationMethod = method;
    
    if (commitment.status === CommitmentStatus.PROPOSED) {
      this.updateStatus(commitment, CommitmentStatus.ACTIVE, verifier, { verifiedBy: verifier });
    }

    return commitment;
  }

  /**
   * Gate an action - check if commitment allows it
   */
  gate(actionType: ActionType, actor: string, target?: string, payload?: Record<string, unknown>): GateDecision {
    const startTime = Date.now();

    // Find active commitments that might conflict
    const activeCommitments = Array.from(this.commitments.values())
      .filter(c => c.status === CommitmentStatus.ACTIVE && !this.isExpired(c));

    // Check for blocking commitments
    for (const commitment of activeCommitments) {
      // Same target, different type
      if (commitment.target === target && commitment.type !== actionType) {
        const latencyMs = Date.now() - startTime;
        const auditEntry = this.createAuditEntry('gate_blocked', actor, { 
          commitmentId: commitment.id, 
          reason: 'target_conflict' 
        });
        
        return {
          allowed: false,
          reason: `Blocked by commitment ${commitment.id}: "${commitment.title}"`,
          commitmentId: commitment.id,
          overrideAllowed: this.config.allowOverrides,
          latencyMs,
          auditEntry,
        };
      }

      // Same type, conflicting payload
      if (commitment.type === actionType && commitment.target === target && payload) {
        // Simple conflict detection - in production would be more sophisticated
        const existingKeys = Object.keys(commitment.payload);
        const newKeys = Object.keys(payload);
        
        if (existingKeys.some(k => newKeys.includes(k) && commitment.payload[k] !== payload[k])) {
          const latencyMs = Date.now() - startTime;
          const auditEntry = this.createAuditEntry('gate_blocked', actor, { 
            commitmentId: commitment.id, 
            reason: 'payload_conflict' 
          });
          
          return {
            allowed: false,
            reason: `Payload conflict with commitment ${commitment.id}: "${commitment.title}"`,
            commitmentId: commitment.id,
            overrideAllowed: this.config.allowOverrides,
            latencyMs,
            auditEntry,
          };
        }
      }
    }

    // Check criticality for high-impact actions
    const highImpactTypes = [
      ActionType.CUSTOMER_PROMISE,
      ActionType.ESCALATION_CLOSURE,
      ActionType.ACCOUNT_WRITE,
    ];

    if (highImpactTypes.includes(actionType)) {
      // Check both active and proposed commitments
      const relevantCommitments = Array.from(this.commitments.values())
        .filter(c => 
          (c.status === CommitmentStatus.ACTIVE || c.status === CommitmentStatus.PROPOSED) && 
          !this.isExpired(c)
        );
      
      const matching = relevantCommitments.find(c => c.type === actionType && c.target === target);
      
      if (!matching) {
        const latencyMs = Date.now() - startTime;
        const auditEntry = this.createAuditEntry('gate_warning', actor, { 
          reason: 'no_matching_commitment',
          actionType 
        });
        
        return {
          allowed: true,
          reason: 'No matching commitment found - action allowed but not tracked',
          overrideAllowed: false,
          latencyMs,
          auditEntry,
        };
      }

      if (!matching.verified && matching.criticality >= Criticality.C3) {
        const latencyMs = Date.now() - startTime;
        const auditEntry = this.createAuditEntry('gate_blocked', actor, { 
          commitmentId: matching.id, 
          reason: 'unverified_c3' 
        });
        
        return {
          allowed: false,
          reason: `C3+ commitment ${matching.id} requires verification before action`,
          commitmentId: matching.id,
          overrideAllowed: this.config.allowOverrides,
          latencyMs,
          auditEntry,
        };
      }
    }

    const latencyMs = Date.now() - startTime;
    const auditEntry = this.createAuditEntry('gate_allowed', actor, { actionType, target });

    return {
      allowed: true,
      reason: 'Action allowed',
      overrideAllowed: false,
      latencyMs,
      auditEntry,
    };
  }

  /**
   * Override a gate decision
   */
  override(request: OverrideRequest): Commitment {
    if (!this.config.allowOverrides) {
      throw new Error('Overrides are not allowed');
    }

    if (this.config.overrideRequiresReason && !request.reason) {
      throw new Error('Override requires a reason');
    }

    const commitment = this.commitments.get(request.commitmentId);
    
    if (!commitment) {
      throw new Error(`Commitment ${request.commitmentId} not found`);
    }

    commitment.status = CommitmentStatus.OVERRIDDEN;
    commitment.overriddenBy = request.actor;
    commitment.overrideReason = request.reason;
    commitment.overriddenAt = new Date().toISOString();
    
    commitment.auditTrail.push(
      this.createAuditEntry('overridden', request.actor, { 
        reason: request.reason,
        bypassCriticality: request.bypassCriticality 
      })
    );

    return commitment;
  }

  /**
   * Get commitment by ID
   */
  get(commitmentId: string): Commitment | undefined {
    return this.commitments.get(commitmentId);
  }

  /**
   * List commitments with filters
   */
  list(filter: CommitmentFilter = {}): Commitment[] {
    let results = Array.from(this.commitments.values());

    if (filter.status?.length) {
      results = results.filter(c => filter.status!.includes(c.status));
    }

    if (filter.type?.length) {
      results = results.filter(c => filter.type!.includes(c.type));
    }

    if (filter.criticality?.length) {
      results = results.filter(c => filter.criticality!.includes(c.criticality));
    }

    if (filter.owner) {
      results = results.filter(c => c.owner === filter.owner);
    }

    if (filter.target) {
      results = results.filter(c => c.target === filter.target);
    }

    if (filter.tags?.length) {
      results = results.filter(c => 
        c.tags?.some(t => filter.tags!.includes(t))
      );
    }

    if (filter.fromDate) {
      results = results.filter(c => c.createdAt >= filter.fromDate!);
    }

    if (filter.toDate) {
      results = results.filter(c => c.createdAt <= filter.toDate!);
    }

    return results;
  }

  /**
   * Complete a commitment
   */
  complete(commitmentId: string, actor: string): Commitment {
    const commitment = this.commitments.get(commitmentId);
    
    if (!commitment) {
      throw new Error(`Commitment ${commitmentId} not found`);
    }

    this.updateStatus(commitment, CommitmentStatus.COMPLETED, actor);
    commitment.completedAt = new Date().toISOString();

    return commitment;
  }

  /**
   * Reject a commitment
   */
  reject(commitmentId: string, actor: string, reason: string): Commitment {
    const commitment = this.commitments.get(commitmentId);
    
    if (!commitment) {
      throw new Error(`Commitment ${commitmentId} not found`);
    }

    this.updateStatus(commitment, CommitmentStatus.REJECTED, actor, { reason });

    return commitment;
  }

  /**
   * Get audit trail for a commitment
   */
  getAuditTrail(commitmentId: string): AuditEntry[] {
    const commitment = this.commitments.get(commitmentId);
    return commitment?.auditTrail ?? [];
  }

  /**
   * Get all audit entries (global)
   */
  getGlobalAuditTrail(limit: number = 100): AuditEntry[] {
    const entries: AuditEntry[] = [];
    
    for (const commitment of this.commitments.values()) {
      entries.push(...commitment.auditTrail);
    }
    
    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    return entries.slice(0, limit);
  }

  /**
   * Detect potential conflicts with a proposal
   */
  private detectConflicts(proposal: CommitmentProposal): CommitmentConflict[] {
    const conflicts: CommitmentConflict[] = [];
    const active = Array.from(this.commitments.values())
      .filter(c => c.status === CommitmentStatus.ACTIVE && !this.isExpired(c));

    for (const existing of active) {
      // Same target
      if (existing.target === proposal.target) {
        conflicts.push({
          existingCommitment: existing,
          newCommitment: {} as Commitment, // Would need full commitment object
          conflictType: 'target_conflict',
        });
      }
    }

    return conflicts;
  }

  /**
   * Get configuration
   */
  getConfig(): ACLConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ACLConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default ActiveCommitmentLayer;
