/**
 * Memory Delivery Plane - Packet Router
 * 
 * Selects the most relevant packets based on request intent and tenant policy.
 */

import type { TaskPacket } from '../packet-builder/index.js';

/**
 * Request context for packet selection
 */
export interface RequestIntent {
  /** The user's query or request text */
  query: string;
  /** Extracted topics/intent from the request */
  topics: string[];
  /** Optional: specific memory IDs requested */
  requestedIds?: string[];
  /** Optional: time sensitivity (affects how many packets to return) */
  timeSensitivity?: 'low' | 'normal' | 'high';
}

/**
 * Tenant policy for packet selection
 */
export interface TenantPolicy {
  /** Maximum number of packets to return */
  maxPackets: number;
  /** Required topics that must be present (if any) */
  requiredTopics?: string[];
  /** Topics to exclude */
  excludedTopics?: string[];
  /** Minimum importance threshold */
  minImportance?: number;
  /** Enable topic-based filtering */
  enableTopicFiltering: boolean;
  /** Custom scoring weights */
  scoringWeights?: {
    topicMatch: number;
    importance: number;
    recency: number;
  };
}

/**
 * Router configuration options
 */
export interface RouterOptions {
  /** Default tenant policy (can be overridden per-request) */
  defaultPolicy?: Partial<TenantPolicy>;
  /** Enable performance timing */
  enableMetrics?: boolean;
}

/**
 * Result of packet routing
 */
export interface RoutingResult {
  packets: TaskPacket[];
  scores: Map<string, number>;
  timingMs: number;
  metadata: {
    totalScored: number;
    totalReturned: number;
    policyApplied: string;
  };
}

/**
 * Packet Router - selects top packets per request intent and tenant policy
 * 
 * Performance target: P95 <= 50ms
 */
export class PacketRouter {
  private defaultPolicy: TenantPolicy;
  private enableMetrics: boolean;

  constructor(options?: RouterOptions) {
    this.defaultPolicy = {
      maxPackets: 5,
      enableTopicFiltering: true,
      scoringWeights: {
        topicMatch: 0.4,
        importance: 0.35,
        recency: 0.25,
      },
      ...options?.defaultPolicy,
    };
    this.enableMetrics = options?.enableMetrics ?? false;
  }

  /**
   * Select the most relevant packets for a request
   * @param packets - Available task packets
   * @param intent - Request intent
   * @param policy - Optional tenant policy override
   * @returns Routing result with selected packets
   */
  route(
    packets: TaskPacket[], 
    intent: RequestIntent, 
    policy?: Partial<TenantPolicy>
  ): RoutingResult {
    const startTime = this.enableMetrics ? performance.now() : 0;
    
    // Merge policies
    const effectivePolicy = this.mergePolicy(policy);
    
    // Score all packets
    const scoredPackets = packets.map(packet => ({
      packet,
      score: this.scorePacket(packet, intent, effectivePolicy),
    }));
    
    // Sort by score descending
    scoredPackets.sort((a, b) => b.score.total - a.score.total);
    
    // Apply filters
    let filtered = scoredPackets.filter(sp => this.applyFilters(sp.packet, sp.score, effectivePolicy));
    
    // Limit results
    const resultPackets = filtered.slice(0, effectivePolicy.maxPackets).map(sp => sp.packet);
    
    // Build scores map
    const scores = new Map<string, number>();
    for (const sp of filtered) {
      scores.set(sp.packet.timestamp, sp.score.total);
    }
    
    const timingMs = this.enableMetrics ? performance.now() - startTime : 0;
    
    return {
      packets: resultPackets,
      scores,
      timingMs,
      metadata: {
        totalScored: packets.length,
        totalReturned: resultPackets.length,
        policyApplied: effectivePolicy.enableTopicFiltering ? 'topic-based' : 'basic',
      },
    };
  }

  /**
   * Score a single packet against intent
   */
  private scorePacket(
    packet: TaskPacket, 
    intent: RequestIntent, 
    policy: TenantPolicy
  ): { total: number; topicMatch: number; importance: number; recency: number } {
    const weights = policy.scoringWeights!;
    
    // Topic match score (0-1)
    let topicMatch = 0;
    if (intent.topics.length > 0 && packet.memories.length > 0) {
      const packetTopics = new Set<string>();
      for (const memory of packet.memories) {
        for (const topic of memory.keyTopics) {
          packetTopics.add(topic.toLowerCase());
        }
      }
      
      let matches = 0;
      for (const intentTopic of intent.topics) {
        if (packetTopics.has(intentTopic.toLowerCase())) {
          matches++;
        }
      }
      topicMatch = matches / intent.topics.length;
    }
    
    // Importance score (average importance of memories in packet)
    let importance = 0;
    if (packet.memories.length > 0) {
      const totalImportance = packet.memories.reduce((sum, m) => sum + m.importance, 0);
      importance = totalImportance / packet.memories.length;
    }
    
    // Recency score (0-1, based on packet timestamp)
    const recency = this.calculateRecency(packet.timestamp);
    
    // Calculate weighted total
    const total = 
      (topicMatch * weights.topicMatch) +
      (importance * weights.importance) +
      (recency * weights.recency);
    
    return { total, topicMatch, importance, recency };
  }

  /**
   * Calculate recency score (0-1)
   * Newer packets score higher
   */
  private calculateRecency(timestamp: string): number {
    const packetTime = new Date(timestamp).getTime();
    const now = Date.now();
    const ageDays = (now - packetTime) / (1000 * 60 * 60 * 24);
    
    // Score decays over 30 days
    return Math.max(0, 1 - ageDays / 30);
  }

  /**
   * Apply policy filters to a packet
   */
  private applyFilters(
    packet: TaskPacket, 
    score: { total: number; topicMatch: number; importance: number; recency: number },
    policy: TenantPolicy
  ): boolean {
    // Minimum importance filter
    if (policy.minImportance !== undefined) {
      const avgImportance = packet.memories.length > 0
        ? packet.memories.reduce((sum, m) => sum + m.importance, 0) / packet.memories.length
        : 0;
      if (avgImportance < policy.minImportance) {
        return false;
      }
    }
    
    // Required topics filter
    if (policy.requiredTopics && policy.requiredTopics.length > 0) {
      const packetTopics = new Set<string>();
      for (const memory of packet.memories) {
        for (const topic of memory.keyTopics) {
          packetTopics.add(topic.toLowerCase());
        }
      }
      
      for (const required of policy.requiredTopics) {
        if (!packetTopics.has(required.toLowerCase())) {
          return false;
        }
      }
    }
    
    // Excluded topics filter
    if (policy.excludedTopics && policy.excludedTopics.length > 0) {
      for (const memory of packet.memories) {
        for (const topic of memory.keyTopics) {
          if (policy.excludedTopics.some(exc => exc.toLowerCase() === topic.toLowerCase())) {
            return false;
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Merge default policy with overrides
   */
  private mergePolicy(policy?: Partial<TenantPolicy>): TenantPolicy {
    return {
      ...this.defaultPolicy,
      ...policy,
      scoringWeights: {
        ...this.defaultPolicy.scoringWeights,
        ...policy?.scoringWeights,
      },
    };
  }

  /**
   * Extract topics from a query string
   * Simple keyword extraction for MVP
   */
  static extractTopics(query: string): string[] {
    const words = query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    // Count frequency
    const freq: Record<string, number> = {};
    for (const word of words) {
      // Skip common stop words
      if (['that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their'].includes(word)) {
        continue;
      }
      freq[word] = (freq[word] || 0) + 1;
    }
    
    // Get top topics
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
}

export default PacketRouter;
