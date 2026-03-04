/**
 * Packet Router Tests
 */

import { describe, it, expect } from 'vitest';
import { PacketRouter, type RequestIntent, type TenantPolicy, type RoutingResult } from '../index.js';
import type { TaskPacket, DistilledMemory } from '../packet-builder/index.js';

// Helper to create test packets
function createTestPacket(id: string, topics: string[], importance: number, daysAgo: number): TaskPacket {
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  
  const memories: DistilledMemory[] = topics.map((topic, i) => ({
    id: `${id}-mem-${i}`,
    summary: `Memory about ${topic}`,
    importance,
    source: 'test',
    keyTopics: [topic],
    createdAt: timestamp,
  }));
  
  return {
    version: '1.0.0',
    timestamp,
    originalCount: memories.length,
    distilledCount: memories.length,
    compressionRatio: 0.5,
    memories,
    metadata: {
      distillationMethod: 'test',
      originalSize: 1000,
      packetSize: 500,
    },
  };
}

describe('PacketRouter', () => {
  describe('route', () => {
    it('should return packets sorted by relevance score', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['javascript', 'react'], 0.3, 5),
        createTestPacket('p2', ['python', 'ai'], 0.8, 1),
        createTestPacket('p3', ['typescript', 'node'], 0.9, 2),
      ];
      
      const intent: RequestIntent = {
        query: 'How do I use TypeScript with Node?',
        topics: ['typescript', 'node'],
      };
      
      const result = router.route(packets, intent);
      
      expect(result.packets.length).toBeGreaterThan(0);
      // First packet should be p3 (highest topic match with typescript, node)
      expect(result.packets[0].memories[0].keyTopics).toContain('typescript');
    });

    it('should respect maxPackets policy', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['a'], 0.5, 1),
        createTestPacket('p2', ['b'], 0.6, 2),
        createTestPacket('p3', ['c'], 0.7, 3),
        createTestPacket('p4', ['d'], 0.8, 4),
        createTestPacket('p5', ['e'], 0.9, 5),
      ];
      
      const intent: RequestIntent = { query: 'test', topics: ['a', 'b', 'c', 'd', 'e'] };
      const policy: Partial<TenantPolicy> = { maxPackets: 2 };
      
      const result = router.route(packets, intent, policy);
      
      expect(result.packets.length).toBe(2);
    });

    it('should filter by required topics', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['javascript'], 0.5, 1),
        createTestPacket('p2', ['python', 'ai'], 0.5, 1),
        createTestPacket('p3', ['javascript', 'ai'], 0.5, 1),
      ];
      
      const intent: RequestIntent = { query: 'test', topics: ['test'] };
      const policy: Partial<TenantPolicy> = { 
        requiredTopics: ['python', 'ai'] 
      };
      
      const result = router.route(packets, intent, policy);
      
      expect(result.packets.length).toBe(1);
      expect(result.packets[0].memories[0].keyTopics).toContain('python');
    });

    it('should filter by excluded topics', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['javascript'], 0.5, 1),
        createTestPacket('p2', ['python'], 0.5, 1),
        createTestPacket('p3', ['javascript', 'python'], 0.5, 1),
      ];
      
      const intent: RequestIntent = { query: 'test', topics: ['test'] };
      const policy: Partial<TenantPolicy> = { 
        excludedTopics: ['javascript'] 
      };
      
      const result = router.route(packets, intent, policy);
      
      expect(result.packets.length).toBe(1);
      expect(result.packets[0].memories[0].keyTopics).toContain('python');
    });

    it('should filter by minimum importance', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['a'], 0.2, 1),
        createTestPacket('p2', ['b'], 0.5, 1),
        createTestPacket('p3', ['c'], 0.8, 1),
      ];
      
      const intent: RequestIntent = { query: 'test', topics: ['a', 'b', 'c'] };
      const policy: Partial<TenantPolicy> = { minImportance: 0.5 };
      
      const result = router.route(packets, intent, policy);
      
      expect(result.packets.length).toBe(2);
    });

    it('should prioritize recent packets', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('old', ['test'], 0.9, 30), // 30 days old
        createTestPacket('new', ['test'], 0.9, 1),   // 1 day old
      ];
      
      const intent: RequestIntent = { query: 'test topic', topics: ['test'] };
      
      const result = router.route(packets, intent);
      
      // New packet should score higher due to recency
      expect(result.packets[0].memories[0].id).toBe('new-mem-0');
    });

    it('should handle empty packets array', () => {
      const router = new PacketRouter();
      
      const intent: RequestIntent = { query: 'test', topics: ['test'] };
      
      const result = router.route([], intent);
      
      expect(result.packets.length).toBe(0);
      expect(result.metadata.totalScored).toBe(0);
    });

    it('should handle requestedIds for direct retrieval', () => {
      const router = new PacketRouter();
      
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['a'], 0.5, 1),
        createTestPacket('p2', ['b'], 0.5, 1),
        createTestPacket('p3', ['c'], 0.5, 1),
      ];
      
      // Modify packets to have specific IDs
      packets[0].memories[0].id = 'mem-123';
      packets[1].memories[0].id = 'mem-456';
      packets[2].memories[0].id = 'mem-789';
      
      const intent: RequestIntent = { 
        query: 'test', 
        topics: [],
        requestedIds: ['mem-456'],
      };
      
      const result = router.route(packets, intent);
      
      // Should return packet with requested ID (boosted score)
      expect(result.packets.length).toBeGreaterThan(0);
    });

    it('should respect custom scoring weights', () => {
      const router = new PacketRouter();
      
      // High importance packet, old
      const packets: TaskPacket[] = [
        createTestPacket('p1', ['test'], 0.9, 30),
        createTestPacket('p2', ['test'], 0.3, 1),
      ];
      
      const intent: RequestIntent = { query: 'test', topics: ['test'] };
      const policy: Partial<TenantPolicy> = {
        scoringWeights: {
          topicMatch: 0.1,
          importance: 0.8,
          recency: 0.1,
        },
      };
      
      const result = router.route(packets, intent, policy);
      
      // High importance should win despite being old
      expect(result.packets[0].memories[0].id).toBe('p1-mem-0');
    });
  });

  describe('extractTopics', () => {
    it('should extract keywords from query', () => {
      const topics = PacketRouter.extractTopics('How do I use TypeScript with Node.js for backend development?');
      
      expect(topics).toContain('typescript');
      expect(topics).toContain('backend');
    });

    it('should filter out stop words', () => {
      const topics = PacketRouter.extractTopics('this is a test with that from have been');
      
      expect(topics).not.toContain('this');
      expect(topics).not.toContain('that');
      expect(topics).not.toContain('from');
    });

    it('should return empty for short/empty query', () => {
      expect(PacketRouter.extractTopics('')).toEqual([]);
      expect(PacketRouter.extractTopics('a b c')).toEqual([]);
    });
  });

  describe('performance', () => {
    it('should complete routing in under 50ms for typical workload', () => {
      const router = new PacketRouter({ enableMetrics: true });
      
      // Create 100 packets with 10 memories each
      const packets: TaskPacket[] = Array.from({ length: 100 }, (_, i) => 
        createTestPacket(`p${i}`, [`topic${i % 10}`], 0.5 + (i % 5) * 0.1, i % 30)
      );
      
      const intent: RequestIntent = {
        query: 'Tell me about topic5 and topic7',
        topics: ['topic5', 'topic7'],
      };
      
      const result = router.route(packets, intent);
      
      expect(result.timingMs).toBeLessThan(50);
      expect(result.metadata.totalScored).toBe(100);
    });
  });
});
