import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportState, validateIncludedComponents } from '../container.js';

function readManifest(file: Buffer): { components?: string[] } {
  const manifestLength = file.readUInt32LE(16);
  return JSON.parse(file.subarray(20, 20 + manifestLength).toString('utf-8'));
}

describe('savestate export component schema', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `savestate-export-components-schema-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('rejects unknown and empty component lists', () => {
    expect(validateIncludedComponents('memory')).toEqual({
      error: 'Error: components must be an array of known state paths.',
    });
    expect(validateIncludedComponents([])).toEqual({
      error: 'Error: components must include at least one path.',
    });
    expect(validateIncludedComponents(['memory', 'secrets'])).toEqual({
      error: 'Error: Unknown component: secrets. Allowed: personality, memory, tools, preferences, conversation_history.',
    });
    expect(validateIncludedComponents(['memory', 'memory'])).toEqual({
      error: 'Error: Duplicate component: memory.',
    });
  });

  it('accepts known include paths and writes them on export', async () => {
    expect(validateIncludedComponents(['memory', 'tools'])).toEqual({
      components: ['memory', 'tools'],
    });

    const filePath = join(testDir, 'schema-valid.savestate');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await exportState({
      agent: 'fixture-agent',
      out: filePath,
      passphrase: 'synthetic-passphrase',
      include: 'memory,tools',
    });

    const written = await fs.readFile(filePath);
    const manifest = readManifest(written);

    expect(result).toEqual({ written: true, out: filePath, overwritten: false });
    expect(manifest.components).toEqual(['memory', 'tools']);
    expect(validateIncludedComponents(manifest.components)).toEqual({
      components: ['memory', 'tools'],
    });
    log.mockRestore();
  });
});
