/**
 * Memory Delivery Plane - Packet Builder
 * 
 * Distills memories into compact task packets for efficient
 * context delivery across AI provider boundaries.
 */

import { MemoryObject, Namespace } from '../../checkpoint/types.js';

/**
 * Priority level for packet content
 */
export enum PacketPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * A single memory entry in a packet
 */
export interface PacketMemory {
  memory_id: string;
  content: string;
  importance: number;
  tags?: string[];
  created_at: string;
}

/**
 * Metadata about the source namespace
 */
export interface PacketNamespace {
  org_id: string;
  app_id: string;
  agent_id: string;
  user_id: string;
}

/**
 * A compact task packet for context delivery
 */
export interface TaskPacket {
  /** Unique packet identifier */
  packet_id: string;
  
  /** Packet version */
  version: string;
  
  /** Timestamp when packet was created */
  created_at: string;
  
  /** Source namespace */
  namespace: PacketNamespace;
  
  /** Memories included in this packet */
  memories: PacketMemory[];
  
  /** Total token count (estimated) */
  estimated_tokens: number;
  
  /** Priority of this packet */
  priority: PacketPriority;
  
  /** Original memory count */
  original_count: number;
}

/**
 * Configuration for packet distillation
 */
export interface DistillationConfig {
  /** Maximum tokens per packet */
  maxTokens: number;
  
  /** Minimum importance score to include (0-1) */
  minImportance: number;
  
  /** Maximum number of memories per packet */
  maxMemories: number;
  
  /** Whether to include tags in output */
  includeTags: boolean;
}

/**
 * Result of distillation operation
 */
export interface DistillationResult {
  packet: TaskPacket;
  truncated: boolean;
  excludedCount: number;
}

/**
 * PacketBuilder - distills memories into compact task packets
 */
export class PacketBuilder {
  private config: DistillationConfig;

  constructor(config: Partial<DistillationConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 4000,
      minImportance: config.minImportance ?? 0.3,
      maxMemories: config.maxMemories ?? 50,
      includeTags: config.includeTags ?? true,
    };
  }

  /**
   * Generate a unique packet ID
   */
  private generatePacketId(): string {
    return `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Estimate tokens from content (rough approximation)
   */
  private estimateTokens(content: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  /**
   * Convert full MemoryObject to PacketMemory
   */
  private toPacketMemory(memory: MemoryObject): PacketMemory {
    return {
      memory_id: memory.memory_id,
      content: memory.content,
      importance: memory.importance ?? 0.5,
      tags: this.config.includeTags ? memory.tags : undefined,
      created_at: memory.created_at ?? new Date().toISOString(),
    };
  }

  /**
   * Extract namespace from MemoryObject
   */
  private extractNamespace(ns: Namespace): PacketNamespace {
    return {
      org_id: ns.org_id,
      app_id: ns.app_id,
      agent_id: ns.agent_id,
      user_id: ns.user_id,
    };
  }

  /**
   * Determine packet priority based on importance scores
   */
  private determinePriority(memories: PacketMemory[]): PacketPriority {
    if (memories.length === 0) return PacketPriority.LOW;
    
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
    const maxImportance = Math.max(...memories.map(m => m.importance));
    
    if (maxImportance >= 0.9 || avgImportance >= 0.7) {
      return PacketPriority.CRITICAL;
    } else if (maxImportance >= 0.7 || avgImportance >= 0.5) {
      return PacketPriority.HIGH;
    } else if (maxImportance >= 0.5 || avgImportance >= 0.3) {
      return PacketPriority.MEDIUM;
    }
    return PacketPriority.LOW;
  }

  /**
   * Distill memories into a compact task packet
   */
  distill(memories: MemoryObject[], namespace: Namespace): DistillationResult {
    // Filter by minimum importance
    const filtered = memories.filter(
      m => (m.importance ?? 0.5) >= this.config.minImportance
    );

    // Sort by importance (descending)
    const sorted = [...filtered].sort(
      (a, b) => (b.importance ?? 0.5) - (a.importance ?? 0.5)
    );

    // Build packet memories and track token count
    const packetMemories: PacketMemory[] = [];
    let estimatedTokens = 0;
    let truncated = false;
    let excludedCount = 0;

    for (const memory of sorted) {
      const memTokens = this.estimateTokens(memory.content);
      
      // Check if we can add this memory
      if (
        packetMemories.length >= this.config.maxMemories ||
        estimatedTokens + memTokens > this.config.maxTokens
      ) {
        truncated = true;
        excludedCount++;
        continue;
      }

      packetMemories.push(this.toPacketMemory(memory));
      estimatedTokens += memTokens;
    }

    // Count total excluded (below threshold + truncated)
    excludedCount += Math.max(0, memories.length - filtered.length);

    const packet: TaskPacket = {
      packet_id: this.generatePacketId(),
      version: '1.0.0',
      created_at: new Date().toISOString(),
      namespace: this.extractNamespace(namespace),
      memories: packetMemories,
      estimated_tokens: estimatedTokens,
      priority: this.determinePriority(packetMemories),
      original_count: memories.length,
    };

    return {
      packet,
      truncated,
      excludedCount,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DistillationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DistillationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

export default PacketBuilder;
