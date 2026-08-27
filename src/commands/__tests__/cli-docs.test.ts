import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const docs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../site/docs/cli.html'),
  'utf8',
);

describe('CLI docs', () => {
  it('lists savestate export and import in the command overview', () => {
    expect(docs).toContain('id="export"');
    expect(docs).toContain('id="import"');
    expect(docs).toContain('savestate export');
    expect(docs).toContain('savestate import');
  });

  it('documents export --dry-run and --force', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    expect(exportSection).toContain('--dry-run');
    expect(exportSection).toContain('--force');
    expect(exportSection).toContain('without writing');
  });

  it('documents import --target, --force, and missing parent rejection', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--target');
    expect(importSection).toContain('--force');
    expect(importSection).toContain('missing parent directory');
  });

  it('documents verify rejecting a missing input path', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'));
    expect(verifySection).toContain('missing');
  });

  it('lists savestate inspect in the command overview', () => {
    expect(docs).toContain('id="inspect"');
    expect(docs).toContain('savestate inspect');
  });

  it('documents inspect --json and latest without restoring', () => {
    const inspectSection = docs.slice(docs.indexOf('id="inspect"'), docs.indexOf('id="diff"'));
    expect(inspectSection).toContain('--json');
    expect(inspectSection).toContain('latest');
    expect(inspectSection).toContain('without restoring');
  });
});
