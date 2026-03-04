/**
 * Tests for Portable Encrypted State Container
 * Issue #104
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  exportContainer,
  importContainer,
  validateContainer,
  getContainerInfo,
  createEmptyAgentState,
  AgentState,
  CONTAINER_FORMAT_VERSION,
  CURRENT_SCHEMA_VERSION
} from '../container/index.js';

const TEST_DIR = join(process.cwd(), 'test-tmp-container');
const TEST_PASSPHRASE = 'test-password-123';

describe('Portable State Container', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  const createTestState = (name: string): AgentState => ({
    ...createEmptyAgentState(name),
    preferences: { theme: 'dark' },
    memories: [{ id: 'mem1', content: 'Test memory', created_at: new Date().toISOString() }],
  });

  it('should export and import a container successfully', async () => {
    const agentId = 'test-agent';
    const outputPath = join(TEST_DIR, 'test-agent.savestate');
    const state = createTestState(agentId);

    // Export
    const exportResult = await exportContainer(state, {
      agentId,
      passphrase: TEST_PASSPHRASE,
      outputPath,
      description: 'A test container',
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.path).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);

    // Import
    const importResult = await importContainer({
      filePath: outputPath,
      passphrase: TEST_PASSPHRASE,
    });

    expect(importResult.success).toBe(true);
    expect(importResult.agentId).toBe(agentId);
    expect(importResult.state?.identity.name).toBe(agentId);
    expect(importResult.state?.preferences).toEqual({ theme: 'dark' });
    expect(importResult.state?.memories?.length).toBe(1);
    expect(importResult.state?.memories?.[0].content).toBe('Test memory');
  });

  it('should fail import with incorrect passphrase', async () => {
    const agentId = 'test-agent-pass';
    const outputPath = join(TEST_DIR, 'test-agent-pass.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, {
      agentId,
      passphrase: TEST_PASSPHRASE,
      outputPath,
    });

    const importResult = await importContainer({
      filePath: outputPath,
      passphrase: 'wrong-password',
    });

    expect(importResult.success).toBe(false);
    expect(importResult.error).toContain('incorrect passphrase');
  });

  it('should validate a valid container', async () => {
    const agentId = 'test-agent-valid';
    const outputPath = join(TEST_DIR, 'test-agent-valid.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, { agentId, passphrase: TEST_PASSPHRASE, outputPath });

    const validationResult = validateContainer(outputPath);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors.length).toBe(0);
    expect(validationResult.metadata?.agent_name).toBe(agentId);
  });
  
  it('should get info from a valid container', async () => {
    const agentId = 'test-agent-info';
    const outputPath = join(TEST_DIR, 'test-agent-info.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, { agentId, passphrase: TEST_PASSPHRASE, outputPath });

    const info = getContainerInfo(outputPath);
    expect(info).not.toBeNull();
    expect(info?.agent_name).toBe(agentId);
    expect(info?.schema_version).toBe(CURRENT_SCHEMA_VERSION);
  });
});
