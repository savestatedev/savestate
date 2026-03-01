/**
 * Containment Controls - Memory Integrity Grid
 *
 * Response actions when memory poisoning is detected.
 * Provides quarantine, agent pause, and audit trail capabilities.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';
import type { IntegrityIncident, IncidentSeverity } from './tripwire.js';

// ─── Types ───────────────────────────────────────────────────

/**
 * Containment policy determining automatic vs manual response.
 */
export type ContainmentPolicy = 'observe' | 'approve' | 'auto';

/**
 * Type of containment action.
 */
export type ContainmentActionType =
  | 'quarantine_memory'
  | 'quarantine_agent'
  | 'release_memory'
  | 'release_agent'
  | 'escalate'
  | 'dismiss';

/**
 * Status of a quarantined item.
 */
export type QuarantineStatus = 'active' | 'released' | 'deleted';

/**
 * A containment event in the audit trail.
 */
export interface ContainmentEvent {
  /** Unique event identifier */
  id: string;

  /** Action taken */
  action: ContainmentActionType;

  /** Target ID (memory_id or agent_id) */
  target_id: string;

  /** Target type */
  target_type: 'memory' | 'agent';

  /** ISO timestamp */
  timestamp: string;

  /** Policy that triggered this action */
  policy: ContainmentPolicy;

  /** User who initiated (if manual) */
  initiated_by?: string;

  /** Related incident ID */
  incident_id?: string;

  /** Reason for the action */
  reason: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A quarantined memory.
 */
export interface QuarantinedMemory {
  /** Original memory ID */
  memory_id: string;

  /** Quarantine record ID */
  quarantine_id: string;

  /** ISO timestamp when quarantined */
  quarantined_at: string;

  /** Reason for quarantine */
  reason: string;

  /** Related incident ID */
  incident_id?: string;

  /** Current status */
  status: QuarantineStatus;

  /** ISO timestamp when released (if applicable) */
  released_at?: string;

  /** User who released (if applicable) */
  released_by?: string;

  /** Original memory content (preserved) */
  original_content?: string;

  /** Tenant ID */
  tenant_id: string;
}

/**
 * A quarantined agent.
 */
export interface QuarantinedAgent {
  /** Agent ID */
  agent_id: string;

  /** Quarantine record ID */
  quarantine_id: string;

  /** ISO timestamp when quarantined */
  quarantined_at: string;

  /** Reason for quarantine */
  reason: string;

  /** Related incident ID */
  incident_id?: string;

  /** Current status */
  status: QuarantineStatus;

  /** ISO timestamp when released (if applicable) */
  released_at?: string;

  /** User who released (if applicable) */
  released_by?: string;

  /** Tenant ID */
  tenant_id: string;

  /** Operations blocked during quarantine */
  blocked_operations: string[];
}

/**
 * Containment configuration.
 */
export interface ContainmentConfig {
  /** Default policy */
  policy: ContainmentPolicy;

  /** Auto-quarantine severity threshold */
  auto_quarantine_threshold: IncidentSeverity;

  /** Auto-escalate to agent quarantine for critical incidents */
  auto_escalate_critical: boolean;

  /** Maximum time in quarantine before forced review (hours) */
  max_quarantine_hours: number;

  /** Enable notifications */
  notifications_enabled: boolean;
}

/**
 * Containment action result.
 */
export interface ContainmentResult {
  /** Whether action was successful */
  success: boolean;

  /** The containment event */
  event: ContainmentEvent;

  /** Error message if failed */
  error?: string;

  /** Whether action was auto-applied or requires approval */
  requires_approval: boolean;
}

/**
 * Containment status summary.
 */
export interface ContainmentStatus {
  /** Current policy */
  policy: ContainmentPolicy;

  /** Number of quarantined memories */
  quarantined_memories: number;

  /** Number of quarantined agents */
  quarantined_agents: number;

  /** Recent containment events */
  recent_events: ContainmentEvent[];

  /** Pending approvals */
  pending_approvals: number;

