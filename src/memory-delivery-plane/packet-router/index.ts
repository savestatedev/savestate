/**
 * Memory Delivery Plane - Packet Router
 * 
 * Selects top packets per request intent + tenant policy.
 */

import { TaskPacket, PacketPriority } from '../packet-builder/index.js';

/**
 * Routing strategy for packet selection
 */
export enum RoutingStrategy {
  PRIORITY = 'priority',          // Highest priority first
  RECENCY = 'recency',            // Most recent first
  RELEVANCE = 'relevance',        // Most relevant to query
  BALANCED = 'balanced',          // Mix of priority + recency
}

// Re-export for convenience
export { PacketPriority };

/**
 * Request intent for routing decisions
 */
export interface RoutingIntent {
  /** User query or request description */
  query?: string;
  
  /** Requested task type */
  taskType?: 'chat' | 'code' | 'analysis' | 'creative' | 'general';
  
  /** Urgency level */
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  
  /** Maximum tokens allowed */
  maxTokens?: number;
  
  /** Preferred topics/tags */
  preferredTags?: string[];
  
  /** Excluded topics/tags */
  excludedTags?: string[];
}

/**
 * Tenant policy for routing
 */
export interface TenantPolicy {
  /** Tenant ID */
  tenantId: string;
  
  /** Maximum packets per request */
  maxPackets: number;
  
  /** Maximum tokens per request */
  maxTokens: number;
  
  /** Required tags for this tenant */
  requiredTags?: string[];
  
  /** Blocked tags for this tenant */
  blockedTags?: string[];
  
  /** Minimum priority threshold */
  minPriority?: PacketPriority;
  
  /** Enable recency bias */
  recencyBias?: boolean;
  
  /** Custom routing strategy */
  strategy?: RoutingStrategy;
}

/**
 * Routing result with selected packets and metadata
 */
export interface RoutingResult {
  packets: TaskPacket[];
  totalTokens: number;
  packetCount: number;
  strategy: RoutingStrategy;
  appliedFilters: string[];
}

/**
 * PacketRouter - selects optimal packets based on intent + policy
 */
export class PacketRouter {
  private defaultPolicy: TenantPolicy;

  constructor(defaultPolicy?: Partial<TenantPolicy>) {
    this.defaultPolicy = {
      tenantId: 'default',
      maxPackets: defaultPolicy?.maxPackets ?? 5,
      maxTokens: defaultPolicy?.maxTokens ?? 4000,
      requiredTags: defaultPolicy?.requiredTags ?? [],
      blockedTags: defaultPolicy?.blockedTags ?? [],
      minPriority: defaultPolicy?.minPriority ?? PacketPriority.LOW,
      recencyBias: defaultPolicy?.recencyBias ?? false,
      strategy: defaultPolicy?.strategy ?? RoutingStrategy.BALANCED,
      ...defaultPolicy,
    };
  }

  /**
   * Calculate priority weight for sorting
   */
  private getPriorityWeight(priority: PacketPriority): number {
    switch (priority) {
      case PacketPriority.CRITICAL: return 4;
      case PacketPriority.HIGH: return 3;
      case PacketPriority.MEDIUM: return 2;
      case PacketPriority.LOW: return 1;
    }
  }

  /**
   * Parse ISO date string to timestamp
   */
  private getTimestamp(dateStr: string): number {
    return new Date(dateStr).getTime();
  }

  /**
   * Check if packet matches tags
   */
  private matchesTags(packet: TaskPacket, required: string[], blocked: string[]): boolean {
    const packetTags = new Set(
      packet.memories.flatMap(m => m.tags ?? [])
    );

    // Check required tags
    if (required.length > 0) {
      const hasRequired = required.some(tag => packetTags.has(tag));
      if (!hasRequired) return false;
    }

    // Check blocked tags
    if (blocked.length > 0) {
      const hasBlocked = blocked.some(tag => packetTags.has(tag));
      if (hasBlocked) return false;
    }

    return true;
  }

  /**
   * Check if packet meets priority threshold
   */
  private meetsPriorityThreshold(packet: TaskPacket, minPriority: PacketPriority): boolean {
    return this.getPriorityWeight(packet.priority) >= this.getPriorityWeight(minPriority);
  }

  /**
   * Score packet for relevance (simple keyword matching)
   */
  private scoreRelevance(packet: TaskPacket, query: string): number {
    if (!query) return 0;
    
    const queryLower = query.toLowerCase();
    let score = 0;
    
    for (const memory of packet.memories) {
      if (memory.content.toLowerCase().includes(queryLower)) {
        score += memory.importance;
      }
    }
    
    return score;
  }

