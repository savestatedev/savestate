import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

type LockPackage = {
  version?: string;
  name?: string;
};

type PackageLock = {
  packages: Record<string, LockPackage>;
};

function vercelNodePathToRegexpVersion(lock: PackageLock): string | undefined {
  const nested = lock.packages['node_modules/@vercel/node/node_modules/path-to-regexp']?.version;
  if (nested) {
    return nested;
  }
  return lock.packages['node_modules/path-to-regexp']?.version;
}

describe('vercel node API types', () => {
  it('resolves @vercel/node and accepts VercelRequest/VercelResponse handlers', () => {
    const pkg = require('@vercel/node/package.json') as { version: string };
    expect(pkg.version.startsWith('5.')).toBe(true);
    expect(require.resolve('@vercel/node')).toContain('@vercel/node');

    const handler = (req: VercelRequest, res: VercelResponse): void => {
      res.status(204).end(req.method ?? 'GET');
    };
    expect(typeof handler).toBe('function');
  });

  it('keeps vercel.json parseable and pins the nested path-to-regexp patch', () => {
    const config = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8')) as {
      version: number;
      outputDirectory: string;
    };
    expect(config.version).toBe(2);
    expect(config.outputDirectory).toBe('site');

    const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as PackageLock;
    expect(lock.packages['node_modules/@vercel/node']?.version).toBe('5.5.28');
    expect(vercelNodePathToRegexpVersion(lock)).toBe('6.3.0');
  });
});