  /** ISO timestamp of last action */
  last_action_at?: string;
}

// ─── Default Configuration ───────────────────────────────────

export const DEFAULT_CONTAINMENT_CONFIG: ContainmentConfig = {
  policy: 'approve',
  auto_quarantine_threshold: 'high',
  auto_escalate_critical: true,
  max_quarantine_hours: 24,
  notifications_enabled: true,
};

// ─── Containment Store ───────────────────────────────────────

const CONTAINMENT_FILE = 'containment.json';

interface ContainmentStore {
  quarantined_memories: QuarantinedMemory[];
  quarantined_agents: QuarantinedAgent[];
  events: ContainmentEvent[];
  pending_approvals: PendingApproval[];
  config: ContainmentConfig;
  version: string;
}

interface PendingApproval {
  id: string;
  action: ContainmentActionType;
  target_id: string;
  target_type: 'memory' | 'agent';
  reason: string;
  incident_id?: string;
  created_at: string;
  tenant_id: string;
}

async function loadContainment(cwd?: string): Promise<ContainmentStore> {
  const dir = localConfigDir(cwd);
  const path = join(dir, CONTAINMENT_FILE);

  if (!existsSync(path)) {
    return {
      quarantined_memories: [],
      quarantined_agents: [],
      events: [],
      pending_approvals: [],
      config: DEFAULT_CONTAINMENT_CONFIG,
      version: '1.0.0',
    };
  }

  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as ContainmentStore;
}

async function saveContainment(store: ContainmentStore, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = join(dir, CONTAINMENT_FILE);
  await writeFile(path, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

// ─── Severity Comparison ─────────────────────────────────────

const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function severityMeetsThreshold(
  severity: IncidentSeverity,
  threshold: IncidentSeverity,
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

// ─── Containment Controller ──────────────────────────────────

export class ContainmentController {
  private cwd?: string;

  constructor(cwd?: string) {
    this.cwd = cwd;
  }

  /**
   * Quarantine a suspicious memory.
   */
  async quarantineMemory(
    memory_id: string,
    reason: string,
    options?: {
      incident_id?: string;
      initiated_by?: string;
      tenant_id?: string;
      original_content?: string;
      force?: boolean;
    },
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);
    const policy = store.config.policy;
    const tenant_id = options?.tenant_id ?? 'default';

    // Check if already quarantined
    const existing = store.quarantined_memories.find(
      qm => qm.memory_id === memory_id && qm.status === 'active'
    );
    if (existing) {
      return {
        success: false,
        event: this.createEvent('quarantine_memory', memory_id, 'memory', reason, policy, options),
        error: 'Memory is already quarantined',
        requires_approval: false,
      };
    }

    // If policy is 'approve' and not forced, add to pending
    if (policy === 'approve' && !options?.force) {
      const approval: PendingApproval = {
        id: `pa_${randomUUID().slice(0, 12)}`,
        action: 'quarantine_memory',
        target_id: memory_id,
        target_type: 'memory',
        reason,
        incident_id: options?.incident_id,
        created_at: new Date().toISOString(),
        tenant_id,
      };
      store.pending_approvals.push(approval);
      await saveContainment(store, this.cwd);

      return {
        success: true,
        event: this.createEvent('quarantine_memory', memory_id, 'memory', reason, policy, options),
        requires_approval: true,
      };
    }

    // If policy is 'observe', just record the event
    if (policy === 'observe') {
      const event = this.createEvent('quarantine_memory', memory_id, 'memory', reason, policy, options);
      store.events.push(event);
      await saveContainment(store, this.cwd);

      return {
        success: true,
        event,
        requires_approval: false,
      };
    }

    // Auto or forced: apply quarantine
    const quarantine: QuarantinedMemory = {
      memory_id,
      quarantine_id: `qm_${randomUUID().slice(0, 12)}`,
      quarantined_at: new Date().toISOString(),
      reason,
      incident_id: options?.incident_id,
      status: 'active',
      original_content: options?.original_content,
      tenant_id,
    };

    const event = this.createEvent('quarantine_memory', memory_id, 'memory', reason, policy, options);
    store.quarantined_memories.push(quarantine);
    store.events.push(event);
    await saveContainment(store, this.cwd);

    return {
      success: true,
      event,
      requires_approval: false,
    };
  }

  /**
   * Quarantine an agent (pause operations).
   */
  async quarantineAgent(
    agent_id: string,
    reason: string,
    options?: {
      incident_id?: string;
      initiated_by?: string;
      tenant_id?: string;
      blocked_operations?: string[];
      force?: boolean;
    },
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);
    const policy = store.config.policy;
    const tenant_id = options?.tenant_id ?? 'default';

    // Check if already quarantined
    const existing = store.quarantined_agents.find(
      qa => qa.agent_id === agent_id && qa.status === 'active'
    );
    if (existing) {
      return {
        success: false,
        event: this.createEvent('quarantine_agent', agent_id, 'agent', reason, policy, options),
        error: 'Agent is already quarantined',
        requires_approval: false,
      };
    }

    // If policy is 'approve' and not forced, add to pending
    if (policy === 'approve' && !options?.force) {
      const approval: PendingApproval = {
        id: `pa_${randomUUID().slice(0, 12)}`,
        action: 'quarantine_agent',
        target_id: agent_id,
        target_type: 'agent',
        reason,
        incident_id: options?.incident_id,
        created_at: new Date().toISOString(),
        tenant_id,
      };
      store.pending_approvals.push(approval);
      await saveContainment(store, this.cwd);

      return {
        success: true,
        event: this.createEvent('quarantine_agent', agent_id, 'agent', reason, policy, options),
        requires_approval: true,
      };
    }

    // If policy is 'observe', just record the event
    if (policy === 'observe') {
      const event = this.createEvent('quarantine_agent', agent_id, 'agent', reason, policy, options);
      store.events.push(event);
      await saveContainment(store, this.cwd);

      return {
        success: true,
        event,
        requires_approval: false,
      };
    }

    // Auto or forced: apply quarantine
    const quarantine: QuarantinedAgent = {
      agent_id,
      quarantine_id: `qa_${randomUUID().slice(0, 12)}`,
      quarantined_at: new Date().toISOString(),
      reason,
      incident_id: options?.incident_id,
      status: 'active',
      tenant_id,
      blocked_operations: options?.blocked_operations ?? ['write', 'execute', 'external_api'],
    };

    const event = this.createEvent('quarantine_agent', agent_id, 'agent', reason, policy, options);
    store.quarantined_agents.push(quarantine);
    store.events.push(event);
    await saveContainment(store, this.cwd);

    return {
      success: true,
      event,
      requires_approval: false,
    };
  }

  /**
   * Release a memory from quarantine.
   */
  async releaseMemory(
    memory_id: string,
    reason: string,
    released_by?: string,
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);

    const quarantine = store.quarantined_memories.find(
      qm => qm.memory_id === memory_id && qm.status === 'active'
    );

    if (!quarantine) {
      return {
        success: false,
        event: this.createEvent('release_memory', memory_id, 'memory', reason, store.config.policy, {
          initiated_by: released_by,
        }),
        error: 'Memory is not in quarantine',
        requires_approval: false,
      };
    }

    quarantine.status = 'released';
    quarantine.released_at = new Date().toISOString();
    quarantine.released_by = released_by;

    const event = this.createEvent('release_memory', memory_id, 'memory', reason, store.config.policy, {
      initiated_by: released_by,
    });
    store.events.push(event);
    await saveContainment(store, this.cwd);

    return {
      success: true,
      event,
      requires_approval: false,
    };
  }

  /**
   * Release an agent from quarantine.
   */
  async releaseAgent(
    agent_id: string,
    reason: string,
    released_by?: string,
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);

    const quarantine = store.quarantined_agents.find(
      qa => qa.agent_id === agent_id && qa.status === 'active'
    );

    if (!quarantine) {
      return {
        success: false,
        event: this.createEvent('release_agent', agent_id, 'agent', reason, store.config.policy, {
          initiated_by: released_by,
        }),
        error: 'Agent is not in quarantine',
        requires_approval: false,
      };
    }

    quarantine.status = 'released';
    quarantine.released_at = new Date().toISOString();
    quarantine.released_by = released_by;

    const event = this.createEvent('release_agent', agent_id, 'agent', reason, store.config.policy, {
      initiated_by: released_by,
    });
    store.events.push(event);
    await saveContainment(store, this.cwd);

    return {
      success: true,
      event,
      requires_approval: false,
    };
  }