  /**
   * Sort packets based on strategy
   */
  private sortPackets(
    packets: TaskPacket[],
    strategy: RoutingStrategy,
    recencyBias: boolean,
    query?: string
  ): TaskPacket[] {
    const now = Date.now();
    
    return [...packets].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      switch (strategy) {
        case RoutingStrategy.PRIORITY:
          scoreA = this.getPriorityWeight(a.priority);
          scoreB = this.getPriorityWeight(b.priority);
          break;
          
        case RoutingStrategy.RECENCY:
          const ageA = now - this.getTimestamp(a.created_at);
          const ageB = now - this.getTimestamp(b.created_at);
          scoreA = -ageA;
          scoreB = -ageB;
          break;
          
        case RoutingStrategy.RELEVANCE:
          scoreA = query ? this.scoreRelevance(a, query) : 0;
          scoreB = query ? this.scoreRelevance(b, query) : 0;
          break;
          
        case RoutingStrategy.BALANCED:
        default:
          // Weighted combination: priority (40%) + recency (30%) + relevance (30%)
          const priorityWeightA = this.getPriorityWeight(a.priority) * 0.4;
          const priorityWeightB = this.getPriorityWeight(b.priority) * 0.4;
          
          const recencyWeight = recencyBias ? 0.4 : 0.3;
          const ageScoreA = recencyBias 
            ? (10000000000 - (now - this.getTimestamp(a.created_at))) / 100000000 * recencyWeight
            : 0;
          const ageScoreB = recencyBias 
            ? (10000000000 - (now - this.getTimestamp(b.created_at))) / 100000000 * recencyWeight
            : 0;
          
          const relevanceWeight = 0.3;
          const relevanceScoreA = query ? this.scoreRelevance(a, query) * relevanceWeight : 0;
          const relevanceScoreB = query ? this.scoreRelevance(b, query) * relevanceWeight : 0;
          
          scoreA = priorityWeightA + ageScoreA + relevanceScoreA;
          scoreB = priorityWeightB + ageScoreB + relevanceScoreB;
          break;
      }
      
      return scoreB - scoreA;
    });
  }

  /**
   * Route packets based on intent and policy
   */
  route(packets: TaskPacket[], intent: RoutingIntent, policy?: Partial<TenantPolicy>): RoutingResult {
    const effectivePolicy: TenantPolicy = {
      ...this.defaultPolicy,
      ...policy,
    };
    
    const appliedFilters: string[] = [];
    let filtered = [...packets];
    
    // Apply priority threshold filter
    if (effectivePolicy.minPriority && effectivePolicy.minPriority !== PacketPriority.LOW) {
      filtered = filtered.filter(p => this.meetsPriorityThreshold(p, effectivePolicy.minPriority!));
      appliedFilters.push(`priority >= ${effectivePolicy.minPriority}`);
    }
    
    // Apply tag filters
    if (effectivePolicy.requiredTags?.length || effectivePolicy.blockedTags?.length) {
      filtered = filtered.filter(p => 
        this.matchesTags(p, effectivePolicy.requiredTags ?? [], effectivePolicy.blockedTags ?? [])
      );
      appliedFilters.push('tag filtering');
    }
    
    // Apply intent-based tag filters
    if (intent.preferredTags?.length) {
      filtered = filtered.filter(p => 
        this.matchesTags(p, intent.preferredTags!, [])
      );
      appliedFilters.push('preferred tags');
    }
    
    if (intent.excludedTags?.length) {
      filtered = filtered.filter(p => 
        this.matchesTags(p, [], intent.excludedTags!)
      );
      appliedFilters.push('excluded tags');
    }
    
    // Apply maxTokens from intent if provided
    const maxTokens = intent.maxTokens ?? effectivePolicy.maxTokens;
    
    // Sort based on strategy
    const strategy = effectivePolicy.strategy ?? RoutingStrategy.BALANCED;
    const sorted = this.sortPackets(
      filtered, 
      strategy, 
      effectivePolicy.recencyBias ?? false,
      intent.query
    );
    
    // Select packets within limits
    const selected: TaskPacket[] = [];
    let totalTokens = 0;
    
    for (const packet of sorted) {
      // Check packet limit
      if (selected.length >= (effectivePolicy.maxPackets ?? 5)) {
        break;
      }
      
      // Check token limit
      if (totalTokens + packet.estimated_tokens > maxTokens) {
        continue;
      }
      
      selected.push(packet);
      totalTokens += packet.estimated_tokens;
    }
    
    if (selected.length > 0) {
      appliedFilters.push(`selected ${selected.length} packets`);
    }
    
    return {
      packets: selected,
      totalTokens,
      packetCount: selected.length,
      strategy,
      appliedFilters,
    };
  }

  /**
   * Get default policy
   */
  getDefaultPolicy(): TenantPolicy {
    return { ...this.defaultPolicy };
  }

  /**
   * Update default policy
   */
  updateDefaultPolicy(policy: Partial<TenantPolicy>): void {
    this.defaultPolicy = {
      ...this.defaultPolicy,
      ...policy,
    };
  }
}

export default PacketRouter;
