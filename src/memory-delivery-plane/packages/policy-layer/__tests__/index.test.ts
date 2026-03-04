/**
 * Policy Layer Tests
 */

import { describe, it, expect } from 'vitest';
import { PolicyLayer, type TenantPolicy, type EnforcementResult, type RetentionPeriod } from '../index.js';

describe('PolicyLayer', () => {
  describe('registerPolicy', () => {
    it('should register a policy', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-1',
        tenantId: 'tenant-1',
        dataResidency: 'us',
        piiRedaction: true,
        retention: '30d',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const retrieved = layer.getPolicy('policy-1');
      expect(retrieved).toEqual(policy);
    });

    it('should register custom PII patterns', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-custom',
        tenantId: 'tenant-1',
        dataResidency: 'us',
        piiRedaction: true,
        customPIIPatterns: [
          { name: 'api_key', pattern: 'sk-[a-zA-Z0-9]+' },
        ],
        retention: '30d',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const retrieved = layer.getPolicy('policy-custom');
      expect(retrieved?.customPIIPatterns).toHaveLength(1);
    });
  });

  describe('getPolicyByTenant', () => {
    it('should find policy by tenant ID', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-1',
        tenantId: 'tenant-abc',
        dataResidency: 'eu',
        piiRedaction: false,
        retention: '7d',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const found = layer.getPolicyByTenant('tenant-abc');
      expect(found?.id).toBe('policy-1');
    });
  });

  describe('enforceMemories', () => {
    it('should filter blocked sources', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-1',
        tenantId: 'tenant-1',
        dataResidency: 'global',
        piiRedaction: false,
        blockedSources: ['twitter', 'linkedin'],
        retention: 'forever',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const memories = [
        { id: '1', content: 'Test from twitter', source: 'twitter', createdAt: new Date().toISOString() },
        { id: '2', content: 'Test from github', source: 'github', createdAt: new Date().toISOString() },
      ];
      
      const { memories: filtered, result } = layer.enforceMemories(memories as any, 'policy-1');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('github');
    });

    it('should redact PII when enabled', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-pii',
        tenantId: 'tenant-1',
        dataResidency: 'global',
        piiRedaction: true,
        retention: 'forever',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const memories = [
        { 
          id: '1', 
          content: 'Contact me at john@example.com or call 555-123-4567', 
          source: 'test', 
          createdAt: new Date().toISOString() 
        },
      ];
      
      const { result } = layer.enforceMemories(memories as any, 'policy-pii');
      
      expect(result.metadata.piiRedacted).toBe(1);
    });

    it('should respect retention policy', () => {
      const layer = new PolicyLayer();
      
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      
      const policy: TenantPolicy = {
        id: 'policy-retention',
        tenantId: 'tenant-1',
        dataResidency: 'global',
        piiRedaction: false,
        retention: '30d',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const memories = [
        { id: '1', content: 'Old memory', source: 'test', createdAt: oldDate.toISOString() },
        { id: '2', content: 'New memory', source: 'test', createdAt: new Date().toISOString() },
      ];
      
      const { memories: filtered, result } = layer.enforceMemories(memories as any, 'policy-retention');
      
      // Old memory should be filtered out
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should return error for unknown policy', () => {
      const layer = new PolicyLayer();
      
      const memories = [
        { id: '1', content: 'Test', source: 'test', createdAt: new Date().toISOString() },
      ];
      
      const { result } = layer.enforceMemories(memories as any, 'unknown-policy');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('checkDataResidency', () => {
    it('should allow global region', () => {
      const layer = new PolicyLayer();
      
      expect(layer.checkDataResidency('global', 'us-east-1')).toBe(true);
      expect(layer.checkDataResidency('global', 'eu-west-1')).toBe(true);
    });

    it('should allow matching region', () => {
      const layer = new PolicyLayer();
      
      expect(layer.checkDataResidency('us', 'us-east-1')).toBe(true);
      expect(layer.checkDataResidency('eu', 'eu-west-1')).toBe(true);
    });

    it('should reject non-matching region', () => {
      const layer = new PolicyLayer();
      
      expect(layer.checkDataResidency('us', 'eu-west-1')).toBe(false);
      expect(layer.checkDataResidency('eu', 'us-east-1')).toBe(false);
    });

    it('should allow when current region not specified', () => {
      const layer = new PolicyLayer();
      
      expect(layer.checkDataResidency('us', undefined)).toBe(true);
    });
  });

  describe('detectPII', () => {
    it('should detect email addresses', () => {
      const layer = new PolicyLayer();
      
      const detections = layer.detectPII('Contact me at john@example.com please');
      
      expect(detections.some(d => d.type === 'email')).toBe(true);
    });

    it('should detect phone numbers', () => {
      const layer = new PolicyLayer();
      
      const detections = layer.detectPII('Call me at 555-123-4567');
      
      expect(detections.some(d => d.type === 'phone')).toBe(true);
    });

    it('should detect SSN', () => {
      const layer = new PolicyLayer();
      
      const detections = layer.detectPII('My SSN is 123-45-6789');
      
      expect(detections.some(d => d.type === 'ssn')).toBe(true);
    });

    it('should return empty for clean text', () => {
      const layer = new PolicyLayer();
      
      const detections = layer.detectPII('This is clean text with no PII');
      
      expect(detections).toHaveLength(0);
    });
  });

  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const layer = new PolicyLayer();
      
      const redacted = layer.redactPII('Contact john@example.com');
      
      expect(redacted).not.toContain('@');
    });

    it('should redact phone numbers', () => {
      const layer = new PolicyLayer();
      
      const redacted = layer.redactPII('Call 555-123-4567');
      
      expect(redacted).not.toContain('555-123-4567');
    });
  });

  describe('createDefaultPolicy', () => {
    it('should create a valid default policy', () => {
      const policy = PolicyLayer.createDefaultPolicy('tenant-123');
      
      expect(policy.tenantId).toBe('tenant-123');
      expect(policy.dataResidency).toBe('global');
      expect(policy.piiRedaction).toBe(true);
      expect(policy.retention).toBe('30d');
      expect(policy.encryptAtRest).toBe(true);
    });
  });

  describe('getRetentionDays', () => {
    it('should return correct days for each period', () => {
      expect(PolicyLayer.getRetentionDays('24h')).toBe(1);
      expect(PolicyLayer.getRetentionDays('7d')).toBe(7);
      expect(PolicyLayer.getRetentionDays('30d')).toBe(30);
      expect(PolicyLayer.getRetentionDays('90d')).toBe(90);
      expect(PolicyLayer.getRetentionDays('1y')).toBe(365);
      expect(PolicyLayer.getRetentionDays('forever')).toBe(-1);
    });
  });

  describe('enforcePacket', () => {
    it('should enforce policy on task packet', () => {
      const layer = new PolicyLayer();
      
      const policy: TenantPolicy = {
        id: 'policy-1',
        tenantId: 'tenant-1',
        dataResidency: 'global',
        piiRedaction: true,
        retention: 'forever',
        encryptAtRest: true,
      };
      
      layer.registerPolicy(policy);
      
      const packet = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        originalCount: 2,
        distilledCount: 2,
        compressionRatio: 0.5,
        memories: [
          {
            id: 'mem-1',
            summary: 'My email is test@example.com',
            importance: 0.8,
            source: 'test',
            keyTopics: ['test'],
            createdAt: new Date().toISOString(),
          },
        ],
        metadata: {
          distillationMethod: 'test',
          originalSize: 1000,
          packetSize: 500,
        },
      };
      
      const { packet: filtered, result } = layer.enforcePacket(packet as any, 'policy-1');
      
      expect(result.metadata.piiRedacted).toBe(1);
    });
  });
});
