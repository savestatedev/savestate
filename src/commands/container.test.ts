import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../../src/cli.ts');
const tmpDir = path.resolve(__dirname, '../tmp');

describe('Container CLI Commands', () => {
  // Ensure temp directory exists
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  // Cleanup temp files
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should perform a successful export-import round trip', async () => {
    const outputPath = path.join(tmpDir, 'test-agent.savestate');
    const agentId = 'test-round-trip-agent';
    const passphrase = 'test-round-trip-password';

    // 1. Export the state
    const exportResult = await execa(
      'node',
      [
        '--loader',
        'tsx',
        cliPath,
        'container',
        'export',
        '--agent',
        agentId,
        '--out',
        outputPath,
        '--passphrase',
        passphrase,
      ],
      { reject: false },
    );

    expect(exportResult.exitCode).toBe(0);
    expect(exportResult.stdout).toContain(
      `Successfully exported agent '${agentId}' to ${outputPath}`,
    );
    
    // Check that the file was created
    const stats = await fs.stat(outputPath);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(50); // Magic header + manifest + some data

    // 2. Import the state
    const importResult = await execa(
      'node',
      [
        '--loader',
        'tsx',
        cliPath,
        'container',
        'import',
        '--in',
        outputPath,
        '--passphrase',
        passphrase,
      ],
      { reject: false },
    );

    expect(importResult.exitCode).toBe(0);
    expect(importResult.stdout).toContain(
      `(Placeholder) Restoring state for agent: ${agentId}`,
    );
    expect(importResult.stdout).toContain(
      `Successfully imported and restored agent '${agentId}' from ${outputPath}`,
    );
  });

  it('should fail import with a wrong passphrase', async () => {
    const outputPath = path.join(tmpDir, 'test-agent-badpass.savestate');
    const agentId = 'test-badpass-agent';
    const correctPass = 'correct-password';
    const wrongPass = 'wrong-password';

    // Export
    await execa('node', [
      '--loader',
      'tsx',
      cliPath,
      'container',
      'export',
      '-a',
      agentId,
      '-o',
      outputPath,
      '-p',
      correctPass,
    ]);

    // Import with wrong password
    const importResult = await execa(
      'node',
      [
        '--loader',
        'tsx',
        cliPath,
        'container',
        'import',
        '-i',
        outputPath,
        '-p',
        wrongPass,
      ],
      { reject: false },
    );

    expect(importResult.exitCode).toBe(1);
    expect(importResult.stderr).toContain('Import failed:');
    expect(importResult.stderr).toContain('Decryption failed');
  });
});
