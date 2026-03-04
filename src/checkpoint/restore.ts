/**
 * Restore API
 * 
 * Provides deterministic restore behavior for resuming agent execution.
 * Returns a ResumePack with checkpoint, unresolved tasks, memories, and rationale.
 */

import {
  CheckpointStorage,
  Checkpoint,
  MemoryResult,
  Namespace,
  ResumePack,
  RestoreOptions,
  RestoreRationale,
} from './types.js';
import { CheckpointLedger, verifyCheckpointIntegrity } from './ledger.js';
import { KnowledgeLane } from './memory.js';

/**
 * Restore Service
 * 
 * Handles checkpoint restoration with memory retrieval.
 */
export class RestoreService {
  private ledger: CheckpointLedger;
  private knowledge: KnowledgeLane;

  constructor(private storage: CheckpointStorage) {
    this.ledger = new CheckpointLedger(storage);
    this.knowledge = new KnowledgeLane(storage);
  }

  /**
   * Restore from a checkpoint and prepare resume pack.
   */
  async restore(options: RestoreOptions): Promise<ResumePack> {
    const { namespace, checkpoint_id, run_id, memory_query, max_memories = 10 } = options;
    
    // Step 1: Select checkpoint
    let checkpoint: Checkpoint | null;
    let checkpointSelectionReason: string;
    
    if (checkpoint_id) {
      checkpoint = await this.ledger.getCheckpoint(checkpoint_id);
      checkpointSelectionReason = `Explicitly requested checkpoint ${checkpoint_id}`;
    } else if (run_id) {
      checkpoint = await this.ledger.getLatestCheckpoint(namespace, run_id);
      checkpointSelectionReason = `Latest checkpoint from run ${run_id}`;
    } else {
      checkpoint = await this.ledger.getLatestCheckpoint(namespace);
      checkpointSelectionReason = 'Latest checkpoint in namespace';
    }
    
    if (!checkpoint) {
      throw new Error('No checkpoint found matching criteria');
    }
    
    // Step 2: Verify integrity
    if (!verifyCheckpointIntegrity(checkpoint)) {
      throw new Error(`Checkpoint ${checkpoint.checkpoint_id} failed integrity verification`);
    }
    
    // Step 3: Retrieve referenced memories
    const referencedMemories: MemoryResult[] = [];
    const memorySelectionReasons: string[] = [];
    
    if (checkpoint.memory_refs.length > 0) {
      const memories = await this.knowledge.getMemoriesByIds(checkpoint.memory_refs);
      for (const mem of memories) {
        referencedMemories.push({
          memory_id: mem.memory_id,
          score: 1.0, // Max score for directly referenced memories
          score_components: {
            task_criticality: mem.task_criticality,
            semantic_similarity: 1.0,
            importance: mem.importance,
            recency: 1.0,
          },
          content: mem.content,
          tags: mem.tags,
          source: mem.source,
          provenance: mem.provenance,
        });
      }
      memorySelectionReasons.push(
        `Included ${referencedMemories.length} directly referenced memories from checkpoint`
      );
    }
    
    // Step 4: Search for additional relevant memories if query provided
    const additionalMemories: MemoryResult[] = [];
    
    if (memory_query) {
      const searchResults = await this.knowledge.searchMemories({
        namespace,
        ...memory_query,
        limit: max_memories - referencedMemories.length,
      });
      
      // Filter out already-included memories
      const referencedIds = new Set(referencedMemories.map(m => m.memory_id));
      for (const result of searchResults) {
        if (!referencedIds.has(result.memory_id)) {
          additionalMemories.push(result);
        }
      }
      
      if (additionalMemories.length > 0) {
        memorySelectionReasons.push(
          `Retrieved ${additionalMemories.length} additional memories via search (query: ${memory_query.query ?? 'tags'})`
        );
      }
    }
    
    // Combine memories
    const allMemories = [...referencedMemories, ...additionalMemories];
    
    // Step 5: Build rationale
    const warnings: string[] = [];
    
    if (checkpoint.pending_actions.length > 0) {
      warnings.push(
        `${checkpoint.pending_actions.length} pending actions may need review before execution`
      );
    }
    
    if (checkpoint.unresolved_tasks.some(t => t.status === 'blocked')) {
      warnings.push('Some unresolved tasks are blocked');
    }
    
    const rationale: RestoreRationale = {
      checkpoint_selection: checkpointSelectionReason,
      memory_selection: memorySelectionReasons,
      warnings,
      evidence_refs: checkpoint.memory_refs,
    };
    
    // Step 6: Log audit
    await this.storage.logAudit({
      namespace,
      action: 'restore',
      resource_type: 'checkpoint',
      resource_id: checkpoint.checkpoint_id,
      actor_id: 'restore_service',
      metadata: {
        run_id: checkpoint.run_id,
        step_index: checkpoint.step_index,
        memory_count: allMemories.length,
      },
    });
    
    // Step 7: Return resume pack
    return {
      checkpoint,
      unresolved_tasks: checkpoint.unresolved_tasks,
      memories: allMemories,
      rationale,
      restored_at: new Date().toISOString(),
    };
  }

  /**
   * Get explainability log for a restore operation.
   * Shows why specific memories were selected and their scores.
   */
  async explainRestore(
    run_id: string,
    namespace: Namespace
  ): Promise<{
    checkpoints: Checkpoint[];
    memory_citations: Array<{
      checkpoint_id: string;
      memory_id: string;
      score: number;
      reason: string;
    }>;
  }> {
    // Get all checkpoints in the run
    const checkpoints = await this.ledger.listCheckpoints(namespace);
    const runCheckpoints = checkpoints.filter(cp => cp.run_id === run_id);
    
    // Build citation log
    const citations: Array<{
      checkpoint_id: string;
      memory_id: string;
      score: number;
      reason: string;
    }> = [];
    
    for (const cp of runCheckpoints) {
      for (const memRef of cp.memory_refs) {
        citations.push({
          checkpoint_id: cp.checkpoint_id,
          memory_id: memRef,
          score: 1.0,
          reason: `Referenced in checkpoint at step ${cp.step_index}`,
        });
      }
    }
    
    return {
      checkpoints: runCheckpoints,
      memory_citations: citations,
    };
  }
}
