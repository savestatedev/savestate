/**
 * Containment Controls Tests
 *
 * Tests for the Memory Integrity Grid containment system.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  ContainmentController,
  getQuarantinedMemories,
  getQuarantinedAgents,
  getContainmentEvents,
  getPendingApprovals,
  getContainmentConfig,
  DEFAULT_CONTAINMENT_CONFIG,
} from '../containment.js';
import type { IntegrityIncident } from '../tripwire.js';

describe('ContainmentController', () => {
  let testDir: string;
  let controller: ContainmentController;
  const testTenant = 'test-tenant';

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-test-${randomUUID()}`);
    controller = new ContainmentController(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('quarantineMemory', () => {
    it('should quarantine a memory with force=true', async () => {
      const result = await controller.quarantineMemory(
        'mem_123',
        'Suspicious content detected',
        { tenant_id: testTenant, force: true },
      );

      expect(result.success).toBe(true);
      expect(result.requires_approval).toBe(false);
      expect(result.event.action).toBe('quarantine_memory');
      expect(result.event.target_id).toBe('mem_123');
    });

    it('should require approval with default policy', async () => {
      const result = await controller.quarantineMemory(
        'mem_456',
        'Needs review',
        { tenant_id: testTenant },
      );

      expect(result.success).toBe(true);
      expect(result.requires_approval).toBe(true);

      const pending = await getPendingApprovals(testDir);
      expect(pending.length).toBe(1);
      expect(pending[0].target_id).toBe('mem_456');
    });

    it('should fail for already quarantined memory', async () => {
      await controller.quarantineMemory(
        'mem_789',
        'First quarantine',
        { tenant_id: testTenant, force: true },
      );

      const result = await controller.quarantineMemory(
        'mem_789',
        'Second quarantine',
        { tenant_id: testTenant, force: true },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already quarantined');
    });

    it('should preserve original content if provided', async () => {
      await controller.quarantineMemory(
        'mem_content',
        'Content backup test',
        {
          tenant_id: testTenant,
          force: true,
          original_content: 'This is the original content',
        },
      );

      const quarantined = await getQuarantinedMemories('active', testDir);
      const memory = quarantined.find(m => m.memory_id === 'mem_content');
      expect(memory?.original_content).toBe('This is the original content');
    });
  });

  describe('quarantineAgent', () => {
    it('should quarantine an agent with force=true', async () => {
      const result = await controller.quarantineAgent(
        'agent_123',
        'Critical incident escalation',
        {
          tenant_id: testTenant,
          force: true,
          blocked_operations: ['write', 'execute'],
        },
      );

      expect(result.success).toBe(true);
      expect(result.requires_approval).toBe(false);
      expect(result.event.action).toBe('quarantine_agent');
    });

    it('should set default blocked operations', async () => {
      await controller.quarantineAgent(
        'agent_456',
        'Default operations test',
        { tenant_id: testTenant, force: true },
      );

      const quarantined = await getQuarantinedAgents('active', testDir);
      const agent = quarantined.find(a => a.agent_id === 'agent_456');
      expect(agent?.blocked_operations).toContain('write');
      expect(agent?.blocked_operations).toContain('execute');
    });
  });

  describe('releaseMemory', () => {
    it('should release a quarantined memory', async () => {
      await controller.quarantineMemory(
        'mem_release',
        'Will be released',
        { tenant_id: testTenant, force: true },
      );

      const result = await controller.releaseMemory(
        'mem_release',
        'False positive',
        'test-user',
      );

      expect(result.success).toBe(true);
      expect(result.event.action).toBe('release_memory');

      const quarantined = await getQuarantinedMemories('active', testDir);
      expect(quarantined.find(m => m.memory_id === 'mem_release')).toBeUndefined();
    });

    it('should fail for non-quarantined memory', async () => {
      const result = await controller.releaseMemory(
        'mem_never_quarantined',
        'Try to release',
        'test-user',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in quarantine');
    });

    it('should track who released', async () => {
      await controller.quarantineMemory(
        'mem_track',
        'Track release',
        { tenant_id: testTenant, force: true },
      );

      await controller.releaseMemory('mem_track', 'Released', 'admin');

      const all = await getQuarantinedMemories(undefined, testDir);
      const memory = all.find(m => m.memory_id === 'mem_track');
      expect(memory?.status).toBe('released');
      expect(memory?.released_by).toBe('admin');
      expect(memory?.released_at).toBeDefined();
    });
  });

  describe('releaseAgent', () => {
    it('should release a quarantined agent', async () => {
      await controller.quarantineAgent(
        'agent_release',
        'Will be released',
        { tenant_id: testTenant, force: true },
      );

      const result = await controller.releaseAgent(
        'agent_release',
        'Investigation complete',
        'admin',
      );

      expect(result.success).toBe(true);
      expect(result.event.action).toBe('release_agent');
    });
  });

  describe('approveAction', () => {
    it('should approve a pending quarantine', async () => {
      // Create a pending approval
      await controller.quarantineMemory(
        'mem_pending',
        'Pending approval',
        { tenant_id: testTenant },
      );

      const pending = await getPendingApprovals(testDir);
      expect(pending.length).toBe(1);

      // Approve it
      const result = await controller.approveAction(pending[0].id, 'approver');

      expect(result.success).toBe(true);
      expect(result.requires_approval).toBe(false);

      // Verify quarantine is now active
      const quarantined = await getQuarantinedMemories('active', testDir);
      expect(quarantined.find(m => m.memory_id === 'mem_pending')).toBeDefined();

      // Verify pending is cleared
      const pendingAfter = await getPendingApprovals(testDir);
      expect(pendingAfter.length).toBe(0);
    });
  });

  describe('dismissApproval', () => {
    it('should dismiss a pending approval', async () => {
      await controller.quarantineMemory(
        'mem_dismiss',
        'Will be dismissed',
        { tenant_id: testTenant },
      );

      const pending = await getPendingApprovals(testDir);
      const result = await controller.dismissApproval(
        pending[0].id,
        'dismisser',
        'Not a real threat',
      );

      expect(result.success).toBe(true);
      expect(result.event.action).toBe('dismiss');

      // Verify pending is cleared
      const pendingAfter = await getPendingApprovals(testDir);
      expect(pendingAfter.length).toBe(0);

      // Verify memory was not quarantined
      const quarantined = await getQuarantinedMemories('active', testDir);
      expect(quarantined.find(m => m.memory_id === 'mem_dismiss')).toBeUndefined();
    });
  });

  describe('handleIncident', () => {
    it('should handle incident based on policy', async () => {
      // Create a mock incident
      const incident: IntegrityIncident = {
        id: 'ii_test_incident',
        created_at: new Date().toISOString(),
        severity: 'high',
        type: 'honeyfact_leak',
        events: [
          {
            id: 'te_1',
            timestamp: new Date().toISOString(),
            honeyfact_id: 'hf_1',
            detected_in: 'output',
            confidence: 1.0,
            context: {
              matched_content: 'CANARY_TOKEN',
              memory_id: 'mem_affected',
            },
            tenant_id: testTenant,
          },
        ],
        status: 'open',
        tenant_id: testTenant,
        updated_at: new Date().toISOString(),
      };

      const results = await controller.handleIncident(incident);

      // Should have at least one containment action
      expect(results.length).toBeGreaterThan(0);
    });

    it('should escalate to agent quarantine for critical incidents', async () => {
      // Update config to auto-escalate
      await controller.updateConfig({
        policy: 'auto',
        auto_escalate_critical: true,
      });

      const incident: IntegrityIncident = {
        id: 'ii_critical',
        created_at: new Date().toISOString(),
        severity: 'critical',
        type: 'honeyfact_leak',
        events: [
          {
            id: 'te_crit',
            timestamp: new Date().toISOString(),
            honeyfact_id: 'hf_crit',
            detected_in: 'external',
            confidence: 1.0,
            context: {
              matched_content: 'API_KEY',
              session_id: 'session_123',
            },
            tenant_id: testTenant,
          },
        ],
        status: 'open',
        tenant_id: testTenant,
        updated_at: new Date().toISOString(),
      };

      const results = await controller.handleIncident(incident);

      // Should include agent quarantine for critical
      const agentQuarantine = results.find(r =>
        r.event.action === 'quarantine_agent'
      );
      expect(agentQuarantine).toBeDefined();
    });
  });

  describe('isMemoryQuarantined', () => {
    it('should return true for quarantined memory', async () => {
      await controller.quarantineMemory(
        'mem_check',
        'Check status',
        { tenant_id: testTenant, force: true },
      );

      const isQuarantined = await controller.isMemoryQuarantined('mem_check');
      expect(isQuarantined).toBe(true);
    });

    it('should return false for non-quarantined memory', async () => {
      const isQuarantined = await controller.isMemoryQuarantined('mem_not_exists');
      expect(isQuarantined).toBe(false);
    });

    it('should return false for released memory', async () => {
      await controller.quarantineMemory(
        'mem_released',
        'Was quarantined',
        { tenant_id: testTenant, force: true },
      );
      await controller.releaseMemory('mem_released', 'Released', 'admin');

      const isQuarantined = await controller.isMemoryQuarantined('mem_released');
      expect(isQuarantined).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return containment status summary', async () => {
      // Create some quarantines
      await controller.quarantineMemory('mem_1', 'Test 1', { tenant_id: testTenant, force: true });
      await controller.quarantineMemory('mem_2', 'Test 2', { tenant_id: testTenant, force: true });
      await controller.quarantineAgent('agent_1', 'Test', { tenant_id: testTenant, force: true });

      const status = await controller.getStatus();

      expect(status.policy).toBe('approve'); // Default
      expect(status.quarantined_memories).toBe(2);
      expect(status.quarantined_agents).toBe(1);
      expect(status.recent_events.length).toBe(3);
      expect(status.last_action_at).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update containment configuration', async () => {
      const newConfig = await controller.updateConfig({
        policy: 'auto',
        auto_escalate_critical: false,
      });

      expect(newConfig.policy).toBe('auto');
      expect(newConfig.auto_escalate_critical).toBe(false);

      // Verify persisted
      const loadedConfig = await getContainmentConfig(testDir);
      expect(loadedConfig.policy).toBe('auto');
    });
  });
});

describe('Containment Audit Trail', () => {
  let testDir: string;
  let controller: ContainmentController;

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-audit-${randomUUID()}`);
    controller = new ContainmentController(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should maintain complete audit trail', async () => {
    // Perform a series of actions
    await controller.quarantineMemory('mem_audit', 'Audit test', {
      tenant_id: 'audit',
      force: true,
      initiated_by: 'admin',
    });

    await controller.releaseMemory('mem_audit', 'Clear', 'admin');

    const events = await getContainmentEvents(testDir);

    expect(events.length).toBe(2);
    expect(events[0].action).toBe('quarantine_memory');
    expect(events[1].action).toBe('release_memory');

    // Each event should have required fields
    for (const event of events) {
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.target_id).toBe('mem_audit');
      expect(event.reason).toBeDefined();
    }
  });
});

describe('Critical Workflow Disruption', () => {
  // MVP criteria: Critical workflow disruption < 2%

  it('should not quarantine without proper triggers', async () => {
    const testDir = join(tmpdir(), `savestate-workflow-${randomUUID()}`);
    const controller = new ContainmentController(testDir);

    try {
      // Simulate normal workflow - should not trigger false quarantines
      const normalOperations = 100;
      let disruptions = 0;

      // Just check that controller operations don't fail unexpectedly
      for (let i = 0; i < normalOperations; i++) {
        const isQuarantined = await controller.isMemoryQuarantined(`mem_${i}`);
        if (isQuarantined) {
          disruptions++;
        }
      }

      // No memories should be quarantined without explicit action
      const disruptionRate = disruptions / normalOperations;
      expect(disruptionRate).toBeLessThan(0.02); // < 2%
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
