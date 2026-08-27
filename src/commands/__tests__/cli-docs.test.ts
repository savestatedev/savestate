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
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('missing');
  });

  it('lists savestate prune in the command overview', () => {
    expect(docs).toContain('id="prune"');
    expect(docs).toContain('savestate prune');
  });

  it('documents prune --keep-last, --older-than, and --apply dry-run default', () => {
    const pruneSection = docs.slice(docs.indexOf('id="prune"'), docs.indexOf('id="antibodies"'));
    expect(pruneSection).toContain('--keep-last');
    expect(pruneSection).toContain('--older-than');
    expect(pruneSection).toContain('--apply');
    expect(pruneSection).toContain('--json');
    expect(pruneSection).toContain('Dry-run is the default');
  });

  it('lists savestate antibodies in the command overview', () => {
    expect(docs).toContain('id="antibodies"');
    expect(docs).toContain('savestate antibodies');
  });

  it('documents antibodies list, add, preflight, and stats', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('list');
    expect(antibodiesSection).toContain('add');
    expect(antibodiesSection).toContain('preflight');
    expect(antibodiesSection).toContain('stats');
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('--tool');
    expect(antibodiesSection).toContain('--safe-action');
  });

  it('lists savestate schedule in the command overview', () => {
    expect(docs).toContain('id="schedule"');
    expect(docs).toContain('savestate schedule');
  });

  it('documents schedule --every, --disable, and --status', () => {
    const scheduleSection = docs.slice(docs.indexOf('id="schedule"'), docs.indexOf('id="migrate"'));
    expect(scheduleSection).toContain('--every');
    expect(scheduleSection).toContain('--disable');
    expect(scheduleSection).toContain('--status');
    expect(scheduleSection).toContain('Pro or Team');
    expect(scheduleSection).toContain('snapshot --label auto');
  });

  it('lists savestate migrate in the command overview', () => {
    expect(docs).toContain('id="migrate"');
    expect(docs).toContain('savestate migrate');
  });

  it('documents migrate --from, --to, --list, and --dry-run', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--from');
    expect(migrateSection).toContain('--to');
    expect(migrateSection).toContain('--list');
    expect(migrateSection).toContain('--dry-run');
    expect(migrateSection).toContain('compatibility report');
  });

  it('lists savestate trust in the command overview', () => {
    expect(docs).toContain('id="trust"');
    expect(docs).toContain('savestate trust');
  });

  it('documents trust status, audit, and deny', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('status');
    expect(trustSection).toContain('audit');
    expect(trustSection).toContain('deny');
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('--limit');
    expect(trustSection).toContain('--reason');
    expect(trustSection).toContain('WriteGate');
  });

  it('lists savestate team in the command overview', () => {
    expect(docs).toContain('id="team"');
    expect(docs).toContain('savestate team');
  });

  it('documents team status, members, invite, and audit', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('status');
    expect(teamSection).toContain('members');
    expect(teamSection).toContain('invite');
    expect(teamSection).toContain('audit');
    expect(teamSection).toContain('--role');
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('--since');
    expect(teamSection).toContain('--until');
    expect(teamSection).toContain('--format');
    expect(teamSection).toContain('savestate login');
    expect(teamSection).toContain('admin');
    expect(teamSection).toContain('viewer');
  });

  it('lists savestate eval in the command overview', () => {
    expect(docs).toContain('id="eval"');
    expect(docs).toContain('savestate eval');
  });

  it('documents eval quality, report, and --threshold', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('quality');
    expect(evalSection).toContain('report');
    expect(evalSection).toContain('--threshold');
    expect(evalSection).toContain('--suite');
    expect(evalSection).toContain('--verbose');
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('0.7');
    expect(evalSection).toContain('.savestate/benchmarks/');
  });

  it('lists savestate login and logout in the command overview', () => {
    expect(docs).toContain('id="login"');
    expect(docs).toContain('id="logout"');
    expect(docs).toContain('savestate login');
    expect(docs).toContain('savestate logout');
  });

  it('documents login --key, ss_live_ keys, and logout removing the saved key', () => {
    const loginSection = docs.slice(docs.indexOf('id="login"'), docs.indexOf('id="logout"'));
    expect(loginSection).toContain('--key');
    expect(loginSection).toContain('ss_live_');
    expect(loginSection).toContain('savestate.dev/account');
    expect(loginSection).toContain('savestate init');
    const logoutSection = docs.slice(docs.indexOf('id="logout"'), docs.indexOf('id="context"'));
    expect(logoutSection).toContain('savestate logout');
    expect(logoutSection).toContain('saved cloud API key');
  });

  it('lists savestate context in the command overview', () => {
    expect(docs).toContain('id="context"');
    expect(docs).toContain('savestate context');
  });

  it('documents context compile, explain, validate, and config', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('compile');
    expect(contextSection).toContain('explain');
    expect(contextSection).toContain('validate');
    expect(contextSection).toContain('config');
    expect(contextSection).toContain('--agent');
    expect(contextSection).toContain('--task');
    expect(contextSection).toContain('--budget');
    expect(contextSection).toContain('--file');
    expect(contextSection).toContain('--weights');
    expect(contextSection).toContain('--json');
    expect(contextSection).toContain('4000');
    expect(contextSection).toContain('RunBrief');
  });

  it('lists savestate memory in the command overview', () => {
    expect(docs).toContain('id="memory"');
    expect(docs).toContain('savestate memory');
  });

  it('documents memory list, promote, expire, and log', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'));
    expect(memorySection).toContain('list');
    expect(memorySection).toContain('promote');
    expect(memorySection).toContain('demote');
    expect(memorySection).toContain('pin');
    expect(memorySection).toContain('explain');
    expect(memorySection).toContain('expire');
    expect(memorySection).toContain('log');
    expect(memorySection).toContain('--tier');
    expect(memorySection).toContain('--snapshot');
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('--dry-run');
    expect(memorySection).toContain('--reason');
    expect(memorySection).toContain('--namespace');
    expect(memorySection).toContain('L1/L2/L3');
    expect(memorySection).toContain('savestate init');
  });

  it('lists savestate stats in the command overview', () => {
    expect(docs).toContain('id="stats"');
    expect(docs).toContain('savestate stats');
  });

  it('documents stats --json without decrypting archives', () => {
    const statsSection = docs.slice(docs.indexOf('id="stats"'), docs.indexOf('id="doctor"'));
    expect(statsSection).toContain('--json');
    expect(statsSection).toContain('does not decrypt');
  });

  it('lists savestate doctor in the command overview', () => {
    expect(docs).toContain('id="doctor"');
    expect(docs).toContain('savestate doctor');
  });

  it('documents doctor --json, --adapter, and --limit', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="diff"'));
    expect(doctorSection).toContain('--json');
    expect(doctorSection).toContain('--adapter');
    expect(doctorSection).toContain('--limit');
    expect(doctorSection).toContain('checksums');
    expect(doctorSection).toContain('incremental chains');
  });
});
