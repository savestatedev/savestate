import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

type LockPackage = {
  version?: string;
};

type PackageLock = {
  packages: Record<string, LockPackage>;
};

describe('MCP SDK hono floors', () => {
  it('resolves MCP stdio server imports without starting a transport', () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, 'node_modules/@modelcontextprotocol/sdk/package.json'), 'utf8'),
    ) as { version: string };
    expect(pkg.version).toBe('1.26.0');
    expect(Server).toBeTypeOf('function');
    expect(StdioServerTransport).toBeTypeOf('function');
  });

  it('pins nested hono and @hono/node-server patches', () => {
    const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as PackageLock;
    expect(lock.packages['node_modules/@modelcontextprotocol/sdk']?.version).toBe('1.26.0');
    expect(lock.packages['node_modules/hono']?.version).toBe('4.12.34');
    expect(lock.packages['node_modules/@hono/node-server']?.version).toBe('1.19.17');
  });
});
