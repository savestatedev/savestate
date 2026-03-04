/**
 * PacketRouter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PacketRouter, 
  RoutingStrategy, 
  RoutingIntent, 
  TenantPolicy,
  PacketPriority 
} from '../index.js';
import { TaskPacket, PacketPriority as Prio } from '../../packet-builder/index.js';

describe('PacketRouter', () => {
  let router: PacketRouter;
  
  const createPacket = (overrides: Partial<TaskPacket> = {}): TaskPacket => ({
    packet_id: `pkt_${Math.random().toString(36).substring(7)}`,
    version: '1.0.0',
    created_at: new Date().toISOString(),
    namespace: {
      org_id: 'test-org',
      app_id: 'test-app',
      agent_id: 'test-agent',
      user_id: 'test-user',
    },
    memories: [],
    estimated_tokens: 100,
    priority: Prio.MEDIUM,
    original_count: 1,
    ...overrides,
  });

  beforeEach(() => {
    router = new PacketRouter();
  });

  describe('route', () => {
    it('should return empty array for empty input', () => {
      const result = router.route([], {});
      expect(result.packets).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });

    it('should filter by priority threshold', () => {
      const packets = [
        createPacket({ priority: Prio.LOW, estimated_tokens: 100 }),
        createPacket({ priority: Prio.HIGH, estimated_tokens: 100 }),
        createPacket({ priority: Prio.CRITICAL, estimated_tokens: 100 }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        minPriority: PacketPriority.HIGH,
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets).toHaveLength(2);
      expect(result.packets.every(p => p.priority !== Prio.LOW)).toBe(true);
    });

    it('should filter by required tags', () => {
      const packets = [
        createPacket({ 
          memories: [{ memory_id: '1', content: 'Test', importance: 0.5, tags: ['urgent'], created_at: '' }],
          priority: Prio.HIGH 
        }),
        createPacket({ 
          memories: [{ memory_id: '2', content: 'Test', importance: 0.5, tags: ['normal'], created_at: '' }],
          priority: Prio.HIGH 
        }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        requiredTags: ['urgent'],
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets).toHaveLength(1);
      expect(result.packets[0].memories[0].tags).toContain('urgent');
    });

    it('should filter by blocked tags', () => {
      const packets = [
        createPacket({ 
          memories: [{ memory_id: '1', content: 'Test', importance: 0.5, tags: ['internal'], created_at: '' }],
          priority: Prio.HIGH 
        }),
        createPacket({ 
          memories: [{ memory_id: '2', content: 'Test', importance: 0.5, tags: ['public'], created_at: '' }],
          priority: Prio.HIGH 
        }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        blockedTags: ['internal'],
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets).toHaveLength(1);
      expect(result.packets[0].memories[0].tags).toContain('public');
    });

    it('should respect maxPackets limit', () => {
      const packets = Array.from({ length: 10 }, (_, i) => 
        createPacket({ priority: Prio.CRITICAL, estimated_tokens: 50 })
      );
      
      const policy: Partial<TenantPolicy> = {
        maxPackets: 3,
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets).toHaveLength(3);
    });

    it('should respect maxTokens limit', () => {
      const packets = [
        createPacket({ estimated_tokens: 3000 }),
        createPacket({ estimated_tokens: 3000 }),
        createPacket({ estimated_tokens: 3000 }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        maxTokens: 4000,
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.totalTokens).toBeLessThanOrEqual(4000);
      expect(result.packets.length).toBeLessThanOrEqual(4);
    });

    it('should sort by priority strategy', () => {
      const packets = [
        createPacket({ priority: Prio.LOW }),
        createPacket({ priority: Prio.CRITICAL }),
        createPacket({ priority: Prio.MEDIUM }),
        createPacket({ priority: Prio.HIGH }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        strategy: RoutingStrategy.PRIORITY,
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets[0].priority).toBe(Prio.CRITICAL);
      expect(result.packets[1].priority).toBe(Prio.HIGH);
      expect(result.packets[2].priority).toBe(Prio.MEDIUM);
      expect(result.packets[3].priority).toBe(Prio.LOW);
    });

    it('should sort by recency strategy', () => {
      const packets = [
        createPacket({ created_at: '2026-01-01T00:00:00Z' }),
        createPacket({ created_at: '2026-03-01T00:00:00Z' }),
        createPacket({ created_at: '2026-02-01T00:00:00Z' }),
      ];
      
      const policy: Partial<TenantPolicy> = {
        strategy: RoutingStrategy.RECENCY,
      };
      
      const result = router.route(packets, {}, policy);
      
      expect(result.packets[0].created_at).toBe('2026-03-01T00:00:00Z');
      expect(result.packets[1].created_at).toBe('2026-02-01T00:00:00Z');
      expect(result.packets[2].created_at).toBe('2026-01-01T00:00:00Z');
    });

    it('should apply intent-based tag filtering', () => {
      const packets = [
        createPacket({ 
          memories: [{ memory_id: '1', content: 'Test', importance: 0.5, tags: ['code'], created_at: '' }],
        }),
        createPacket({ 
          memories: [{ memory_id: '2', content: 'Test', importance: 0.5, tags: ['chat'], created_at: '' }],
        }),
      ];
      
      const intent: RoutingIntent = {
        preferredTags: ['code'],
      };
      
      const result = router.route(packets, intent, {});
      
      expect(result.packets).toHaveLength(1);
      expect(result.appliedFilters).toContain('preferred tags');
    });

    it('should exclude tags from intent', () => {
      const packets = [
        createPacket({ 
          memories: [{ memory_id: '1', content: 'Test', importance: 0.5, tags: ['sensitive'], created_at: '' }],
        }),
        createPacket({ 
          memories: [{ memory_id: '2', content: 'Test', importance: 0.5, tags: ['normal'], created_at: '' }],
        }),
      ];
      
      const intent: RoutingIntent = {
        excludedTags: ['sensitive'],
      };
      
      const result = router.route(packets, intent, {});
      
      expect(result.packets).toHaveLength(1);
      expect(result.appliedFilters).toContain('excluded tags');
    });

    it('should respect intent maxTokens', () => {
      const packets = [
        createPacket({ estimated_tokens: 2000 }),
        createPacket({ estimated_tokens: 2000 }),
      ];
      
      const intent: RoutingIntent = {
        maxTokens: 2500,
      };
      
      const result = router.route(packets, intent, {});
      
      expect(result.totalTokens).toBeLessThanOrEqual(2500);
    });

    it('should use balanced strategy by default', () => {
      const packets = [createPacket({ priority: Prio.HIGH })];
      
      const result = router.route(packets, {}, {});
      
      expect(result.strategy).toBe(RoutingStrategy.BALANCED);
    });
  });

  describe('configuration', () => {
    it('should use default policy', () => {
      const policy = router.getDefaultPolicy();
      
      expect(policy.tenantId).toBe('default');
      expect(policy.maxPackets).toBe(5);
      expect(policy.maxTokens).toBe(4000);
    });

    it('should accept custom default policy', () => {
      const customRouter = new PacketRouter({
        tenantId: 'custom-tenant',
        maxPackets: 10,
        maxTokens: 8000,
      });
      
      const policy = customRouter.getDefaultPolicy();
      
      expect(policy.tenantId).toBe('custom-tenant');
      expect(policy.maxPackets).toBe(10);
      expect(policy.maxTokens).toBe(8000);
    });

    it('should update default policy', () => {
      router.updateDefaultPolicy({ maxPackets: 3 });
      
      const policy = router.getDefaultPolicy();
      expect(policy.maxPackets).toBe(3);
    });
  });
});
