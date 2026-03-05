/**
 * Tests for Portable Encrypted State Container
 * Issue #104
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  exportContainer,
  importContainer,
  validateContainer,
  verifyContainer,
  getContainerInfo,
  createEmptyAgentState,
  AgentState,
  CONTAINER_FORMAT_VERSION,
  CURRENT_SCHEMA_VERSION
} from '../index.js';

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
  
  it('should verify a valid container (checksum + decrypt + schema)', async () => {
    const agentId = 'test-agent-verify';
    const outputPath = join(TEST_DIR, 'test-agent-verify.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, { agentId, passphrase: TEST_PASSPHRASE, outputPath });

    const result = verifyContainer(outputPath, TEST_PASSPHRASE);
    expect(result.status).toBe('valid');
    expect(result.errors.length).toBe(0);
    expect(result.metadata?.agent_name).toBe(agentId);
  });

  it('should report wrong_password when checksum passes but passphrase is incorrect', async () => {
    const agentId = 'test-agent-verify-wrong-pass';
    const outputPath = join(TEST_DIR, 'test-agent-verify-wrong-pass.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, { agentId, passphrase: TEST_PASSPHRASE, outputPath });

    const result = verifyContainer(outputPath, 'wrong-password');
    expect(result.status).toBe('wrong_password');
  });

  it('should report corrupted when checksum verification fails', async () => {
    const agentId = 'test-agent-verify-tamper';
    const outputPath = join(TEST_DIR, 'test-agent-verify-tamper.savestate');
    const state = createTestState(agentId);

    await exportContainer(state, { agentId, passphrase: TEST_PASSPHRASE, outputPath });

    const raw = readFileSync(outputPath, 'utf8');
    const json = JSON.parse(raw) as any;
    // Tamper with ciphertext so checksum fails
    json.encrypted_payload.ciphertext = json.encrypted_payload.ciphertext.slice(0, -2) + 'aa';
    writeFileSync(outputPath, JSON.stringify(json, null, 2));

    const result = verifyContainer(outputPath, TEST_PASSPHRASE);
    expect(result.status).toBe('corrupted');
    expect(result.errors.join('\n')).toContain('Checksum');
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
