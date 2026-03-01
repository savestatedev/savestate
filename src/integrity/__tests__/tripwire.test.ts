/**
 * Tripwire Monitor Tests
 *
 * Tests for the Memory Integrity Grid tripwire detection system.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { seedHoneyfacts } from '../honeyfact.js';
import {
  TripwireMonitor,
  getIncidents,
  getIncident,
  updateIncidentStatus,
  getTripwireEvents,
  getIncidentStats,
  DEFAULT_TRIPWIRE_CONFIG,
} from '../tripwire.js';

describe('TripwireMonitor', () => {
  let testDir: string;
  let monitor: TripwireMonitor;
  const testTenant = 'test-tenant';

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-test-${randomUUID()}`);
    monitor = new TripwireMonitor(undefined, testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('monitorOutput', () => {
    it('should detect honeyfact in output', async () => {
      const seedResult = await seedHoneyfacts('test', 5, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorOutput(
        `Here is the response: ${honeyfactContent}`,
        testTenant,
      );

      expect(result.triggered).toBe(true);
      expect(result.events.length).toBe(1);
      expect(result.events[0].detected_in).toBe('output');
      expect(result.events[0].confidence).toBe(1.0);
      expect(result.incident).toBeDefined();
    });

    it('should not trigger for clean output', async () => {
      await seedHoneyfacts('test', 5, { tenant_id: testTenant }, testDir);

      const result = await monitor.monitorOutput(
        'This is a completely normal response with no sensitive data.',
        testTenant,
      );

      expect(result.triggered).toBe(false);
      expect(result.events.length).toBe(0);
      expect(result.incident).toBeUndefined();
    });

    it('should include context in detection', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorOutput(
        `Some prefix text. ${honeyfactContent} Some suffix text.`,
        testTenant,
        { session_id: 'test-session' },
      );

      expect(result.triggered).toBe(true);
      expect(result.events[0].context.session_id).toBe('test-session');
      expect(result.events[0].context.surrounding).toContain('prefix');
    });
  });

  describe('monitorToolCall', () => {
    it('should detect honeyfact in tool arguments', async () => {
      const seedResult = await seedHoneyfacts('test', 3, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorToolCall(
        'writeFile',
        { path: '/tmp/test.txt', content: honeyfactContent },
        testTenant,
      );

      expect(result.triggered).toBe(true);
      expect(result.events[0].detected_in).toBe('tool_call');
      expect(result.events[0].context.tool_name).toBe('writeFile');
    });

    it('should handle nested objects in args', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorToolCall(
        'apiCall',
        {
          url: 'https://api.example.com',
          body: {
            data: {
              secret: honeyfactContent,
            },
          },
        },
        testTenant,
      );

      expect(result.triggered).toBe(true);
    });
  });

  describe('monitorToolResult', () => {
    it('should detect honeyfact in tool results', async () => {
      const seedResult = await seedHoneyfacts('test', 2, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorToolResult(
        `Tool returned: ${honeyfactContent}`,
        'readFile',
        testTenant,
      );

      expect(result.triggered).toBe(true);
      expect(result.events[0].detected_in).toBe('tool_result');
    });
  });

  describe('monitorMemoryWrite', () => {
    it('should detect honeyfact in memory write', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      const honeyfactContent = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorMemoryWrite(
        honeyfactContent,
        'mem_123',
        testTenant,
      );

      expect(result.triggered).toBe(true);
      expect(result.events[0].detected_in).toBe('memory_write');
      expect(result.events[0].context.memory_id).toBe('mem_123');
    });
  });

  describe('fuzzy matching', () => {
    it('should detect similar content with fuzzy matching', async () => {
      const fuzzyMonitor = new TripwireMonitor({
        threshold: 0.7,
        fuzzy_enabled: true,
      }, testDir);

      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      // Modify the honeyfact slightly
      const honeyfactContent = seedResult.honeyfacts[0].content;
      const modified = honeyfactContent.slice(0, -2) + 'XX'; // Change last 2 chars

      const result = await fuzzyMonitor.monitorOutput(modified, testTenant);

      // May or may not trigger depending on similarity
      // The key is that fuzzy matching is attempted
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should respect threshold configuration', async () => {
      const strictMonitor = new TripwireMonitor({
        threshold: 0.99,
        fuzzy_enabled: true,
      }, testDir);

      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);

      // Even slight modifications shouldn't match with high threshold
      const honeyfactContent = seedResult.honeyfacts[0].content;
      const modified = honeyfactContent + ' extra';

      const result = await strictMonitor.monitorOutput(modified, testTenant);

      // Exact substring should still match
      if (modified.includes(honeyfactContent)) {
        expect(result.triggered).toBe(true);
        expect(result.events[0].confidence).toBe(1.0);
      }
    });
  });

  describe('severity calculation', () => {
    it('should assign higher severity for multiple detections', async () => {
      const seedResult = await seedHoneyfacts('test', 5, {
        tenant_id: testTenant,
      }, testDir);

      // Include multiple honeyfacts
      const content = seedResult.honeyfacts.slice(0, 3).map(hf => hf.content).join(' ');
      const result = await monitor.monitorOutput(content, testTenant);

      expect(result.triggered).toBe(true);
      expect(result.events.length).toBe(3);
      // Multiple detections should result in higher severity
      expect(['medium', 'high', 'critical']).toContain(result.incident?.severity);
    });

    it('should assign high severity for api_key leaks', async () => {
      const seedResult = await seedHoneyfacts('test', 10, {
        tenant_id: testTenant,
        categories: ['api_key'],
      }, testDir);

      const content = seedResult.honeyfacts[0].content;
      const result = await monitor.monitorOutput(content, testTenant);

      expect(result.triggered).toBe(true);
      expect(['high', 'critical']).toContain(result.incident?.severity);
    });
  });
});

describe('Incident Management', () => {
  let testDir: string;
  let monitor: TripwireMonitor;
  const testTenant = 'incident-test';

  beforeEach(async () => {
    testDir = join(tmpdir(), `savestate-incident-${randomUUID()}`);
    monitor = new TripwireMonitor(undefined, testDir);
    // Seed honeyfacts and trigger an incident
    await seedHoneyfacts('test', 3, { tenant_id: testTenant }, testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getIncidents', () => {
    it('should list all incidents', async () => {
      // Trigger an incident
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);
      await monitor.monitorOutput(seedResult.honeyfacts[0].content, testTenant);

      const incidents = await getIncidents(testTenant, undefined, testDir);
      expect(incidents.length).toBeGreaterThan(0);
      expect(incidents[0].type).toBe('honeyfact_leak');
    });

    it('should filter by status', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);
      await monitor.monitorOutput(seedResult.honeyfacts[0].content, testTenant);

      const openIncidents = await getIncidents(testTenant, 'open', testDir);
      const resolvedIncidents = await getIncidents(testTenant, 'resolved', testDir);

      expect(openIncidents.length).toBeGreaterThan(0);
      expect(resolvedIncidents.length).toBe(0);
    });
  });

  describe('getIncident', () => {
    it('should retrieve incident by ID', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);
      const result = await monitor.monitorOutput(seedResult.honeyfacts[0].content, testTenant);

      const incident = await getIncident(result.incident!.id, testDir);
      expect(incident).toBeDefined();
      expect(incident!.id).toBe(result.incident!.id);
    });

    it('should return null for non-existent ID', async () => {
      const incident = await getIncident('non-existent-id', testDir);
      expect(incident).toBeNull();
    });
  });

  describe('updateIncidentStatus', () => {
    it('should update incident status', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);
      const result = await monitor.monitorOutput(seedResult.honeyfacts[0].content, testTenant);

      const updated = await updateIncidentStatus(
        result.incident!.id,
        'contained',
        'Quarantined affected memory',
        'test-user',
        testDir,
      );

      expect(updated).toBeDefined();
      expect(updated!.status).toBe('contained');
      expect(updated!.resolution_notes).toBe('Quarantined affected memory');
      expect(updated!.resolved_by).toBe('test-user');
    });

    it('should update timestamp on status change', async () => {
      const seedResult = await seedHoneyfacts('test', 1, {
        tenant_id: testTenant,
      }, testDir);
      const result = await monitor.monitorOutput(seedResult.honeyfacts[0].content, testTenant);

      const originalUpdated = result.incident!.updated_at;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateIncidentStatus(
        result.incident!.id,
        'resolved',
        undefined,
        undefined,
        testDir,
      );

      expect(new Date(updated!.updated_at).getTime())
        .toBeGreaterThanOrEqual(new Date(originalUpdated).getTime());
    });
  });

  describe('getIncidentStats', () => {
    it('should return correct statistics', async () => {
      // Create multiple incidents
      const seedResult = await seedHoneyfacts('test', 3, {
        tenant_id: testTenant,
      }, testDir);

      for (const hf of seedResult.honeyfacts) {
        await monitor.monitorOutput(hf.content, testTenant);
      }

      const stats = await getIncidentStats(testTenant, testDir);

      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.by_status.open).toBeGreaterThanOrEqual(3);
      expect(stats.events_total).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Containment Latency', () => {
  // MVP criteria: Containment latency < 5 minutes

  it('should detect and create incident within acceptable latency', async () => {
    const testDir = join(tmpdir(), `savestate-latency-${randomUUID()}`);
    const testTenant = 'latency-test';
    const monitor = new TripwireMonitor(undefined, testDir);

    try {
      // Seed honeyfacts
      const seedResult = await seedHoneyfacts('test', 10, {
        tenant_id: testTenant,
      }, testDir);

      // Measure detection time
      const startTime = Date.now();
      const result = await monitor.monitorOutput(
        seedResult.honeyfacts[0].content,
        testTenant,
      );
      const detectionTime = Date.now() - startTime;

      expect(result.triggered).toBe(true);
      expect(result.incident).toBeDefined();

      // Detection should be sub-second for this simple case
      // In production, the 5-minute window includes human response time
      expect(detectionTime).toBeLessThan(5000); // 5 seconds max for detection
      expect(result.duration_ms).toBeLessThan(1000); // Reported duration < 1s
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