  /**
   * Approve a pending containment action.
   */
  async approveAction(
    approval_id: string,
    approved_by: string,
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);
    const approvalIndex = store.pending_approvals.findIndex(pa => pa.id === approval_id);

    if (approvalIndex === -1) {
      return {
        success: false,
        event: this.createEvent('dismiss', approval_id, 'memory', 'Approval not found', store.config.policy, {
          initiated_by: approved_by,
        }),
        error: 'Pending approval not found',
        requires_approval: false,
      };
    }

    const approval = store.pending_approvals[approvalIndex];
    store.pending_approvals.splice(approvalIndex, 1);
    await saveContainment(store, this.cwd);

    // Now execute the actual action with force=true
    if (approval.action === 'quarantine_memory') {
      return this.quarantineMemory(approval.target_id, approval.reason, {
        incident_id: approval.incident_id,
        initiated_by: approved_by,
        tenant_id: approval.tenant_id,
        force: true,
      });
    } else if (approval.action === 'quarantine_agent') {
      return this.quarantineAgent(approval.target_id, approval.reason, {
        incident_id: approval.incident_id,
        initiated_by: approved_by,
        tenant_id: approval.tenant_id,
        force: true,
      });
    }

    return {
      success: false,
      event: this.createEvent('dismiss', approval_id, approval.target_type, 'Unknown action type', store.config.policy, {
        initiated_by: approved_by,
      }),
      error: 'Unknown action type',
      requires_approval: false,
    };
  }

  /**
   * Dismiss a pending approval.
   */
  async dismissApproval(
    approval_id: string,
    dismissed_by: string,
    reason?: string,
  ): Promise<ContainmentResult> {
    const store = await loadContainment(this.cwd);
    const approvalIndex = store.pending_approvals.findIndex(pa => pa.id === approval_id);

    if (approvalIndex === -1) {
      return {
        success: false,
        event: this.createEvent('dismiss', approval_id, 'memory', 'Approval not found', store.config.policy, {
          initiated_by: dismissed_by,
        }),
        error: 'Pending approval not found',
        requires_approval: false,
      };
    }

    const approval = store.pending_approvals[approvalIndex];
    store.pending_approvals.splice(approvalIndex, 1);

    const event = this.createEvent('dismiss', approval.target_id, approval.target_type, reason ?? 'Dismissed by user', store.config.policy, {
      initiated_by: dismissed_by,
    });
    store.events.push(event);
    await saveContainment(store, this.cwd);

    return {
      success: true,
      event,
      requires_approval: false,
    };
  }

  /**
   * Handle incident with automatic containment based on policy.
   */
  async handleIncident(incident: IntegrityIncident): Promise<ContainmentResult[]> {
    const store = await loadContainment(this.cwd);
    const results: ContainmentResult[] = [];

    // Determine if auto-quarantine should trigger
    const shouldAutoQuarantine = store.config.policy === 'auto' &&
      severityMeetsThreshold(incident.severity, store.config.auto_quarantine_threshold);

    // Extract memory IDs from events
    const memoryIds = new Set<string>();
    for (const event of incident.events) {
      if (event.context.memory_id) {
        memoryIds.add(event.context.memory_id);
      }
    }

    // Quarantine affected memories
    for (const memory_id of memoryIds) {
      const result = await this.quarantineMemory(
        memory_id,
        `Automatic quarantine: ${incident.type} incident ${incident.id}`,
        {
          incident_id: incident.id,
          tenant_id: incident.tenant_id,
          force: shouldAutoQuarantine,
        },
      );
      results.push(result);
    }

    // For critical incidents, also quarantine agent if configured
    if (incident.severity === 'critical' && store.config.auto_escalate_critical) {
      const agent_id = incident.events[0]?.context.session_id ?? 'default_agent';
      const result = await this.quarantineAgent(
        agent_id,
        `Critical incident escalation: ${incident.id}`,
        {
          incident_id: incident.id,
          tenant_id: incident.tenant_id,
          force: shouldAutoQuarantine,
        },
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Check if a memory is quarantined.
   */
  async isMemoryQuarantined(memory_id: string): Promise<boolean> {
    const store = await loadContainment(this.cwd);
    return store.quarantined_memories.some(
      qm => qm.memory_id === memory_id && qm.status === 'active'
    );
  }

  /**
   * Check if an agent is quarantined.
   */
  async isAgentQuarantined(agent_id: string): Promise<boolean> {
    const store = await loadContainment(this.cwd);
    return store.quarantined_agents.some(
      qa => qa.agent_id === agent_id && qa.status === 'active'
    );
  }

  /**
   * Get containment status summary.
   */
  async getStatus(): Promise<ContainmentStatus> {
    const store = await loadContainment(this.cwd);
    const recent = store.events.slice(-10).reverse();

    return {
      policy: store.config.policy,
      quarantined_memories: store.quarantined_memories.filter(qm => qm.status === 'active').length,
      quarantined_agents: store.quarantined_agents.filter(qa => qa.status === 'active').length,
      recent_events: recent,
      pending_approvals: store.pending_approvals.length,
      last_action_at: recent[0]?.timestamp,
    };
  }

  /**
   * Update containment configuration.
   */
  async updateConfig(config: Partial<ContainmentConfig>): Promise<ContainmentConfig> {
    const store = await loadContainment(this.cwd);
    store.config = { ...store.config, ...config };
    await saveContainment(store, this.cwd);
    return store.config;
  }

  /**
   * Create a containment event.
   */
  private createEvent(
    action: ContainmentActionType,
    target_id: string,
    target_type: 'memory' | 'agent',
    reason: string,
    policy: ContainmentPolicy,
    options?: {
      incident_id?: string;
      initiated_by?: string;
      metadata?: Record<string, unknown>;
    },
  ): ContainmentEvent {
    return {
      id: `ce_${randomUUID().slice(0, 12)}`,
      action,
      target_id,
      target_type,
      timestamp: new Date().toISOString(),
      policy,
      initiated_by: options?.initiated_by,
      incident_id: options?.incident_id,
      reason,
      metadata: options?.metadata,
    };
  }
}

// ─── Module-Level Functions ──────────────────────────────────

/**
 * Get all quarantined memories.
 */
export async function getQuarantinedMemories(
  status?: QuarantineStatus,
  cwd?: string,
): Promise<QuarantinedMemory[]> {
  const store = await loadContainment(cwd);
  return status
    ? store.quarantined_memories.filter(qm => qm.status === status)
    : store.quarantined_memories;
}

/**
 * Get all quarantined agents.
 */
export async function getQuarantinedAgents(
  status?: QuarantineStatus,
  cwd?: string,
): Promise<QuarantinedAgent[]> {
  const store = await loadContainment(cwd);
  return status
    ? store.quarantined_agents.filter(qa => qa.status === status)
    : store.quarantined_agents;
}

/**
 * Get all containment events.
 */
export async function getContainmentEvents(cwd?: string): Promise<ContainmentEvent[]> {
  const store = await loadContainment(cwd);
  return store.events;
}

/**
 * Get pending approvals.
 */
export async function getPendingApprovals(cwd?: string): Promise<PendingApproval[]> {
  const store = await loadContainment(cwd);
  return store.pending_approvals;
}

/**
 * Get containment configuration.
 */
export async function getContainmentConfig(cwd?: string): Promise<ContainmentConfig> {
  const store = await loadContainment(cwd);
  return store.config;
}
