/**
 * Checkpoint Ledger Core
 * 
 * Implements the append-only, hash-linked checkpoint ledger.
 * Provides deterministic checkpoint creation and retrieval.
 */

import { createHash, randomUUID } from 'crypto';
import {
  Checkpoint,
  CheckpointStorage,
  CreateCheckpointInput,
  Namespace,
  namespaceKey,
  ListOptions,
} from './types.js';

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Compute deterministic hash of checkpoint contents.
 * Used for integrity verification and parent linking.
 */
export function computeCheckpointHash(checkpoint: Omit<Checkpoint, 'state_hash'>): string {
  const hashInput = JSON.stringify({
    checkpoint_id: checkpoint.checkpoint_id,
    parent_checkpoint_id: checkpoint.parent_checkpoint_id,
    namespace: checkpoint.namespace,
    run_id: checkpoint.run_id,
    step_index: checkpoint.step_index,
    goal_stack: checkpoint.goal_stack,
    pending_actions: checkpoint.pending_actions,
    tool_state: checkpoint.tool_state,
    policy_flags: checkpoint.policy_flags,
    unresolved_tasks: checkpoint.unresolved_tasks,
    memory_refs: checkpoint.memory_refs,
    created_at: checkpoint.created_at,
    writer_id: checkpoint.writer_id,
    schema_version: checkpoint.schema_version,
  });
  
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Verify checkpoint integrity by recomputing hash.
 */
export function verifyCheckpointIntegrity(checkpoint: Checkpoint): boolean {
  const computed = computeCheckpointHash(checkpoint);
  return computed === checkpoint.state_hash;
}

/**
 * Verify checkpoint chain integrity from checkpoint back to genesis (or specified ancestor).
 */
export async function verifyChainIntegrity(
  checkpoint: Checkpoint,
  storage: CheckpointStorage,
  stopAtCheckpointId?: string
): Promise<{ valid: boolean; brokenAt?: string; error?: string }> {
  let current: Checkpoint | null = checkpoint;
  
  while (current) {
    // Verify current checkpoint
    if (!verifyCheckpointIntegrity(current)) {
      return {
        valid: false,
        brokenAt: current.checkpoint_id,
        error: `Hash mismatch for checkpoint ${current.checkpoint_id}`,
      };
    }
    
    // Stop if we've reached the requested ancestor
    if (stopAtCheckpointId && current.checkpoint_id === stopAtCheckpointId) {
      break;
    }
    
    // Stop if we've reached genesis
    if (!current.parent_checkpoint_id) {
      break;
    }
    
    // Fetch parent
    const parent = await storage.getCheckpoint(current.parent_checkpoint_id);
    if (!parent) {
      return {
        valid: false,
        brokenAt: current.checkpoint_id,
        error: `Missing parent checkpoint ${current.parent_checkpoint_id}`,
      };
    }
    
    current = parent;
  }
  
  return { valid: true };
}

/**
 * Checkpoint Ledger
 * 
 * Main service for checkpoint management.
 */
export class CheckpointLedger {
  constructor(private storage: CheckpointStorage) {}

  /**
   * Create a new checkpoint.
   * Automatically links to parent and computes integrity hash.
   */
  async createCheckpoint(input: CreateCheckpointInput): Promise<Checkpoint> {
    // Get latest checkpoint to determine parent and step index
    const latest = await this.storage.getLatestCheckpoint(input.namespace, input.run_id);
    
    const checkpoint_id = randomUUID();
    const created_at = new Date().toISOString();
    const step_index = latest ? latest.step_index + 1 : 0;
    const parent_checkpoint_id = latest?.checkpoint_id ?? null;
    
    // Build checkpoint without hash
    const checkpointWithoutHash: Omit<Checkpoint, 'state_hash'> = {
      checkpoint_id,
      parent_checkpoint_id,
      namespace: input.namespace,
      run_id: input.run_id,
      step_index,
      goal_stack: input.goal_stack ?? [],
      pending_actions: input.pending_actions ?? [],
      tool_state: input.tool_state ?? {},
      policy_flags: input.policy_flags ?? [],
      unresolved_tasks: input.unresolved_tasks ?? [],
      memory_refs: input.memory_refs ?? [],
      created_at,
      writer_id: input.writer_id,
      schema_version: CURRENT_SCHEMA_VERSION,
    };
    
    // Compute integrity hash
    const state_hash = computeCheckpointHash(checkpointWithoutHash);
    
    const checkpoint: Checkpoint = {
      ...checkpointWithoutHash,
      state_hash,
    };
    
    // Persist
    await this.storage.saveCheckpoint(checkpoint);
    
    // Audit log
    await this.storage.logAudit({
      namespace: input.namespace,
      action: 'create',
      resource_type: 'checkpoint',
      resource_id: checkpoint_id,
      actor_id: input.writer_id,
    });
    
    return checkpoint;
  }

  /**
   * Get a checkpoint by ID.
   * Optionally verify integrity.
   */
  async getCheckpoint(
    checkpoint_id: string,
    options?: { verify?: boolean }
  ): Promise<Checkpoint | null> {
    const checkpoint = await this.storage.getCheckpoint(checkpoint_id);
    
    if (!checkpoint) {
      return null;
    }
    
    if (options?.verify && !verifyCheckpointIntegrity(checkpoint)) {
      throw new Error(`Checkpoint ${checkpoint_id} failed integrity verification`);
    }
    
    return checkpoint;
  }

  /**
   * Get the latest checkpoint for a namespace.
   */
  async getLatestCheckpoint(
    namespace: Namespace,
    run_id?: string
  ): Promise<Checkpoint | null> {
    return this.storage.getLatestCheckpoint(namespace, run_id);
  }

  /**
   * List checkpoints for a namespace.
   */
  async listCheckpoints(
    namespace: Namespace,
    options?: ListOptions
  ): Promise<Checkpoint[]> {
    return this.storage.listCheckpoints(namespace, options);
  }

  /**
   * Get the full chain of checkpoints from a given checkpoint back to genesis.
   */
  async getCheckpointChain(checkpoint_id: string): Promise<Checkpoint[]> {
    const chain: Checkpoint[] = [];
    let current = await this.storage.getCheckpoint(checkpoint_id);
    
    while (current) {
      chain.push(current);
      if (!current.parent_checkpoint_id) {
        break;
      }
      current = await this.storage.getCheckpoint(current.parent_checkpoint_id);
    }
    
    return chain;
  }

  /**
   * Verify the integrity of the checkpoint chain.
   */
  async verifyChain(
    checkpoint_id: string,
    stopAtCheckpointId?: string
  ): Promise<{ valid: boolean; brokenAt?: string; error?: string }> {
    const checkpoint = await this.storage.getCheckpoint(checkpoint_id);
    if (!checkpoint) {
      return { valid: false, error: `Checkpoint ${checkpoint_id} not found` };
    }
    return verifyChainIntegrity(checkpoint, this.storage, stopAtCheckpointId);
  }

  /**
   * Fork a new run from an existing checkpoint.
   * Creates a new checkpoint in a new run linked to the source checkpoint.
   */
  async forkRun(
    source_checkpoint_id: string,
    new_run_id: string,
    writer_id: string
  ): Promise<Checkpoint> {
    const source = await this.storage.getCheckpoint(source_checkpoint_id);
    if (!source) {
      throw new Error(`Source checkpoint ${source_checkpoint_id} not found`);
    }
    
    // Create new checkpoint in new run, linking to source
    const checkpoint_id = randomUUID();
    const created_at = new Date().toISOString();
    
    const checkpointWithoutHash: Omit<Checkpoint, 'state_hash'> = {
      checkpoint_id,
      parent_checkpoint_id: source_checkpoint_id, // Link to source
      namespace: source.namespace,
      run_id: new_run_id,
      step_index: 0, // Reset step index for new run
      goal_stack: [...source.goal_stack],
      pending_actions: [...source.pending_actions],
      tool_state: { ...source.tool_state },
      policy_flags: [...source.policy_flags],
      unresolved_tasks: [...source.unresolved_tasks],
      memory_refs: [...source.memory_refs],
      created_at,
      writer_id,
      schema_version: CURRENT_SCHEMA_VERSION,
    };
    
    const state_hash = computeCheckpointHash(checkpointWithoutHash);
    
    const checkpoint: Checkpoint = {
      ...checkpointWithoutHash,
      state_hash,
    };
    
    await this.storage.saveCheckpoint(checkpoint);
    
    await this.storage.logAudit({
      namespace: source.namespace,
      action: 'create',
      resource_type: 'checkpoint',
      resource_id: checkpoint_id,
      actor_id: writer_id,
      metadata: { forked_from: source_checkpoint_id },
    });
    
    return checkpoint;
  }
}
