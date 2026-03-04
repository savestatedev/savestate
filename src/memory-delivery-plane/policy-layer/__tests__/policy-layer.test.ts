/**
 * PolicyLayer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PolicyLayer, 
  PolicyConfig,
  PIIType,
  DataRegion,
  RetentionPolicy
} from '../index.js';
import { TaskPacket, PacketPriority, PacketMemory } from '../../packet-builder/index.js';

describe('PolicyLayer', () => {
  let policy: PolicyLayer;
  
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
    priority: PacketPriority.MEDIUM,
    original_count: 1,
    ...overrides,
  });

  beforeEach(() => {
    policy = new PolicyLayer();
  });

  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const content = 'Contact me at john.doe@example.com for details.';
      const result = policy.redactPII(content);
      
      expect(result.redacted).toContain('***');
      expect(result.redacted).not.toContain('john.doe@example.com');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact phone numbers', () => {
      const content = 'Call me at 555-123-4567 for support.';
      const result = policy.redactPII(content);
      
      expect(result.redacted).toContain('***');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact credit card numbers', () => {
      const content = 'Card: 4111111111111111 for payment.';
      const result = policy.redactPII(content);
      
      expect(result.redacted).toContain('****');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact API keys', () => {
      const content = 'api_key=sk-abcdef1234567890abcdef1234567890';
      const result = policy.redactPII(content);
      
      expect(result.redacted).toContain('[REDACTED_API_KEY]');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact multiple PII types', () => {
      const content = 'Email: test@test.com, Phone: 555-123-4567, CC: 4111111111111111';
      const result = policy.redactPII(content);
      
      expect(result.redactionCount).toBe(3);
    });

    it('should handle content without PII', () => {
      const content = 'This is a normal message without sensitive data.';
      const result = policy.redactPII(content);
      
      expect(result.redacted).toBe(content);
      expect(result.redactionCount).toBe(0);
    });

    it('should track entity positions', () => {
      const content = 'Email: test@test.com';
      const result = policy.redactPII(content);
      
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe(PIIType.EMAIL);
      expect(result.entities[0].startIndex).toBeDefined();
    });
  });

  describe('isExpired', () => {
    it('should detect expired memory', () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
      expect(policy.isExpired(oldDate)).toBe(true);
    });

    it('should allow fresh memory', () => {
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
      expect(policy.isExpired(recentDate)).toBe(false);
    });
  });

  describe('getRemainingTTL', () => {
    it('should return remaining TTL for fresh memory', () => {
      const recentDate = new Date().toISOString();
      const ttl = policy.getRemainingTTL(recentDate);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should return null for expired memory', () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      expect(policy.getRemainingTTL(oldDate)).toBeNull();
    });
  });

  describe('checkDataRegion', () => {
    it('should allow global region', () => {
      expect(policy.checkDataRegion(DataRegion.GLOBAL)).toBe(true);
    });

    it('should respect allowed regions config', () => {
      const customPolicy = new PolicyLayer({
        allowedRegions: [DataRegion.US, DataRegion.EU],
      });
      
      expect(customPolicy.checkDataRegion(DataRegion.US)).toBe(true);
      expect(customPolicy.checkDataRegion(DataRegion.EU)).toBe(true);
      expect(customPolicy.checkDataRegion(DataRegion.APAC)).toBe(false);
    });
  });

  describe('validateTags', () => {
    it('should pass for valid tags', () => {
      const result = policy.validateTags(['normal', 'user']);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect blocked tags', () => {
      const customPolicy = new PolicyLayer({
        blockedTags: ['sensitive', 'internal'],
      });
      
      const result = customPolicy.validateTags(['normal', 'sensitive']);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Blocked tag: sensitive');
    });

    it('should require certain tags', () => {
      const customPolicy = new PolicyLayer({
        requiredTags: ['approved', 'user'],
      });
      
      const result = customPolicy.validateTags(['user']);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('approved'))).toBe(true);
    });
  });

  describe('enforce', () => {
    it('should allow compliant packet', () => {
      const packet = createPacket({
        memories: [{ 
          memory_id: '1', 
          content: 'Normal content', 
          importance: 0.5, 
          created_at: new Date().toISOString() 
        }],
      });
      
      const result = policy.enforce(packet);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should redact PII in packet', () => {
      const packet = createPacket({
        memories: [{ 
          memory_id: '1', 
          content: 'Contact test@example.com for help', 
          importance: 0.5, 
          created_at: new Date().toISOString() 
        }],
      });
      
      const result = policy.enforce(packet);
      expect(result.redactedContent).toBeDefined();
      expect(result.redactedContent).not.toContain('test@example.com');
    });

    it('should remove expired memories', () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const packet = createPacket({
        memories: [{ 
          memory_id: '1', 
          content: 'Old memory', 
          importance: 0.5, 
          created_at: oldDate 
        }],
      });
      
      const result = policy.enforce(packet);
      expect(result.expiredMemories).toContain('1');
      expect(packet.memories).toHaveLength(0);
    });

    it('should handle blocked tags in packet', () => {
      const customPolicy = new PolicyLayer({
        blockedTags: ['internal'],
      });
      
      const packet = createPacket({
        memories: [{ 
          memory_id: '1', 
          content: 'Content', 
          importance: 0.5, 
          created_at: new Date().toISOString(),
          tags: ['internal'],
        }],
      });
      
      const result = customPolicy.enforce(packet);
      expect(result.violations.some(v => v.includes('Blocked tag'))).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = policy.getConfig();
      
      expect(config.dataRegion).toBe(DataRegion.GLOBAL);
      expect(config.enablePIIDetection).toBe(true);
      expect(config.retention.maxAgeSeconds).toBe(90 * 24 * 60 * 60);
    });

    it('should accept custom config', () => {
      const customPolicy = new PolicyLayer({
        dataRegion: DataRegion.EU,
        enablePIIDetection: false,
        retention: {
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      });
      
      const config = customPolicy.getConfig();
      expect(config.dataRegion).toBe(DataRegion.EU);
      expect(config.enablePIIDetection).toBe(false);
    });

    it('should update config', () => {
      policy.updateConfig({ dataRegion: DataRegion.US });
      
      const config = policy.getConfig();
      expect(config.dataRegion).toBe(DataRegion.US);
    });
  });
});
