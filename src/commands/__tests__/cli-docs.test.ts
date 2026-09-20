import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const docs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../site/docs/cli.html'),
  'utf8',
);

const cli = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../cli.ts'),
  'utf8',
);

const mcp = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../mcp.ts'),
  'utf8',
);

const acl = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../acl.ts'),
  'utf8',
);

const identity = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../identity.ts'),
  'utf8',
);

const integrity = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../integrity.ts'),
  'utf8',
);

const trace = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../trace.ts'),
  'utf8',
);

const container = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../container.ts'),
  'utf8',
);

const context = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../context.ts'),
  'utf8',
);

const slo = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../slo.ts'),
  'utf8',
);

const memoryCli = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../memory-cli.ts'),
  'utf8',
);

const memory = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../memory.ts'),
  'utf8',
);

const memoryLifecycle = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../memory-lifecycle.ts'),
  'utf8',
);

const evalSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../eval.ts'),
  'utf8',
);

const inspect = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../inspect.ts'),
  'utf8',
);

const cloud = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../cloud.ts'),
  'utf8',
);

const diff = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../diff.ts'),
  'utf8',
);

const restore = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../restore.ts'),
  'utf8',
);

const trust = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../trust.ts'),
  'utf8',
);

const team = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../team.ts'),
  'utf8',
);

const snapshot = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../snapshot.ts'),
  'utf8',
);

const verify = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../verify.ts'),
  'utf8',
);

const search = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../search.ts'),
  'utf8',
);

const configSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../config.ts'),
  'utf8',
);

const prune = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../prune.ts'),
  'utf8',
);

const schedule = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../schedule.ts'),
  'utf8',
);

const login = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../login.ts'),
  'utf8',
);

const migrate = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../migrate.ts'),
  'utf8',
);

const antibodies = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../antibodies.ts'),
  'utf8',
);

const listSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../list.ts'),
  'utf8',
);

const adapters = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../adapters.ts'),
  'utf8',
);

const doctor = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../doctor.ts'),
  'utf8',
);

const stats = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../stats.ts'),
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

  it('documents export --json', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    expect(exportSection).toContain('--json');
    expect(exportSection).toContain('Encrypts the archive');
    expect(exportSection).toContain('savestate export -a my-agent -o agent.savestate --json --dry-run');
  });

  it('documents export --json when missing', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    expect(exportSection).toContain('--json');
    expect(exportSection).toContain('scripting');
    expect(exportSection).toContain('found, output, written, agent');
    expect(exportSection).toContain('savestate export -a my-agent -o missing-dir/agent.savestate --json');
    expect(container).toContain('export function formatExportMissingJson');
  });

  it('documents export --output as a single path', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    expect(exportSection).toContain('--output');
    expect(exportSection).toContain('Must be a single non-empty path');
    expect(container).toContain('export function parseContainerOutput');
  });

  it('documents export --description as a non-empty description', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    expect(exportSection).toContain('--description');
    expect(exportSection).toContain('Must be a non-empty description');
    expect(container).toContain('export function parseContainerDescription');
  });

  it('documents import --target, --force, and missing parent rejection', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--target');
    expect(importSection).toContain('--force');
    expect(importSection).toContain('missing parent directory');
  });

  it('documents import --target as a single path', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--target');
    expect(importSection).toContain('Must be a single non-empty path');
    expect(container).toContain('export function parseContainerTarget');
  });

  it('documents import --in as a single path', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(importSection).toContain('input file must be a single non-empty path');
    expect(containerSection).toContain('--in');
    expect(containerSection).toContain('Must be a single non-empty path');
    expect(container).toContain('export function parseContainerInput');
  });

  it('documents container --out as a single path', () => {
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(containerSection).toContain('--out');
    expect(containerSection).toContain('Must be a single non-empty path');
    expect(container).toContain('export function parseContainerOut');
  });

  it('documents container --passphrase as non-empty', () => {
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(containerSection).toContain('--passphrase');
    expect(containerSection).toContain('An empty or whitespace-only value is rejected before encrypting or decrypting');
    expect(container).toContain('export function parseContainerPassphrase');
    expect(container).toContain('Passphrase for encryption (or SAVESTATE_PASSPHRASE / prompt; non-empty)');
  });

  it('documents container --keyfile as a single path', () => {
    const exportSection = docs.slice(docs.indexOf('id="export"'), docs.indexOf('id="import"'));
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(exportSection).toContain('--keyfile');
    expect(exportSection).toContain('Must be a single non-empty path');
    expect(importSection).toContain('--keyfile');
    expect(importSection).toContain('Must be a single non-empty path');
    expect(containerSection).toContain('--keyfile');
    expect(containerSection).toContain('Must be a single non-empty path');
    expect(container).toContain('export function parseContainerKeyfile');
    expect(container).toContain('Keyfile for encryption (alternative to passphrase; single non-empty path)');
    expect(container).toContain('Keyfile for decryption (alternative to passphrase; single non-empty path)');
  });

  it('documents import --json', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--json');
    expect(importSection).toContain('Decrypts the archive');
    expect(importSection).toContain('savestate import agent.savestate --json --dry-run');
  });

  it('documents import --json when missing', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--json');
    expect(importSection).toContain('scripting');
    expect(importSection).toContain('found, input, restored, agent');
    expect(importSection).toContain('savestate import missing.savestate --json');
    expect(container).toContain('export function formatImportMissingJson');
  });

  it('documents verify rejecting a missing input path', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('missing');
  });

  it('registers --json on savestate verify', () => {
    const verifyBlock = cli.slice(cli.indexOf("command('verify <file>')"), cli.indexOf('registerMemoryCommands'));
    expect(verifyBlock).toContain(".option('--json'");
  });

  it('documents verify --json', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('--json');
    expect(verifySection).toContain('scripting');
    expect(verifySection).toContain('savestate verify agent.savestate --json');
  });

  it('documents verify --json when missing', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('--json');
    expect(verifySection).toContain('scripting');
    expect(verifySection).toContain('found, input, valid, agent');
    expect(verifySection).toContain('savestate verify missing.savestate --json');
    expect(verify).toContain('export function formatVerifyMissingJson');
  });

  it('documents verify file as a single path', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('&lt;file&gt;');
    expect(verifySection).toContain('Must be a single non-empty path');
    expect(verify).toContain('export function parseVerifyFile');
    expect(cli).toContain('list packed components (single non-empty path)');
  });

  it('documents verify --keyfile as a single path', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('--keyfile');
    expect(verifySection).toContain('Must be a single non-empty path');
    expect(verify).toContain('export function parseVerifyKeyfile');
    expect(cli).toContain('Keyfile for verification (alternative to passphrase; single non-empty path)');
  });

  it('documents verify --passphrase as non-empty', () => {
    const verifySection = docs.slice(docs.indexOf('id="verify"'), docs.indexOf('id="prune"'));
    expect(verifySection).toContain('--passphrase');
    expect(verifySection).toContain('An empty or whitespace-only value is rejected before decrypting');
    expect(verify).toContain('export function parseVerifyPassphrase');
    expect(cli).toContain('Passphrase for verification (non-empty)');
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

  it('registers --json on savestate prune', () => {
    const pruneBlock = cli.slice(cli.indexOf("command('prune')"), cli.indexOf("command('diff <a> <b>')"));
    expect(pruneBlock).toContain(".option('--json'");
  });

  it('documents prune --json', () => {
    const pruneSection = docs.slice(docs.indexOf('id="prune"'), docs.indexOf('id="antibodies"'));
    expect(pruneSection).toContain('--json');
    expect(pruneSection).toContain('scripting');
    expect(pruneSection).toContain('savestate prune --keep-last 10 --json');
  });

  it('documents prune --keep-last as a bounded positive integer', () => {
    const pruneSection = docs.slice(docs.indexOf('id="prune"'), docs.indexOf('id="antibodies"'));
    expect(pruneSection).toContain('--keep-last');
    expect(pruneSection).toContain('positive integer up to 1000');
    expect(prune).toContain('export function parseKeepLast');
  });

  it('documents prune --older-than as an ISO 8601 date', () => {
    const pruneSection = docs.slice(docs.indexOf('id="prune"'), docs.indexOf('id="antibodies"'));
    expect(pruneSection).toContain('--older-than');
    expect(pruneSection).toContain('Must be an ISO 8601 date');
    expect(prune).toContain('export function parsePruneOlderThan');
  });

  it('documents prune --json when missing', () => {
    const pruneSection = docs.slice(docs.indexOf('id="prune"'), docs.indexOf('id="antibodies"'));
    expect(pruneSection).toContain('--json');
    expect(pruneSection).toContain('scripting');
    expect(pruneSection).toContain('found, dryRun, keepCount, dropCount');
    expect(pruneSection).toContain('savestate prune --json');
    expect(prune).toContain('export function formatPruneMissingJson');
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

  it('documents antibodies subcommand as a single antibodies action', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('&lt;subcommand&gt;');
    expect(antibodiesSection).toContain('Must be a single non-empty subcommand');
    expect(antibodies).toContain('export function parseAntibodiesSubcommand');
    expect(cli).toContain('single non-empty subcommand: list, add, preflight, or stats');
  });

  it('registers --json on savestate antibodies', () => {
    const antibodiesBlock = cli.slice(
      cli.indexOf("command('antibodies <subcommand>')"),
      cli.indexOf("command('eval <subcommand>')"),
    );
    expect(antibodiesBlock).toContain(".option('--json'");
  });

  it('documents antibodies --json', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('savestate antibodies list --json');
  });

  it('documents antibodies preflight --json', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('blocked, elapsed, semantic, and warnings with rule id, risk, intervention, confidence, safe action, and reasons');
    expect(antibodiesSection).toContain('savestate antibodies preflight --tool write --path ./secret.env --json');
  });

  it('documents antibodies preflight --json when missing', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('found, blocked, elapsedMs, semanticUsed');
    expect(antibodiesSection).toContain('savestate antibodies preflight --json');
    expect(antibodies).toContain('export function formatAntibodiesPreflightMissingJson');
  });

  it('documents antibodies list --json', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('id, risk, intervention, active, confidence, hits, overrides, and safe action');
    expect(antibodiesSection).toContain('savestate antibodies list --json');
  });

  it('documents antibodies list --json when missing', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('found, total, shown');
    expect(antibodiesSection).toContain('savestate antibodies list --json');
    expect(antibodies).toContain('export function formatAntibodiesListMissingJson');
  });

  it('documents antibodies stats --json', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('counts plus per-rule hits and overrides');
    expect(antibodiesSection).toContain('savestate antibodies stats --json');
  });

  it('documents antibodies stats --json when missing', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('found, totalRules, activeRules, retiredRules, totalHits, totalOverrides');
    expect(antibodiesSection).toContain('savestate antibodies stats --json');
    expect(antibodies).toContain('export function formatAntibodiesStatsMissingJson');
  });

  it('documents antibodies add --json', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('id, risk, safe action, and confidence');
    expect(antibodiesSection).toContain('savestate antibodies add --tool write --error-code EACCES --risk high --safe-action check_permissions --json');
  });

  it('documents antibodies add --json when missing', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--json');
    expect(antibodiesSection).toContain('scripting');
    expect(antibodiesSection).toContain('found, added, id');
    expect(antibodiesSection).toContain('savestate antibodies add --json');
    expect(antibodies).toContain('export function formatAntibodiesAddMissingJson');
  });

  it('documents antibodies --tool as a single tool name', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--tool');
    expect(antibodiesSection).toContain('Must be a single non-empty tool name');
    expect(antibodies).toContain('export function parseAntibodiesTool');
  });

  it('documents antibodies --error-code as a single error code', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--error-code');
    expect(antibodiesSection).toContain('Must be a single non-empty error code');
    expect(antibodies).toContain('export function parseAntibodiesErrorCode');
  });

  it('documents antibodies --path-prefix as a single path prefix', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--path-prefix');
    expect(antibodiesSection).toContain('Must be a single non-empty path prefix');
    expect(antibodies).toContain('export function parseAntibodiesPathPrefix');
  });

  it('documents antibodies --path as a single path', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--path');
    expect(antibodiesSection).toContain('Must be a single non-empty path');
    expect(antibodies).toContain('export function parseAntibodiesPath');
  });

  it('documents antibodies --tags as one or more non-empty antibody tags', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--tags');
    expect(antibodiesSection).toContain('Must be one or more non-empty antibody tags (comma-separated)');
    expect(antibodies).toContain('export function parseAntibodiesTags');
  });

  it('documents antibodies --id as a single rule id', () => {
    const antibodiesSection = docs.slice(docs.indexOf('id="antibodies"'), docs.indexOf('id="schedule"'));
    expect(antibodiesSection).toContain('--id');
    expect(antibodiesSection).toContain('Must be a single non-empty rule id');
    expect(antibodies).toContain('export function parseAntibodiesId');
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

  it('documents schedule --every as a bounded duration', () => {
    const scheduleSection = docs.slice(docs.indexOf('id="schedule"'), docs.indexOf('id="migrate"'));
    expect(scheduleSection).toContain('--every');
    expect(scheduleSection).toContain('duration like 1h, 6h, 12h, or 1d up to 7 days');
    expect(schedule).toContain('export function parseScheduleEvery');
  });

  it('registers --json on savestate schedule', () => {
    const scheduleBlock = cli.slice(cli.indexOf("command('schedule')"), cli.indexOf("command('migrate')"));
    expect(scheduleBlock).toContain(".option('--json'");
  });

  it('documents schedule --json', () => {
    const scheduleSection = docs.slice(docs.indexOf('id="schedule"'), docs.indexOf('id="migrate"'));
    expect(scheduleSection).toContain('--json');
    expect(scheduleSection).toContain('scripting');
    expect(scheduleSection).toContain('savestate schedule --json');
  });

  it('documents schedule --json when missing', () => {
    const scheduleSection = docs.slice(docs.indexOf('id="schedule"'), docs.indexOf('id="migrate"'));
    expect(scheduleSection).toContain('--json');
    expect(scheduleSection).toContain('scripting');
    expect(scheduleSection).toContain('found, enabled, running, supported');
    expect(scheduleSection).toContain('savestate schedule --json');
    expect(schedule).toContain('export function formatScheduleMissingJson');
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

  it('registers --json on savestate migrate', () => {
    const migrateBlock = cli.slice(cli.indexOf("command('migrate')"), cli.indexOf("command('cloud'"));
    expect(migrateBlock).toContain(".option('--json'");
  });

  it('documents migrate --json', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--json');
    expect(migrateSection).toContain('scripting');
    expect(migrateSection).toContain('savestate migrate --list --json');
    expect(migrateSection).toContain('savestate migrate --from chatgpt --to claude --dry-run --json');
    expect(migrateSection).toContain('omits source refs');
  });

  it('documents migrate --json when missing', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--json');
    expect(migrateSection).toContain('scripting');
    expect(migrateSection).toContain('found, source, target, feasibility');
    expect(migrateSection).toContain('savestate migrate --json');
    expect(migrate).toContain('export function formatMigrateMissingJson');
  });

  it('documents migrate --review, --resume, --include, --force, --verbose, and --no-color', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--review');
    expect(migrateSection).toContain('--resume');
    expect(migrateSection).toContain('--include');
    expect(migrateSection).toContain('--force');
    expect(migrateSection).toContain('--verbose');
    expect(migrateSection).toContain('--no-color');
    expect(migrateSection).toContain('instructions');
    expect(migrateSection).toContain('memories');
    expect(migrateSection).toContain('conversations');
    expect(migrateSection).toContain('files');
    expect(migrateSection).toContain('customBots');
    expect(migrateSection).toContain('manual attention');
    expect(migrateSection).toContain('interrupted');
  });

  it('documents migrate --include as known migrate types', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--include');
    expect(migrateSection).toContain('Must be one or more of: instructions, memories, conversations, files, customBots');
    expect(migrate).toContain('export function parseMigrateInclude');
  });

  it('documents migrate --from as a known platform', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--from');
    expect(migrateSection).toContain('Must be one of: chatgpt, claude, gemini, copilot');
    expect(migrate).toContain('export function parseMigrateFrom');
  });

  it('documents migrate --to as a known platform', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--to');
    expect(migrateSection).toContain('Must be one of: chatgpt, claude, gemini, copilot');
    expect(migrate).toContain('export function parseMigrateTo');
  });

  it('documents migrate --snapshot as a single snapshot id', () => {
    const migrateSection = docs.slice(docs.indexOf('id="migrate"'), docs.indexOf('id="trust"'));
    expect(migrateSection).toContain('--snapshot');
    expect(migrateSection).toContain('Must be a single non-empty snapshot id');
    expect(migrate).toContain('export function parseMigrateSnapshot');
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

  it('registers --json on savestate trust status', () => {
    const trustBlock = cli.slice(cli.indexOf("command('trust')"), cli.indexOf("command('prune')"));
    const statusBlock = trustBlock.slice(
      trustBlock.indexOf("command('status')"),
      trustBlock.indexOf("command('audit')"),
    );
    expect(statusBlock).toContain(".option('--json'");
  });

  it('documents trust --json', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('savestate trust status --json');
  });

  it('registers --json on savestate trust deny remove', () => {
    const trustBlock = cli.slice(cli.indexOf("command('trust')"), cli.indexOf("command('prune')"));
    const removeBlock = trustBlock.slice(
      trustBlock.indexOf("command('remove <pattern>')"),
      trustBlock.lastIndexOf("command('list')"),
    );
    expect(removeBlock).toContain(".option('--json'");
  });

  it('documents trust deny remove --json', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('pattern and removed count');
    expect(trustSection).toContain('savestate trust deny remove secret.env --json');
  });

  it('documents trust deny remove --json when missing', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('found, pattern, removed');
    expect(trustSection).toContain('savestate trust deny remove secret.env --json');
    expect(trust).toContain('export function formatTrustDenyRemoveMissingJson');
  });

  it('registers --json on savestate trust deny list', () => {
    const trustBlock = cli.slice(cli.indexOf("command('trust')"), cli.indexOf("command('prune')"));
    const listBlock = trustBlock.slice(trustBlock.lastIndexOf("command('list')"));
    expect(listBlock).toContain(".option('--json'");
  });

  it('documents trust deny list --json', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('pattern, reason, actor, and epoch');
    expect(trustSection).toContain('savestate trust deny list --json');
  });

  it('registers --json on savestate trust audit', () => {
    const trustBlock = cli.slice(cli.indexOf("command('trust')"), cli.indexOf("command('prune')"));
    const auditBlock = trustBlock.slice(
      trustBlock.indexOf("command('audit')"),
      trustBlock.indexOf("command('deny')"),
    );
    expect(auditBlock).toContain(".option('--json'");
  });

  it('documents trust audit --json', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('entry id, states, actor, and reason');
    expect(trustSection).toContain('savestate trust audit --json');
  });

  it('documents trust audit --limit as a bounded positive integer', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--limit');
    expect(trustSection).toContain('positive integer up to 1000');
    expect(trust).toContain('export function parseTrustAuditLimit');
  });

  it('documents trust --reason as a non-empty reason', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--reason');
    expect(trustSection).toContain('Must be a non-empty reason');
    expect(trust).toContain('export function parseTrustReason');
  });

  it('documents trust --by as a single actor id', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--by');
    expect(trustSection).toContain('Must be a single non-empty actor id');
    expect(trust).toContain('export function parseTrustBy');
  });

  it('documents trust deny pattern as a single denylist pattern', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('&lt;pattern&gt;');
    expect(trustSection).toContain('Must be a single non-empty denylist pattern');
    expect(trust).toContain('export function parseTrustPattern');
  });

  it('registers --json on savestate trust deny add', () => {
    const trustBlock = cli.slice(cli.indexOf("command('trust')"), cli.indexOf("command('prune')"));
    const addBlock = trustBlock.slice(
      trustBlock.indexOf("command('add <pattern>')"),
      trustBlock.indexOf("command('remove <pattern>')"),
    );
    expect(addBlock).toContain(".option('--json'");
  });

  it('documents trust deny add --json', () => {
    const trustSection = docs.slice(docs.indexOf('id="trust"'), docs.indexOf('id="team"'));
    expect(trustSection).toContain('--json');
    expect(trustSection).toContain('scripting');
    expect(trustSection).toContain('pattern, reason, and actor');
    expect(trustSection).toContain('savestate trust deny add secret.env --reason "contains credentials" --json');
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

  it('documents team subcommand as a single team action', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('&lt;subcommand&gt;');
    expect(teamSection).toContain('Must be a single non-empty subcommand');
    expect(team).toContain('export function parseTeamSubcommand');
    expect(cli).toContain('single non-empty subcommand: status, members, invite, or audit');
  });

  it('registers --json on savestate team status', () => {
    const statusBlock = cli.slice(
      cli.indexOf("command('team <subcommand> [args...]')"),
      cli.indexOf('registerTraceCommands(program)'),
    );
    expect(statusBlock).toContain(".option('--json'");
  });

  it('documents team status --json', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('id, name, and role');
    expect(teamSection).toContain('savestate team status --json');
  });

  it('documents team status --json when missing', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('found, id, name, role');
    expect(teamSection).toContain('savestate team status --json');
    expect(team).toContain('export function formatTeamStatusMissingJson');
  });

  it('registers --json on savestate team members', () => {
    const membersBlock = cli.slice(
      cli.indexOf("command('team <subcommand> [args...]')"),
      cli.indexOf('registerTraceCommands(program)'),
    );
    expect(membersBlock).toContain(".option('--json'");
  });

  it('documents team members --json', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('email, role, and invite timestamps');
    expect(teamSection).toContain('savestate team members --json');
  });

  it('documents team members --json when missing', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('found, name, total, shown');
    expect(teamSection).toContain('savestate team members --json');
    expect(team).toContain('export function formatTeamMembersMissingJson');
  });

  it('registers --json on savestate team invite', () => {
    const inviteBlock = cli.slice(
      cli.indexOf("command('team <subcommand> [args...]')"),
      cli.indexOf('registerTraceCommands(program)'),
    );
    expect(inviteBlock).toContain(".option('--json'");
  });

  it('documents team invite --role as known invite roles', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--role');
    expect(teamSection).toContain('Must be one of: admin, member, viewer');
    expect(team).toContain('export function parseTeamInviteRole');
  });

  it('documents team invite email as a single email address', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('&lt;email&gt;');
    expect(teamSection).toContain('Must be a single non-empty email address');
    expect(team).toContain('export function parseTeamInviteEmail');
  });

  it('documents team invite --json', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('invited email, role, and invite timestamps');
    expect(teamSection).toContain('savestate team invite user@example.com --role viewer --json');
  });

  it('documents team invite --json when missing', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('found, email, role');
    expect(teamSection).toContain('savestate team invite user@example.com --role viewer --json');
    expect(team).toContain('export function formatTeamInviteMissingJson');
  });

  it('documents team audit --format as known audit formats', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--format');
    expect(teamSection).toContain('Must be one of: csv, json');
    expect(team).toContain('export function parseTeamAuditFormat');
  });

  it('documents team audit --since as an ISO 8601 date', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--since');
    expect(teamSection).toContain('Must be an ISO 8601 date');
    expect(team).toContain('export function parseTeamAuditSince');
  });

  it('documents team audit --until as an ISO 8601 date', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--until');
    expect(teamSection).toContain('Must be an ISO 8601 date');
    expect(team).toContain('export function parseTeamAuditUntil');
  });

  it('registers --json on savestate team audit', () => {
    const auditBlock = cli.slice(
      cli.indexOf("command('team <subcommand> [args...]')"),
      cli.indexOf('registerTraceCommands(program)'),
    );
    expect(auditBlock).toContain(".option('--json'");
  });

  it('documents team audit --json', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('id, action, actor, resource, and timestamp');
    expect(teamSection).toContain('savestate team audit --json');
  });

  it('documents team audit --json when missing', () => {
    const teamSection = docs.slice(docs.indexOf('id="team"'), docs.indexOf('id="eval"'));
    expect(teamSection).toContain('--json');
    expect(teamSection).toContain('scripting');
    expect(teamSection).toContain('found, teamId, count, nextCursor');
    expect(teamSection).toContain('savestate team audit --json');
    expect(team).toContain('export function formatTeamAuditMissingJson');
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

  it('documents eval --threshold as a number between 0 and 1', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--threshold');
    expect(evalSection).toContain('number between 0 and 1');
    expect(evalSource).toContain('export function parseEvalThreshold');
  });

  it('documents eval --suite as a single non-empty name', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--suite');
    expect(evalSection).toContain('single non-empty name');
    expect(evalSource).toContain('export function parseEvalSuite');
  });

  it('documents eval subcommand as a single eval action', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('&lt;subcommand&gt;');
    expect(evalSection).toContain('Must be a single non-empty subcommand');
    expect(evalSource).toContain('export function parseEvalSubcommand');
    expect(cli).toContain('single non-empty subcommand: quality or report');
  });

  it('registers --json on savestate eval', () => {
    const evalBlock = cli.slice(cli.indexOf("command('eval <subcommand>')"), cli.indexOf("command('search <query>')"));
    expect(evalBlock).toContain(".option('--json'");
  });

  it('documents eval --json', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('scripting');
    expect(evalSection).toContain('savestate eval report --json');
  });

  it('documents eval report --json when missing', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('scripting');
    expect(evalSection).toContain('found, suiteCount, passed, total, passRate');
    expect(evalSection).toContain('savestate eval report --json');
    expect(evalSource).toContain('export function formatEvalReportMissingJson');
  });

  it('documents eval quality --json when missing', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('scripting');
    expect(evalSection).toContain('found, suite, suiteCount, passed, total, passRate');
    expect(evalSection).toContain('savestate eval quality --suite recall --threshold 0.9 --json');
    expect(evalSource).toContain('export function formatEvalQualityMissingJson');
  });

  it('documents eval quality --json when SaveState is not initialized', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('scripting');
    expect(evalSection).toContain(
      'When SaveState is not initialized, <code>quality</code> emits a missing summary (found, suite, suiteCount, passed, total, passRate',
    );
    expect(evalSection).toContain('savestate eval quality --suite recall --threshold 0.9 --json');
    expect(evalSource).toContain('export function formatEvalQualityMissingJson');
    expect(evalSource).toContain("options.json && subcommand === 'quality'");
  });

  it('documents eval report --json when SaveState is not initialized', () => {
    const evalSection = docs.slice(docs.indexOf('id="eval"'), docs.indexOf('id="login"'));
    expect(evalSection).toContain('--json');
    expect(evalSection).toContain('scripting');
    expect(evalSection).toContain(
      'When SaveState is not initialized, <code>report</code> emits a missing summary (found, suiteCount, passed, total, passRate',
    );
    expect(evalSection).toContain('savestate eval report --json');
    expect(evalSource).toContain('export function formatEvalReportMissingJson');
    expect(evalSource).toContain("options.json && subcommand === 'report'");
  });

  it('lists savestate login and logout in the command overview', () => {
    expect(docs).toContain('id="login"');
    expect(docs).toContain('id="logout"');
    expect(docs).toContain('savestate login');
    expect(docs).toContain('savestate logout');
  });

  it('registers --json on savestate init', () => {
    const initBlock = cli.slice(cli.indexOf("command('init')"), cli.indexOf("command('snapshot')"));
    expect(initBlock).toContain(".option('--json'");
  });

  it('documents init --json', () => {
    const initSection = docs.slice(docs.indexOf('id="init"'), docs.indexOf('id="snapshot"'));
    expect(initSection).toContain('--json');
    expect(initSection).toContain('scripting');
    expect(initSection).toContain('savestate init --json');
  });

  it('registers --json on savestate login', () => {
    const loginBlock = cli.slice(cli.indexOf("command('login')"), cli.indexOf("command('logout')"));
    expect(loginBlock).toContain(".option('--json'");
  });

  it('documents login --json', () => {
    const loginSection = docs.slice(docs.indexOf('id="login"'), docs.indexOf('id="logout"'));
    expect(loginSection).toContain('--json');
    expect(loginSection).toContain('scripting');
    expect(loginSection).toContain('savestate login --key ss_live_... --json');
  });

  it('documents login --json when missing', () => {
    const loginSection = docs.slice(docs.indexOf('id="login"'), docs.indexOf('id="logout"'));
    expect(loginSection).toContain('--json');
    expect(loginSection).toContain('scripting');
    expect(loginSection).toContain('found, authenticated, email, tier');
    expect(loginSection).toContain('savestate login --json');
    expect(login).toContain('export function formatLoginMissingJson');
  });

  it('registers --json on savestate logout', () => {
    const logoutBlock = cli.slice(cli.indexOf("command('logout')"), cli.indexOf("command('schedule')"));
    expect(logoutBlock).toContain(".option('--json'");
  });

  it('documents logout --json', () => {
    const logoutSection = docs.slice(docs.indexOf('id="logout"'), docs.indexOf('id="cloud"'));
    expect(logoutSection).toContain('--json');
    expect(logoutSection).toContain('scripting');
    expect(logoutSection).toContain('savestate logout --json');
  });

  it('documents logout --json when missing', () => {
    const logoutSection = docs.slice(docs.indexOf('id="logout"'), docs.indexOf('id="cloud"'));
    expect(logoutSection).toContain('--json');
    expect(logoutSection).toContain('scripting');
    expect(logoutSection).toContain('found, loggedOut, hadKey');
    expect(logoutSection).toContain('savestate logout --json');
    expect(login).toContain('export function formatLogoutMissingJson');
  });

  it('documents login --key as a single API key', () => {
    const loginSection = docs.slice(docs.indexOf('id="login"'), docs.indexOf('id="logout"'));
    expect(loginSection).toContain('--key');
    expect(loginSection).toContain('Must be a single non-empty API key');
    expect(login).toContain('export function parseLoginKey');
  });

  it('documents login --key, ss_live_ keys, and logout removing the saved key', () => {
    const loginSection = docs.slice(docs.indexOf('id="login"'), docs.indexOf('id="logout"'));
    expect(loginSection).toContain('--key');
    expect(loginSection).toContain('ss_live_');
    expect(loginSection).toContain('savestate.dev/account');
    expect(loginSection).toContain('savestate init');
    const logoutSection = docs.slice(docs.indexOf('id="logout"'), docs.indexOf('id="cloud"'));
    expect(logoutSection).toContain('savestate logout');
    expect(logoutSection).toContain('saved cloud API key');
  });

  it('lists savestate cloud in the command overview', () => {
    expect(docs).toContain('id="cloud"');
    expect(docs).toContain('savestate cloud');
  });

  it('documents cloud push, pull, list, delete, and --force', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('push');
    expect(cloudSection).toContain('pull');
    expect(cloudSection).toContain('list');
    expect(cloudSection).toContain('delete');
    expect(cloudSection).toContain('--id');
    expect(cloudSection).toContain('--all');
    expect(cloudSection).toContain('--force');
    expect(cloudSection).toContain('Pro or Team');
    expect(cloudSection).toContain('savestate login');
    expect(cloudSection).toContain('.saf.enc');
  });

  it('documents cloud --id as a single snapshot id', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--id');
    expect(cloudSection).toContain('Must be a single non-empty snapshot id');
    expect(cloud).toContain('export function parseCloudId');
  });

  it('documents cloud subcommand as a single cloud action', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('&lt;subcommand&gt;');
    expect(cloudSection).toContain('Must be a single non-empty subcommand');
    expect(cloud).toContain('export function parseCloudSubcommand');
    expect(cli).toContain('single non-empty subcommand: push, pull, list, or delete');
  });

  it('registers --json on savestate cloud', () => {
    const cloudBlock = cli.slice(cli.indexOf("command('cloud <subcommand>')"), cli.indexOf("command('team <subcommand> [args...]')"));
    expect(cloudBlock).toContain(".option('--json'");
  });

  it('documents cloud --json', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('savestate cloud list --json');
    expect(cloudSection).toContain('savestate cloud pull --json');
    expect(cloudSection).toContain('savestate cloud delete --id ss-2026-01-26 --json');
  });

  it('documents cloud push --json', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('uploaded count');
    expect(cloudSection).toContain('savestate cloud push --json');
  });

  it('documents cloud push --json when missing', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('found, id, pushed, failed');
    expect(cloudSection).toContain('savestate cloud push --json');
    expect(cloud).toContain('export function formatCloudPushMissingJson');
  });

  it('documents cloud push --json when SaveState is not initialized', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain(
      'When SaveState is not initialized, <code>push</code> emits a missing summary (found, id, pushed, failed',
    );
    expect(cloudSection).toContain('savestate cloud push --json');
    expect(cloud).toContain('export function formatCloudPushMissingJson');
    expect(cloud).toContain("formatCloudPushMissingJson(id ?? '')");
  });

  it('documents cloud list --json when SaveState is not initialized', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain(
      'When SaveState is not initialized, <code>list</code> emits a missing summary (found, total, shown',
    );
    expect(cloudSection).toContain('savestate cloud list --json');
    expect(cloud).toContain('export function formatCloudListMissingJson');
    expect(cloud).toContain('formatCloudListMissingJson()');
  });

  it('documents cloud pull --json when missing', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('found, id, pulled, failed, skipped');
    expect(cloudSection).toContain('savestate cloud pull --json');
    expect(cloud).toContain('export function formatCloudPullMissingJson');
  });

  it('documents cloud pull --json when SaveState is not initialized', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain(
      'When SaveState is not initialized, <code>pull</code> emits a missing summary (found, id, pulled, failed, skipped',
    );
    expect(cloudSection).toContain('savestate cloud pull --json');
    expect(cloud).toContain('export function formatCloudPullMissingJson');
    expect(cloud).toContain("formatCloudPullMissingJson(id ?? '')");
  });

  it('documents cloud delete --json when missing', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('found, id, deleted, failed');
    expect(cloudSection).toContain('savestate cloud delete --id ss-2026-01-26 --json');
    expect(cloud).toContain('export function formatCloudDeleteMissingJson');
  });

  it('documents cloud delete --json when SaveState is not initialized', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain(
      'When SaveState is not initialized, <code>delete</code> emits a missing summary (found, id, deleted, failed',
    );
    expect(cloudSection).toContain('savestate cloud delete --id ss-2026-01-26 --json');
    expect(cloud).toContain('export function formatCloudDeleteMissingJson');
    expect(cloud).toContain("formatCloudDeleteMissingJson(id ?? '')");
  });

  it('lists savestate mcp in the command overview', () => {
    expect(docs).toContain('id="mcp"');
    expect(docs).toContain('savestate mcp');
  });

  it('documents mcp serve, status, export, and import', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('serve');
    expect(mcpSection).toContain('status');
    expect(mcpSection).toContain('export');
    expect(mcpSection).toContain('import');
    expect(mcpSection).toContain('--stdio');
    expect(mcpSection).toContain('--port');
    expect(mcpSection).toContain('--agent');
    expect(mcpSection).toContain('--output');
    expect(mcpSection).toContain('--input');
    expect(mcpSection).toContain('--include-snapshots');
    expect(mcpSection).toContain('--merge');
    expect(mcpSection).toContain('savestate init');
    expect(mcpSection).toContain('/docs/mcp.html');
  });

  it('documents mcp serve --port as a TCP port', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--port');
    expect(mcpSection).toContain('Must be an integer from 1 to 65535');
    expect(mcp).toContain('export function parseMcpPort');
  });

  it('documents mcp --agent as a single agent id', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--agent');
    expect(mcpSection).toContain('Must be a single non-empty agent id');
    expect(mcp).toContain('export function parseMcpAgent');
  });

  it('documents mcp --output as a single path', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--output');
    expect(mcpSection).toContain('Must be a single non-empty path');
    expect(mcp).toContain('export function parseMcpOutput');
  });

  it('documents mcp --input as a single path', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--input');
    expect(mcpSection).toContain('Must be a single non-empty path');
    expect(mcp).toContain('export function parseMcpInput');
  });

  it('registers --json on savestate mcp status', () => {
    const statusBlock = mcp.slice(mcp.indexOf("command('status')"), mcp.indexOf("command('export')"));
    expect(statusBlock).toContain(".option('--json'");
  });

  it('registers --json on savestate mcp import', () => {
    const importBlock = mcp.slice(mcp.indexOf("command('import')"));
    expect(importBlock).toContain(".option('--json'");
  });

  it('registers --json on savestate mcp export', () => {
    const exportBlock = mcp.slice(mcp.indexOf("command('export')"), mcp.indexOf("command('import')"));
    expect(exportBlock).toContain(".option('--json'");
  });

  it('documents mcp --json', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('savestate mcp status --json');
  });

  it('documents mcp status --json when missing', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('found, initialized, enabled');
    expect(mcpSection).toContain('savestate mcp status --json');
    expect(mcp).toContain('export function formatMcpStatusMissingJson');
  });

  it('documents mcp import --json', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('memory/snapshot counts');
    expect(mcpSection).toContain('savestate mcp import --input passport.json --json');
  });

  it('documents mcp import --json when missing', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('found, input, importedMemories, totalMemories, snapshots');
    expect(mcpSection).toContain('savestate mcp import --input passport.json --json');
    expect(mcp).toContain('export function formatMcpImportMissingJson');
  });

  it('documents mcp export --json', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('memory/snapshot counts');
    expect(mcpSection).toContain('savestate mcp export --agent my-agent --json');
  });

  it('documents mcp export --json when missing', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain('found, agent, output, memories, snapshots, written');
    expect(mcpSection).toContain('savestate mcp export --agent my-agent --json');
    expect(mcp).toContain('export function formatMcpExportMissingJson');
  });

  it('documents mcp export --json when SaveState is not initialized', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    const exportBlock = mcp.slice(mcp.indexOf('async function mcpExportCommand'), mcp.indexOf('async function mcpImportCommand'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain(
      'When SaveState is not initialized, <code>export</code> emits a missing summary (found, agent, output, memories, snapshots, written',
    );
    expect(mcpSection).toContain('savestate mcp export --agent my-agent --json');
    expect(mcp).toContain('export function formatMcpExportMissingJson');
    expect(exportBlock).toContain('if (!isInitialized())');
    expect(exportBlock).toContain('if (options.json)');
    expect(exportBlock).toContain("formatMcpExportMissingJson(agentId, output ?? '')");
  });

  it('documents mcp import --json when SaveState is not initialized', () => {
    const mcpSection = docs.slice(docs.indexOf('id="mcp"'), docs.indexOf('id="context"'));
    const importBlock = mcp.slice(mcp.indexOf('async function mcpImportCommand'), mcp.indexOf('export function registerMCPCommands'));
    expect(mcpSection).toContain('--json');
    expect(mcpSection).toContain('scripting');
    expect(mcpSection).toContain(
      'When SaveState is not initialized, <code>import</code> emits a missing summary (found, input, importedMemories, totalMemories, snapshots',
    );
    expect(mcpSection).toContain('savestate mcp import --input passport.json --json');
    expect(mcp).toContain('export function formatMcpImportMissingJson');
    expect(importBlock).toContain('if (!isInitialized())');
    expect(importBlock).toContain('if (options.json)');
    expect(importBlock).toContain("formatMcpImportMissingJson(input ?? '')");
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

  it('documents context compile --budget as a bounded positive integer', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--budget');
    expect(contextSection).toContain('positive integer up to 1000000');
    expect(context).toContain('export function parseContextBudget');
  });

  it('documents context --agent as a single agent id', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--agent');
    expect(contextSection).toContain('Must be a single non-empty agent id');
    expect(context).toContain('export function parseContextAgent');
  });

  it('documents context --task as a non-empty task intent', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--task');
    expect(contextSection).toContain('Must be a non-empty task intent');
    expect(context).toContain('export function parseContextTask');
  });

  it('documents context --file as a single path', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--file');
    expect(contextSection).toContain('Must be a single non-empty path');
    expect(context).toContain('export function parseContextFile');
  });

  it('documents context explain run-id as a single run id', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('&lt;run-id&gt;');
    expect(contextSection).toContain('Must be a single non-empty run id');
    expect(context).toContain('export function parseContextRunId');
    expect(context).toContain('single non-empty run id');
  });

  it('registers --json on savestate context compile', () => {
    const compileBlock = context.slice(context.indexOf("command('compile')"), context.indexOf("command('explain"));
    expect(compileBlock).toContain(".option('--json'");
  });

  it('registers --json on savestate context explain', () => {
    const explainBlock = context.slice(context.indexOf("command('explain"), context.indexOf("command('validate"));
    expect(explainBlock).toContain(".option('--json'");
  });

  it('registers --json on savestate context validate', () => {
    const validateBlock = context.slice(context.indexOf("command('validate')"), context.indexOf("command('config')"));
    expect(validateBlock).toContain(".option('--json'");
  });

  it('documents context --json', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--json');
    expect(contextSection).toContain('scripting');
    expect(contextSection).toContain('score breakdowns');
    expect(contextSection).toContain('savestate context compile --agent my-agent --task "summarize inbox" --json');
    expect(contextSection).toContain('savestate context explain run_abc123 --json');
  });

  it('documents context validate --json', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--json');
    expect(contextSection).toContain('scripting');
    expect(contextSection).toContain('valid flag');
    expect(contextSection).toContain('savestate context validate --file brief.json --json');
  });

  it('documents context validate --json when missing', () => {
    const contextSection = docs.slice(docs.indexOf('id="context"'), docs.indexOf('id="memory"'));
    expect(contextSection).toContain('--json');
    expect(contextSection).toContain('scripting');
    expect(contextSection).toContain('found, file, valid, errors, warnings');
    expect(contextSection).toContain('savestate context validate --file brief.json --json');
    expect(context).toContain('export function formatContextValidateMissingJson');
  });

  it('lists savestate memory in the command overview', () => {
    expect(docs).toContain('id="memory"');
    expect(docs).toContain('savestate memory');
  });

  it('documents memory list, promote, expire, and log', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
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

  it('documents memory list --pinned, --limit, and promote --to', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--pinned');
    expect(memorySection).toContain('--limit');
    expect(memorySection).toContain('--to');
    expect(memorySection).toContain('20');
    expect(memorySection).toContain('pinned memories');
    expect(memorySection).toContain('Target tier');
  });

  it('documents memory --snapshot as a single snapshot id', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--snapshot');
    expect(memorySection).toContain('Must be a single non-empty snapshot id');
    expect(memoryCli).toContain('export function parseMemorySnapshot');
  });

  it('documents memory memory-id as a single memory id', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('&lt;memory-id&gt;');
    expect(memorySection).toContain('Must be a single non-empty memory id');
    expect(memoryCli).toContain('export function parseMemoryId');
  });

  it('documents memory explain query as non-empty', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('&lt;query&gt;');
    expect(memorySection).toContain('Must be a non-empty query');
    expect(memoryCli).toContain('export function parseMemoryQuery');
  });

  it('documents memory --reason as a non-empty reason', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--reason');
    expect(memorySection).toContain('Must be a non-empty reason');
    expect(memoryCli).toContain('export function parseMemoryReason');
  });

  it('documents memory --content as non-empty memory content', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--content');
    expect(memorySection).toContain('Must be non-empty memory content');
    expect(memoryCli).toContain('export function parseMemoryContent');
  });

  it('documents memory promote --to as L1 or L2', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--to');
    expect(memorySection).toContain('Promote must be one of: L1, L2');
    expect(memoryCli).toContain('export function parseMemoryPromoteTo');
  });

  it('documents memory edit --content, --importance, --actor, and rollback --version', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--content');
    expect(memorySection).toContain('--importance');
    expect(memorySection).toContain('--actor');
    expect(memorySection).toContain('--version');
    expect(memorySection).toContain('0-1');
    expect(memorySection).toContain('cli-user');
    expect(memorySection).toContain('rollback');
  });

  it('documents memory rollback --version as a bounded positive integer', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--version');
    expect(memorySection).toContain('positive integer up to 1000');
    expect(memoryCli).toContain('export function parseMemoryVersion');
  });

  it('documents memory edit --importance as a number between 0 and 1', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--importance');
    expect(memorySection).toContain('number between 0 and 1');
    expect(memoryCli).toContain('export function parseMemoryImportance');
  });

  it('documents memory --tags as one or more non-empty memory tags', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--tags');
    expect(memorySection).toContain('Must be one or more non-empty memory tags (comma-separated)');
    expect(memoryCli).toContain('export function parseMemoryTags');
  });

  it('documents memory --actor as a single actor id', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--actor');
    expect(memorySection).toContain('Must be a single non-empty actor id');
    expect(memoryCli).toContain('export function parseMemoryActor');
  });

  it('documents memory --namespace as a single namespace', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--namespace');
    expect(memorySection).toContain('Must be a single non-empty namespace');
    expect(memoryCli).toContain('export function parseMemoryNamespace');
  });

  it('documents memory log --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('Omits previous content');
    expect(memorySection).toContain('savestate memory log mem-123 --json');
  });

  it('documents memory log --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, events');
    expect(memorySection).toContain('savestate memory log mem-123 --json');
    expect(memoryLifecycle).toContain('export function formatMemoryLogMissingJson');
  });

  it('registers --json on savestate memory list', () => {
    const listBlock = memoryCli.slice(memoryCli.indexOf("command('list')"), memoryCli.indexOf("command('promote"));
    expect(listBlock).toContain(".option('--json'");
  });

  it('documents memory --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('savestate memory list --json');
  });

  it('documents memory list --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, snapshot, total, shown');
    expect(memorySection).toContain('savestate memory list --snapshot ss-missing --json');
    expect(memory).toContain('export function formatMemoryListMissingJson');
  });

  it('registers --json on savestate memory config', () => {
    const configBlock = memoryCli.slice(memoryCli.indexOf("command('config')"), memoryCli.indexOf("command('explain"));
    expect(configBlock).toContain(".option('--json'");
  });

  it('documents memory config --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('tier limits and policy names');
    expect(memorySection).toContain('savestate memory config --json');
  });

  it('documents memory config --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, snapshot, version, defaultTier');
    expect(memorySection).toContain('savestate memory config --snapshot ss-missing --json');
    expect(memory).toContain('export function formatMemoryConfigMissingJson');
  });

  it('registers --json on savestate memory promote', () => {
    const promoteBlock = memoryCli.slice(memoryCli.indexOf("command('promote"), memoryCli.indexOf("command('demote"));
    expect(promoteBlock).toContain(".option('--json'");
  });

  it('documents memory promote --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('from/to tiers');
    expect(memorySection).toContain('savestate memory promote mem-123 --to L1 --json');
  });

  it('documents memory promote --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, from, to');
    expect(memorySection).toContain('savestate memory promote mem-123 --to L1 --json');
    expect(memory).toContain('export function formatMemoryPromoteMissingJson');
  });

  it('documents memory demote --to as L2 or L3', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--to');
    expect(memorySection).toContain('Must be one of: L2, L3');
    expect(memoryCli).toContain('export function parseMemoryDemoteTo');
  });

  it('registers --json on savestate memory demote', () => {
    const demoteBlock = memoryCli.slice(memoryCli.indexOf("command('demote"), memoryCli.indexOf("command('pin"));
    expect(demoteBlock).toContain(".option('--json'");
  });

  it('documents memory demote --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('from/to tiers');
    expect(memorySection).toContain('savestate memory demote mem-123 --to L3 --json');
  });

  it('documents memory demote --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, from, to');
    expect(memorySection).toContain('savestate memory demote mem-123 --to L3 --json');
    expect(memory).toContain('export function formatMemoryDemoteMissingJson');
  });

  it('registers --json on savestate memory pin', () => {
    const pinBlock = memoryCli.slice(memoryCli.indexOf("command('pin"), memoryCli.indexOf("command('unpin"));
    expect(pinBlock).toContain(".option('--json'");
  });

  it('documents memory pin --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('pinned status');
    expect(memorySection).toContain('savestate memory pin mem-123 --json');
  });

  it('documents memory pin --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, pinned');
    expect(memorySection).toContain('savestate memory pin mem-123 --json');
    expect(memory).toContain('export function formatMemoryPinMissingJson');
  });

  it('registers --json on savestate memory unpin', () => {
    const unpinBlock = memoryCli.slice(memoryCli.indexOf("command('unpin"), memoryCli.indexOf("command('apply-policies"));
    expect(unpinBlock).toContain(".option('--json'");
  });

  it('documents memory unpin --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('pinned status');
    expect(memorySection).toContain('savestate memory unpin mem-123 --json');
  });

  it('documents memory unpin --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, pinned');
    expect(memorySection).toContain('savestate memory unpin mem-123 --json');
    expect(memory).toContain('export function formatMemoryUnpinMissingJson');
  });

  it('registers --json on savestate memory apply-policies', () => {
    const applyBlock = memoryCli.slice(memoryCli.indexOf("command('apply-policies')"), memoryCli.indexOf("command('config')"));
    expect(applyBlock).toContain(".option('--json'");
  });

  it('documents memory apply-policies --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('from/to tiers');
    expect(memorySection).toContain('savestate memory apply-policies --json');
  });

  it('documents memory apply-policies --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, snapshot, applied, changeCount');
    expect(memorySection).toContain('savestate memory apply-policies --snapshot ss-missing --json');
    expect(memory).toContain('export function formatMemoryApplyPoliciesMissingJson');
  });

  it('registers --json on savestate memory edit', () => {
    const editBlock = memoryCli.slice(memoryCli.indexOf("command('edit"), memoryCli.indexOf("command('delete"));
    expect(editBlock).toContain(".option('--json'");
  });

  it('documents memory edit --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('edited version');
    expect(memorySection).toContain('savestate memory edit mem-123 --content "Updated preference" --importance 0.9 --reason "correction" --json');
  });

  it('documents memory edit --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, version');
    expect(memorySection).toContain('savestate memory edit mem-123 --content "Updated preference" --importance 0.9 --reason "correction" --json');
    expect(memoryLifecycle).toContain('export function formatMemoryEditMissingJson');
  });

  it('registers --json on savestate memory delete', () => {
    const deleteBlock = memoryCli.slice(memoryCli.indexOf("command('delete"), memoryCli.indexOf("command('rollback"));
    expect(deleteBlock).toContain(".option('--json'");
  });

  it('documents memory delete --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('deleted status');
    expect(memorySection).toContain('savestate memory delete mem-123 --reason "stale" --json');
  });

  it('documents memory delete --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, deleted');
    expect(memorySection).toContain('savestate memory delete mem-123 --reason "stale" --json');
    expect(memoryLifecycle).toContain('export function formatMemoryDeleteMissingJson');
  });

  it('registers --json on savestate memory rollback', () => {
    const rollbackBlock = memoryCli.slice(memoryCli.indexOf("command('rollback"), memoryCli.indexOf("command('expire"));
    expect(rollbackBlock).toContain(".option('--json'");
  });

  it('documents memory rollback --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('rolled-back status');
    expect(memorySection).toContain('savestate memory rollback mem-123 --version 2 --json');
  });

  it('documents memory rollback --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, id, rolledBack');
    expect(memorySection).toContain('savestate memory rollback mem-123 --version 2 --json');
    expect(memoryLifecycle).toContain('export function formatMemoryRollbackMissingJson');
  });

  it('registers --json on savestate memory expire', () => {
    const expireBlock = memoryCli.slice(memoryCli.indexOf("command('expire')"), memoryCli.indexOf("command('log"));
    expect(expireBlock).toContain(".option('--json'");
  });

  it('documents memory expire --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('expired count');
    expect(memorySection).toContain('savestate memory expire --namespace org:app:agent --json');
  });

  it('documents memory expire --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, namespace, applied, expiredCount');
    expect(memorySection).toContain('savestate memory expire --namespace org:missing --json');
    expect(memoryLifecycle).toContain('export function formatMemoryExpireMissingJson');
  });

  it('registers --json on savestate memory explain', () => {
    const explainBlock = memoryCli.slice(memoryCli.indexOf("command('explain"), memoryCli.indexOf("command('edit"));
    expect(explainBlock).toContain(".option('--json'");
  });

  it('documents memory explain --json', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('retrieval scores');
    expect(memorySection).toContain('savestate memory explain "inbox preference" --json');
  });

  it('documents memory explain --json when missing', () => {
    const memorySection = docs.slice(docs.indexOf('id="memory"'), docs.indexOf('id="slo"'));
    expect(memorySection).toContain('--json');
    expect(memorySection).toContain('scripting');
    expect(memorySection).toContain('found, query, shown');
    expect(memorySection).toContain('savestate memory explain "inbox preference" --json');
    expect(memory).toContain('export function formatMemoryExplainMissingJson');
  });

  it('lists savestate slo in the command overview', () => {
    expect(docs).toContain('id="slo"');
    expect(docs).toContain('savestate slo');
  });

  it('documents slo status, report, and config', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('status');
    expect(sloSection).toContain('report');
    expect(sloSection).toContain('config');
    expect(sloSection).toContain('--namespace');
    expect(sloSection).toContain('--period');
    expect(sloSection).toContain('--set');
    expect(sloSection).toContain('--json');
    expect(sloSection).toContain('enabled=true');
    expect(sloSection).toContain('freshness.max_age_hours');
  });

  it('documents slo subcommand as a single slo action', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('&lt;subcommand&gt;');
    expect(sloSection).toContain('Must be a single non-empty subcommand');
    expect(slo).toContain('export function parseSloSubcommand');
    expect(slo).toContain('single non-empty subcommand: status, report, or config');
  });

  it('documents slo report --period as a bounded duration', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--period');
    expect(sloSection).toContain('duration like 24h, 7d, or 1w up to 365 days');
    expect(slo).toContain('export function parseSloPeriod');
  });

  it('documents slo --namespace as a single namespace', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--namespace');
    expect(sloSection).toContain('Must be a single non-empty namespace');
    expect(slo).toContain('export function parseSloNamespace');
  });

  it('documents slo --set as a non-empty key=value pair', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--set');
    expect(sloSection).toContain('Must be a non-empty key=value pair');
    expect(slo).toContain('export function parseSloSet');
  });

  it('registers --json on savestate slo', () => {
    const sloBlock = slo.slice(slo.indexOf("command('slo"));
    expect(sloBlock).toContain(".option('--json'");
  });

  it('documents slo --json', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--json');
    expect(sloSection).toContain('scripting');
    expect(sloSection).toContain('savestate slo status --json');
  });

  it('documents slo report --json when missing', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--json');
    expect(sloSection).toContain('scripting');
    expect(sloSection).toContain('found, enabled, reportId, totalQueries, namespaces');
    expect(sloSection).toContain('savestate slo report --json');
    expect(slo).toContain('export function formatSloReportMissingJson');
  });

  it('documents slo status --json when missing', () => {
    const sloSection = docs.slice(docs.indexOf('id="slo"'), docs.indexOf('id="acl"'));
    expect(sloSection).toContain('--json');
    expect(sloSection).toContain('scripting');
    expect(sloSection).toContain('found, enabled, namespace, compliant, violations');
    expect(sloSection).toContain('savestate slo status --namespace org:missing --json');
    expect(slo).toContain('export function formatSloStatusMissingJson');
  });

  it('lists savestate acl in the command overview', () => {
    expect(docs).toContain('id="acl"');
    expect(docs).toContain('savestate acl');
  });

  it('documents acl propose, verify, gate, and list', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('propose');
    expect(aclSection).toContain('verify');
    expect(aclSection).toContain('gate');
    expect(aclSection).toContain('list');
    expect(aclSection).toContain('--type');
    expect(aclSection).toContain('--criticality');
    expect(aclSection).toContain('--description');
    expect(aclSection).toContain('--proposer');
    expect(aclSection).toContain('--expires-in');
    expect(aclSection).toContain('--id');
    expect(aclSection).toContain('--verifier');
    expect(aclSection).toContain('--approve');
    expect(aclSection).toContain('--action');
    expect(aclSection).toContain('customer_promise');
    expect(aclSection).toContain('Active Commitment Layer');
  });

  it('registers --json on savestate acl list', () => {
    const listBlock = acl.slice(acl.indexOf("command('list')"));
    expect(listBlock).toContain(".option('--json'");
  });

  it('documents acl --json', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--json');
    expect(aclSection).toContain('scripting');
    expect(aclSection).toContain('savestate acl list --json');
  });

  it('documents acl verify --json when missing', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--json');
    expect(aclSection).toContain('scripting');
    expect(aclSection).toContain('found, id, state, verifier');
    expect(aclSection).toContain('savestate acl verify --id cmt-missing --verifier reviewer-1 --json');
    expect(acl).toContain('export function formatAclVerifyMissingJson');
  });

  it('documents acl --id as a single commitment id', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--id');
    expect(aclSection).toContain('Must be a single non-empty commitment id');
    expect(acl).toContain('export function parseAclId');
  });

  it('documents acl --verifier as a single verifier id', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--verifier');
    expect(aclSection).toContain('Must be a single non-empty verifier id');
    expect(acl).toContain('export function parseAclVerifier');
  });

  it('documents acl --proposer as a single proposer id', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--proposer');
    expect(aclSection).toContain('Must be a single non-empty proposer id');
    expect(acl).toContain('export function parseAclProposer');
  });

  it('documents acl --description as a non-empty commitment description', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--description');
    expect(aclSection).toContain('Must be a non-empty commitment description');
    expect(acl).toContain('export function parseAclDescription');
  });

  it('documents acl propose --expires-in as a bounded positive integer', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--expires-in');
    expect(aclSection).toContain('positive integer up to 10080');
    expect(acl).toContain('export function parseAclExpiresIn');
  });

  it('documents acl propose --criticality as known criticality levels', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--criticality');
    expect(aclSection).toContain('Must be one of: c1, c2, c3');
    expect(acl).toContain('export function parseAclCriticality');
  });

  it('documents acl propose --type as known commitment types', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--type');
    expect(aclSection).toContain('Must be one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write');
    expect(acl).toContain('export function parseAclType');
  });

  it('documents acl gate --action as known commitment types', () => {
    const aclSection = docs.slice(docs.indexOf('id="acl"'), docs.indexOf('id="identity"'));
    expect(aclSection).toContain('--action');
    expect(aclSection).toContain('Must be one of: customer_promise, ticket_status_change, escalation_closure, account_tool_write');
    expect(acl).toContain('export function parseAclAction');
  });

  it('registers savestate identity on the CLI', () => {
    expect(cli).toContain("command('identity <subcommand> [args...]')");
    expect(cli).toContain('identityCommand');
  });

  it('lists savestate identity in the command overview', () => {
    expect(docs).toContain('id="identity"');
    expect(docs).toContain('savestate identity');
  });

  it('documents identity show, init, set, and schema', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('show');
    expect(identitySection).toContain('init');
    expect(identitySection).toContain('set');
    expect(identitySection).toContain('schema');
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('.savestate/identity.json');
    expect(identitySection).toContain('metadata.');
    expect(identitySection).toContain('savestate init');
  });

  it('registers --json on savestate identity', () => {
    const identityBlock = cli.slice(
      cli.indexOf("command('identity <subcommand> [args...]')"),
      cli.indexOf('program.parse()'),
    );
    expect(identityBlock).toContain(".option('--json'");
  });

  it('documents identity --json', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('savestate identity show --json');
  });

  it('documents identity set --json', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('updated, field, name, version');
    expect(identitySection).toContain('omits tool config');
    expect(identitySection).toContain('savestate identity set tone professional --json');
    expect(identity).toContain('export function formatIdentitySetJson');
  });

  it('documents identity schema --json', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('omits descriptions and nested tool config');
    expect(identitySection).toContain('savestate identity schema --json');
    expect(identity).toContain('export function formatIdentitySchemaJson');
  });

  it('documents identity schema --json when missing', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('found, id, title, type');
    expect(identitySection).toContain('savestate identity schema --json');
    expect(identity).toContain('export function formatIdentitySchemaMissingJson');
  });

  it('documents identity show --json when missing', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('found, name, version, schemaVersion');
    expect(identitySection).toContain('savestate identity show --json');
    expect(identity).toContain('export function formatIdentityShowMissingJson');
  });

  it('documents identity show --json when SaveState is not initialized', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain(
      'When SaveState is not initialized, <code>show</code> emits a missing summary (found, name, version, schemaVersion',
    );
    expect(identitySection).toContain('savestate identity show --json');
    expect(identity).toContain('export function formatIdentityShowMissingJson');
    expect(identity).toContain("options?.json && subcommand === 'show'");
  });

  it('documents identity set --json when missing', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('found, updated, field, name, version');
    expect(identitySection).toContain('savestate identity set tone professional --json');
    expect(identity).toContain('export function formatIdentitySetMissingJson');
  });

  it('documents identity set --json when SaveState is not initialized', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain(
      'When SaveState is not initialized, <code>set</code> emits a missing summary (found, updated, field, name, version',
    );
    expect(identitySection).toContain('savestate identity set tone professional --json');
    expect(identity).toContain('export function formatIdentitySetMissingJson');
    expect(identity).toContain("options?.json && subcommand === 'set'");
  });

  it('documents identity subcommand as a single identity action', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('&lt;subcommand&gt;');
    expect(identitySection).toContain('Must be a single non-empty subcommand');
    expect(identity).toContain('export function parseIdentitySubcommand');
    expect(cli).toContain('single non-empty subcommand: show, init, set, or schema');
  });

  it('documents identity init name as a single identity name', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('&lt;name&gt;');
    expect(identitySection).toContain('Must be a single non-empty identity name');
    expect(identity).toContain('export function parseIdentityName');
    expect(cli).toContain('init requires a single non-empty identity name');
  });

  it('documents identity set field as a single identity field', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('&lt;field&gt;');
    expect(identitySection).toContain('Must be a single non-empty identity field');
    expect(identity).toContain('export function parseIdentityField');
    expect(cli).toContain('set requires a single non-empty identity field');
  });

  it('documents identity set value as a non-empty identity value', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('&lt;value&gt;');
    expect(identitySection).toContain('Must be a non-empty identity value');
    expect(identity).toContain('export function parseIdentityValue');
    expect(cli).toContain('a non-empty identity value');
  });

  it('documents identity init --json', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('created, alreadyExists, path, name, version');
    expect(identitySection).toContain('omits tool config');
    expect(identitySection).toContain('savestate identity init MyAgent --json');
    expect(identity).toContain('export function formatIdentityInitJson');
  });

  it('documents identity init --json when missing', () => {
    const identitySection = docs.slice(docs.indexOf('id="identity"'), docs.indexOf('id="integrity"'));
    expect(identitySection).toContain('--json');
    expect(identitySection).toContain('scripting');
    expect(identitySection).toContain('found, created, alreadyExists, path, name, version');
    expect(identitySection).toContain('savestate identity init MyAgent --json');
    expect(identity).toContain('export function formatIdentityInitMissingJson');
  });

  it('registers savestate integrity on the CLI', () => {
    expect(cli).toContain('registerIntegrityCommands');
  });

  it('lists savestate integrity in the command overview', () => {
    expect(docs).toContain('id="integrity"');
    expect(docs).toContain('savestate integrity');
  });

  it('documents integrity status, seed, incidents, and quarantine', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('status');
    expect(integritySection).toContain('seed');
    expect(integritySection).toContain('incidents');
    expect(integritySection).toContain('quarantine');
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('--tenant');
    expect(integritySection).toContain('--count');
    expect(integritySection).toContain('--force');
    expect(integritySection).toContain('honeyfact');
    expect(integritySection).toContain('savestate init');
  });

  it('documents integrity subcommand as a single integrity action', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('&lt;subcommand&gt;');
    expect(integritySection).toContain('Must be a single non-empty subcommand');
    expect(integrity).toContain('export function parseIntegritySubcommand');
    expect(integrity).toContain('single non-empty subcommand: status, seed, rotate, incidents, incident, quarantine, release, config, test, or clear');
  });

  it('documents integrity incident id as a single incident id', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('&lt;id&gt;');
    expect(integritySection).toContain('Must be a single non-empty incident id');
    expect(integrity).toContain('export function parseIntegrityIncidentId');
    expect(integrity).toContain('single non-empty incident id');
  });

  it('documents integrity quarantine id as a single memory or agent id', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('&lt;memory_id|agent_id&gt;');
    expect(integritySection).toContain('Must be a single non-empty memory or agent id');
    expect(integrity).toContain('export function parseIntegrityTargetId');
    expect(integrity).toContain('quarantine and release require a single non-empty memory or agent id');
  });

  it('documents integrity test input as non-empty text', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('&lt;text&gt;');
    expect(integritySection).toContain('Must be a non-empty text to check');
    expect(integrity).toContain('export function parseIntegrityTestInput');
    expect(integrity).toContain('test requires a non-empty text to check');
  });

  it('documents integrity --user on quarantine and release', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--user');
    expect(integritySection).toContain('quarantine');
    expect(integritySection).toContain('release');
    expect(integritySection).toContain('cli');
    expect(integritySection).toContain('--user reviewer-1');
  });

  it('documents integrity --user as a single user id', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--user');
    expect(integritySection).toContain('Must be a single non-empty user id');
    expect(integrity).toContain('export function parseIntegrityUser');
  });

  it('documents integrity --reason as a non-empty reason', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--reason');
    expect(integritySection).toContain('Must be a non-empty reason');
    expect(integrity).toContain('export function parseIntegrityReason');
  });

  it('registers --json on savestate integrity', () => {
    const integrityBlock = integrity.slice(integrity.indexOf("command('integrity <subcommand> [args...]')"));
    expect(integrityBlock).toContain(".option('--json'");
  });

  it('documents integrity --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity incidents --json');
  });

  it('documents integrity status --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('enabled, policy, honeyfact counts, incident counts, and containment counts');
    expect(integritySection).toContain('savestate integrity status --json');
    expect(integrity).toContain('export function formatIntegrityStatusJson');
  });

  it('documents integrity status --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, enabled, policy, honeyfacts, incidents');
    expect(integritySection).toContain('savestate integrity status --json');
    expect(integrity).toContain('export function formatIntegrityStatusMissingJson');
  });

  it('documents integrity rotate --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity rotate --json');
    expect(integrity).toContain('export function formatIntegrityRotateJson');
  });

  it('documents integrity rotate --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, rotated, valid, createdCount, retiredCount');
    expect(integritySection).toContain('savestate integrity rotate --json');
    expect(integrity).toContain('export function formatIntegrityRotateMissingJson');
  });

  it('documents integrity seed --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity seed --count 10 --json');
    expect(integrity).toContain('export function formatIntegritySeedJson');
  });

  it('documents integrity seed --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, count');
    expect(integritySection).toContain('savestate integrity seed --count 10 --json');
    expect(integrity).toContain('export function formatIntegritySeedMissingJson');
  });

  it('documents integrity --count as a bounded positive integer', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--count');
    expect(integritySection).toContain('positive integer up to 1000');
    expect(integrity).toContain('export function parseIntegrityCount');
  });

  it('documents integrity --tenant as a single tenant id', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--tenant');
    expect(integritySection).toContain('Must be a single non-empty tenant id');
    expect(integrity).toContain('export function parseIntegrityTenant');
  });

  it('documents integrity config honeyfact.ttl_days as a bounded positive integer', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('honeyfact.ttl_days');
    expect(integritySection).toContain('positive integer up to 365');
    expect(integrity).toContain('export function parseIntegrityTtlDays');
  });

  it('documents integrity config honeyfact.count as a bounded positive integer', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('honeyfact.count');
    expect(integritySection).toContain('positive integer up to 1000');
    expect(integrity).toContain('export function parseIntegrityHoneyfactCount');
  });

  it('documents integrity config tripwire.threshold as a bounded 0-1 number', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('tripwire.threshold');
    expect(integritySection).toContain('number between 0 and 1');
    expect(integrity).toContain('export function parseIntegrityTripwireThreshold');
  });

  it('documents integrity incidents --status as a known incident status', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--status');
    expect(integritySection).toContain('open, investigating, contained, resolved, false_positive');
    expect(integrity).toContain('export function parseIntegrityIncidentStatus');
  });

  it('documents integrity config enabled as a true/false boolean', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('enabled');
    expect(integritySection).toContain('Must be true or false');
    expect(integrity).toContain('export function parseIntegrityEnabled');
  });

  it('documents integrity config tripwire.fuzzy_enabled as a true/false boolean', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('tripwire.fuzzy_enabled');
    expect(integritySection).toContain('Must be true or false');
    expect(integrity).toContain('export function parseIntegrityFuzzyEnabled');
  });

  it('documents integrity config containment.auto_escalate as a true/false boolean', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('containment.auto_escalate');
    expect(integritySection).toContain('Must be true or false');
    expect(integrity).toContain('export function parseIntegrityAutoEscalate');
  });

  it('documents integrity quarantine --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity quarantine mem-123 --json');
    expect(integrity).toContain('export function formatIntegrityQuarantineJson');
  });

  it('documents integrity quarantine --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, success, eventId');
    expect(integritySection).toContain('savestate integrity quarantine mem-123 --json');
    expect(integrity).toContain('export function formatIntegrityQuarantineMissingJson');
  });

  it('documents integrity release --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity release mem-123 --json');
    expect(integrity).toContain('export function formatIntegrityReleaseJson');
  });

  it('documents integrity release --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, targetId, success, eventId');
    expect(integritySection).toContain('savestate integrity release mem-123 --json');
    expect(integrity).toContain('export function formatIntegrityReleaseMissingJson');
  });

  it('documents integrity release --json when SaveState is not initialized', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain(
      'When SaveState is not initialized, <code>release</code> emits a missing summary (found, targetId, success, eventId',
    );
    expect(integritySection).toContain('savestate integrity release mem-123 --json');
    expect(integrity).toContain('export function formatIntegrityReleaseMissingJson');
    expect(integrity).toContain("options.json && subcommand === 'release'");
  });

  it('documents integrity clear --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('savestate integrity clear --force --json');
    expect(integrity).toContain('export function formatIntegrityClearJson');
  });

  it('documents integrity clear --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, cleared');
    expect(integritySection).toContain('savestate integrity clear --force --json');
    expect(integrity).toContain('export function formatIntegrityClearMissingJson');
  });

  it('documents integrity config --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('honeyfact count/TTL');
    expect(integritySection).toContain('savestate integrity config --json');
    expect(integrity).toContain('export function formatIntegrityConfigJson');
  });

  it('documents integrity config --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, enabled');
    expect(integritySection).toContain('savestate integrity config --json');
    expect(integrity).toContain('export function formatIntegrityConfigMissingJson');
  });

  it('documents integrity test --json', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('omits matched content');
    expect(integritySection).toContain('savestate integrity test "canary text" --json');
    expect(integrity).toContain('export function formatIntegrityTestJson');
  });

  it('documents integrity test --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, triggered, eventCount, incidentId');
    expect(integritySection).toContain('savestate integrity test "canary text" --json');
    expect(integrity).toContain('export function formatIntegrityTestMissingJson');
  });

  it('documents integrity incidents --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, total, shown');
    expect(integritySection).toContain('savestate integrity incidents --json');
    expect(integrity).toContain('export function formatIntegrityIncidentsMissingJson');
  });

  it('documents integrity incident --json when missing', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain('found, id, status, eventCount');
    expect(integritySection).toContain('savestate integrity incident inc-123 --json');
    expect(integrity).toContain('export function formatIntegrityIncidentMissingJson');
  });

  it('documents integrity incident --json when SaveState is not initialized', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--json');
    expect(integritySection).toContain('scripting');
    expect(integritySection).toContain(
      'When SaveState is not initialized, <code>incident</code> emits a missing summary (found, id, status, eventCount',
    );
    expect(integritySection).toContain('savestate integrity incident inc-123 --json');
    expect(integrity).toContain('export function formatIntegrityIncidentMissingJson');
    expect(integrity).toContain("options.json && subcommand === 'incident'");
  });

  it('lists savestate trace in the command overview', () => {
    expect(docs).toContain('id="trace"');
    expect(docs).toContain('savestate trace');
  });

  it('documents trace list, show, and export', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('list');
    expect(traceSection).toContain('show');
    expect(traceSection).toContain('export');
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('--format');
    expect(traceSection).toContain('--run');
    expect(traceSection).toContain('jsonl');
    expect(traceSection).toContain('.savestate/traces');
    expect(traceSection).toContain('savestate init');
    expect(traceSection).toContain('Askable Echoes');
  });

  it('documents trace export --format as known export formats', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--format');
    expect(traceSection).toContain('Must be one of: jsonl');
    expect(trace).toContain('export function parseTraceExportFormat');
  });

  it('documents trace export --run as a single run id', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--run');
    expect(traceSection).toContain('Must be a single non-empty run id');
    expect(trace).toContain('export function parseTraceRun');
  });

  it('documents trace show run_id as a single run id', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('&lt;run_id&gt;');
    expect(traceSection).toContain('Must be a single non-empty run id');
    expect(trace).toContain('export function parseTraceShowRunId');
    expect(trace).toContain('single non-empty run id');
  });

  it('registers --json on savestate trace list', () => {
    const listBlock = trace.slice(trace.indexOf("command('list')"), trace.indexOf("command('show"));
    expect(listBlock).toContain(".option('--json'");
  });

  it('documents trace --json', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain('savestate trace list --json');
  });

  it('registers --json on savestate trace export', () => {
    const exportBlock = trace.slice(trace.indexOf("command('export')"));
    expect(exportBlock).toContain(".option('--json'");
  });

  it('documents trace export --json', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain('omits event payloads and on-disk file paths');
    expect(traceSection).toContain('savestate trace export --json');
    expect(trace).toContain('export function formatTraceExportJson');
  });

  it('documents trace export --json when missing', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain('found, format, run, runCount, eventCount');
    expect(traceSection).toContain('savestate trace export --run run-123 --json');
    expect(trace).toContain('export function formatTraceExportMissingJson');
  });

  it('documents trace export --json when SaveState is not initialized', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    const exportBlock = trace.slice(
      trace.indexOf('export async function traceExportCommand'),
    );
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain(
      'When SaveState is not initialized, <code>export</code> emits a missing summary (found, format, run, runCount, eventCount',
    );
    expect(traceSection).toContain('savestate trace export --json');
    expect(trace).toContain('export function formatTraceExportMissingJson');
    expect(exportBlock).toContain('if (!isInitialized())');
    expect(exportBlock).toContain('if (options.json)');
    expect(exportBlock).toContain('formatTraceExportMissingJson(run, format)');
  });

  it('documents trace list --json when SaveState is not initialized', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    const listBlock = trace.slice(
      trace.indexOf('export async function traceListCommand'),
      trace.indexOf('export async function traceShowCommand'),
    );
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain(
      'When SaveState is not initialized, <code>list</code> emits a missing summary (found, total, shown',
    );
    expect(traceSection).toContain('savestate trace list --json');
    expect(trace).toContain('export function formatTraceListMissingJson');
    expect(listBlock).toContain('if (!isInitialized())');
    expect(listBlock).toContain('if (options.json)');
    expect(listBlock).toContain('formatTraceListMissingJson()');
  });

  it('documents trace show --json when missing', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain('found, runId, adapter, eventCount');
    expect(traceSection).toContain('savestate trace show run-123 --json');
    expect(trace).toContain('export function formatTraceShowMissingJson');
  });

  it('documents trace show --json when SaveState is not initialized', () => {
    const traceSection = docs.slice(docs.indexOf('id="trace"'), docs.indexOf('id="container"'));
    const showBlock = trace.slice(
      trace.indexOf('export async function traceShowCommand'),
      trace.indexOf('export async function traceExportCommand'),
    );
    expect(traceSection).toContain('--json');
    expect(traceSection).toContain('scripting');
    expect(traceSection).toContain(
      'When SaveState is not initialized, <code>show</code> emits a missing summary (found, runId, adapter, eventCount',
    );
    expect(traceSection).toContain('savestate trace show run-123 --json');
    expect(trace).toContain('export function formatTraceShowMissingJson');
    expect(showBlock).toContain('if (!isInitialized())');
    expect(showBlock).toContain('if (options.json)');
    expect(showBlock).toContain('formatTraceShowMissingJson(runId)');
  });

  it('registers savestate container on the CLI', () => {
    expect(cli).toContain('registerContainerCommands');
  });

  it('lists savestate container in the command overview', () => {
    expect(docs).toContain('id="container"');
    expect(docs).toContain('savestate container');
  });

  it('documents container export and import', () => {
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(containerSection).toContain('export');
    expect(containerSection).toContain('import');
    expect(containerSection).toContain('--out');
    expect(containerSection).toContain('--in');
    expect(containerSection).toContain('--agent');
    expect(containerSection).toContain('--dry-run');
    expect(containerSection).toContain('--force');
    expect(containerSection).toContain('--include');
    expect(containerSection).toContain('--exclude');
    expect(containerSection).toContain('--target');
    expect(containerSection).toContain('--merge');
    expect(containerSection).toContain('--replace');
    expect(containerSection).toContain('--description');
    expect(containerSection).toContain('conversation_history');
    expect(containerSection).toContain('savestate export');
    expect(containerSection).toContain('savestate import');
  });

  it('registers --json on savestate container', () => {
    const containerBlock = container.slice(container.indexOf(".command('container')"));
    expect(containerBlock).toContain(".option('--json'");
  });

  it('documents container --json', () => {
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(containerSection).toContain('--json');
    expect(containerSection).toContain('scripting');
    expect(containerSection).toContain('savestate container export -a my-agent -o agent.savestate --json --dry-run');
  });

  it('documents container --agent as a single agent id', () => {
    const containerSection = docs.slice(docs.indexOf('id="container"'));
    expect(containerSection).toContain('--agent');
    expect(containerSection).toContain('Must be a single non-empty agent id');
    expect(container).toContain('export function parseContainerAgent');
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

  it('registers --json on savestate stats', () => {
    const statsBlock = cli.slice(cli.indexOf("command('stats')"), cli.indexOf("command('doctor')"));
    expect(statsBlock).toContain(".option('--json'");
  });

  it('documents stats --json', () => {
    const statsSection = docs.slice(docs.indexOf('id="stats"'), docs.indexOf('id="doctor"'));
    expect(statsSection).toContain('--json');
    expect(statsSection).toContain('scripting');
    expect(statsSection).toContain('savestate stats --json');
  });

  it('documents stats --json when missing', () => {
    const statsSection = docs.slice(docs.indexOf('id="stats"'), docs.indexOf('id="doctor"'));
    expect(statsSection).toContain('--json');
    expect(statsSection).toContain('scripting');
    expect(statsSection).toContain('found, total, totalBytes, first, latest, storage');
    expect(statsSection).toContain('savestate stats --json');
    expect(stats).toContain('export function formatStatsMissingJson');
  });

  it('lists savestate doctor in the command overview', () => {
    expect(docs).toContain('id="doctor"');
    expect(docs).toContain('savestate doctor');
  });

  it('documents doctor --json, --adapter, and --limit', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--json');
    expect(doctorSection).toContain('--adapter');
    expect(doctorSection).toContain('--limit');
    expect(doctorSection).toContain('checksums');
    expect(doctorSection).toContain('incremental chains');
  });

  it('documents doctor --limit as a bounded positive integer', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--limit');
    expect(doctorSection).toContain('positive integer up to 1000');
    expect(doctor).toContain('export function parseDoctorLimit');
  });

  it('documents doctor --adapter as a known adapter', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--adapter');
    expect(doctorSection).toContain(
      'Must be one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf',
    );
    expect(doctor).toContain('export function parseDoctorAdapter');
  });

  it('registers --json on savestate doctor', () => {
    const doctorBlock = cli.slice(cli.indexOf("command('doctor')"), cli.indexOf("command('inspect <snapshot-id>')"));
    expect(doctorBlock).toContain(".option('--json'");
  });

  it('documents doctor --json', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--json');
    expect(doctorSection).toContain('scripting');
    expect(doctorSection).toContain('savestate doctor --json');
  });

  it('documents doctor --json when missing', () => {
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--json');
    expect(doctorSection).toContain('scripting');
    expect(doctorSection).toContain('found, total, healthy, unhealthy');
    expect(doctorSection).toContain('savestate doctor --json');
    expect(doctor).toContain('export function formatDoctorMissingJson');
  });

  it('registers savestate inspect on the CLI', () => {
    expect(cli).toContain("command('inspect <snapshot-id>')");
    expect(cli).toContain(".option('--json'");
  });

  it('registers --json on savestate inspect', () => {
    const inspectBlock = cli.slice(cli.indexOf("command('inspect <snapshot-id>')"), cli.indexOf("command('trust')"));
    expect(inspectBlock).toContain(".option('--json'");
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
    expect(inspectSection).toContain('savestate init');
    expect(inspectSection).toContain('passphrase');
  });

  it('documents inspect --json', () => {
    const inspectSection = docs.slice(docs.indexOf('id="inspect"'), docs.indexOf('id="diff"'));
    expect(inspectSection).toContain('--json');
    expect(inspectSection).toContain('scripting');
    expect(inspectSection).toContain('savestate inspect latest --json');
  });

  it('documents inspect --json when missing', () => {
    const inspectSection = docs.slice(docs.indexOf('id="inspect"'), docs.indexOf('id="diff"'));
    expect(inspectSection).toContain('--json');
    expect(inspectSection).toContain('scripting');
    expect(inspectSection).toContain('found, id, timestamp, platform, hasIdentity');
    expect(inspectSection).toContain('savestate inspect latest --json');
    expect(inspect).toContain('export function formatInspectMissingJson');
  });

  it('documents inspect --json when SaveState is not initialized', () => {
    const inspectSection = docs.slice(docs.indexOf('id="inspect"'), docs.indexOf('id="diff"'));
    expect(inspectSection).toContain('--json');
    expect(inspectSection).toContain('scripting');
    expect(inspectSection).toContain(
      'When SaveState is not initialized, emits a missing summary (found, id, timestamp, platform, hasIdentity',
    );
    expect(inspectSection).toContain('savestate inspect latest --json');
    expect(inspect).toContain('export function formatInspectMissingJson');
    expect(inspect).toContain('formatInspectMissingJson(snapshotId)');
  });

  it('documents inspect snapshot-id as a single snapshot id', () => {
    const inspectSection = docs.slice(docs.indexOf('id="inspect"'), docs.indexOf('id="diff"'));
    expect(inspectSection).toContain('&lt;snapshot-id&gt;');
    expect(inspectSection).toContain('Must be a single non-empty snapshot id');
    expect(inspect).toContain('export function parseInspectId');
  });

  it('lists savestate list in the command overview', () => {
    expect(docs).toContain('id="list"');
    expect(docs).toContain('savestate list');
  });

  it('documents list --since, --until, --adapter, and --tag', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--json');
    expect(listSection).toContain('--limit');
    expect(listSection).toContain('--since');
    expect(listSection).toContain('--until');
    expect(listSection).toContain('--adapter');
    expect(listSection).toContain('--tag');
    expect(listSection).toContain('50');
    expect(listSection).toContain('ISO 8601');
    expect(listSection).toContain('savestate init');
  });

  it('documents list --since as an ISO 8601 date', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--since');
    expect(listSection).toContain('Must be an ISO 8601 date');
    expect(listSource).toContain('export function parseListSince');
  });

  it('documents list --until as an ISO 8601 date', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--until');
    expect(listSection).toContain('Must be an ISO 8601 date');
    expect(listSource).toContain('export function parseListUntil');
  });

  it('documents list --adapter as a known adapter', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--adapter');
    expect(listSection).toContain(
      'Must be one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf',
    );
    expect(listSource).toContain('export function parseListAdapter');
  });

  it('documents list --tag as a single snapshot tag', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--tag');
    expect(listSection).toContain('Must be a single non-empty snapshot tag (no commas)');
    expect(listSource).toContain('export function parseListTag');
  });

  it('registers --json on savestate list', () => {
    const listBlock = cli.slice(cli.indexOf("command('list')"), cli.indexOf("command('stats')"));
    expect(listBlock).toContain(".option('--json'");
  });

  it('documents list --json', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--json');
    expect(listSection).toContain('scripting');
    expect(listSection).toContain('savestate list --json');
  });

  it('documents list --json when missing', () => {
    const listSection = docs.slice(docs.indexOf('id="list"'), docs.indexOf('id="stats"'));
    expect(listSection).toContain('--json');
    expect(listSection).toContain('scripting');
    expect(listSection).toContain('found, total, storage');
    expect(listSection).toContain('savestate list --json');
    expect(listSource).toContain('export function formatListMissingJson');
  });

  it('lists savestate search in the command overview', () => {
    expect(docs).toContain('id="search"');
    expect(docs).toContain('savestate search');
  });

  it('documents restore snapshot-id as a single snapshot id', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('[snapshot-id]');
    expect(restoreSection).toContain('Must be a single non-empty snapshot id');
    expect(restore).toContain('export function parseRestoreId');
  });

  it('documents restore --include as known restore categories', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('--include');
    expect(restoreSection).toContain('Must be one or more of: identity, memory, conversations');
    expect(restore).toContain('export function parseRestoreInclude');
  });

  it('documents restore --to as a known adapter', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('--to');
    expect(restoreSection).toContain(
      'Must be one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf',
    );
    expect(restore).toContain('export function parseRestoreTo');
  });

  it('registers --json on savestate restore', () => {
    const restoreBlock = cli.slice(cli.indexOf("command('restore [snapshot-id]')"), cli.indexOf("command('list')"));
    expect(restoreBlock).toContain(".option('--json'");
  });

  it('documents restore --json', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('--json');
    expect(restoreSection).toContain('Decrypts the archive');
    expect(restoreSection).toContain('savestate restore latest --json --dry-run');
  });

  it('documents restore --json when missing', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('--json');
    expect(restoreSection).toContain('scripting');
    expect(restoreSection).toContain('found, snapshotId, timestamp, platform, hasIdentity');
    expect(restoreSection).toContain('savestate restore latest --json');
    expect(restore).toContain('export function formatRestoreMissingJson');
  });

  it('documents restore --json when SaveState is not initialized', () => {
    const restoreSection = docs.slice(docs.indexOf('id="restore"'), docs.indexOf('id="list"'));
    expect(restoreSection).toContain('--json');
    expect(restoreSection).toContain('scripting');
    expect(restoreSection).toContain(
      'When SaveState is not initialized, emits a missing summary (found, snapshotId, timestamp, platform, hasIdentity',
    );
    expect(restoreSection).toContain('savestate restore latest --json');
    expect(restore).toContain('export function formatRestoreMissingJson');
    expect(restore).toContain('formatRestoreMissingJson(resolvedId)');
  });

  it('registers --json on savestate snapshot', () => {
    const snapshotBlock = cli.slice(cli.indexOf("command('snapshot')"), cli.indexOf("command('restore"));
    expect(snapshotBlock).toContain(".option('--json'");
  });

  it('documents snapshot --json', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--json');
    expect(snapshotSection).toContain('Encrypts the archive');
    expect(snapshotSection).toContain('savestate snapshot --json --full');
  });

  it('documents snapshot --adapter as a known adapter', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--adapter');
    expect(snapshotSection).toContain(
      'Must be one of: clawdbot, claude-code, claude-web, openai-assistants, chatgpt, gemini, cursor, windsurf',
    );
    expect(snapshot).toContain('export function parseSnapshotAdapter');
  });

  it('documents snapshot --json when missing', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--json');
    expect(snapshotSection).toContain('scripting');
    expect(snapshotSection).toContain('found, adapter, snapshotId, timestamp, platform');
    expect(snapshotSection).toContain('savestate snapshot --json');
    expect(snapshot).toContain('export function formatSnapshotMissingJson');
  });

  it('documents snapshot --json when SaveState is not initialized', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--json');
    expect(snapshotSection).toContain('scripting');
    expect(snapshotSection).toContain(
      'When SaveState is not initialized, emits a missing summary (found, adapter, snapshotId, timestamp, platform',
    );
    expect(snapshotSection).toContain('savestate snapshot --json --full');
    expect(snapshot).toContain('export function formatSnapshotMissingJson');
    expect(snapshot).toContain("formatSnapshotMissingJson(adapterId ?? '')");
  });

  it('documents snapshot --label as a single snapshot label', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--label');
    expect(snapshotSection).toContain('Must be a single non-empty snapshot label (no commas)');
    expect(snapshot).toContain('export function parseSnapshotLabel');
  });

  it('documents snapshot --tags as one or more non-empty snapshot tags', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--tags');
    expect(snapshotSection).toContain('Must be one or more non-empty snapshot tags (comma-separated)');
    expect(snapshot).toContain('export function parseSnapshotTags');
  });

  it('documents snapshot --schedule as a duration up to 7 days', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--schedule');
    expect(snapshotSection).toContain('Must be a duration like <code>1h</code>, <code>6h</code>, <code>12h</code>, or <code>1d</code> up to 7 days');
    expect(snapshot).toContain('export function parseSnapshotSchedule');
  });

  it('documents snapshot --tag and --meta state entries', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--tag');
    expect(snapshotSection).toContain('--meta');
    expect(snapshotSection).toContain('type:key=value');
    expect(snapshotSection).toContain('key=value');
    expect(snapshotSection).toContain('decision');
    expect(snapshotSection).toContain('preference');
    expect(snapshotSection).toContain('error');
    expect(snapshotSection).toContain('api_response');
    expect(snapshotSection).toContain('custom');
    expect(snapshotSection).toContain('decision:api_provider=openai');
    expect(cli).toContain('--tag <entry...>');
    expect(cli).toContain('--meta <entry...>');
  });

  it('documents snapshot --tag as type:key=value with a known type', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--tag');
    expect(snapshotSection).toContain('Must be type:key=value with type one of: decision, preference, error, api_response, custom');
    expect(snapshot).toContain('export function parseSnapshotTag');
  });

  it('documents snapshot --meta as key=value with a non-empty key and value', () => {
    const snapshotSection = docs.slice(docs.indexOf('id="snapshot"'), docs.indexOf('id="restore"'));
    expect(snapshotSection).toContain('--meta');
    expect(snapshotSection).toContain('Must be key=value with a non-empty key and value');
    expect(snapshot).toContain('export function parseSnapshotMeta');
  });

  it('registers --json on savestate search', () => {
    const searchBlock = cli.slice(cli.indexOf("command('search <query>')"), cli.indexOf("command('login')"));
    expect(searchBlock).toContain(".option('--json'");
  });

  it('documents search --type, --limit, --snapshot, and --json', () => {
    const searchSection = docs.slice(docs.indexOf('id="search"'), docs.indexOf('id="config"'));
    expect(searchSection).toContain('--type');
    expect(searchSection).toContain('--limit');
    expect(searchSection).toContain('--snapshot');
    expect(searchSection).toContain('--json');
    expect(searchSection).toContain('memory');
    expect(searchSection).toContain('conversation');
    expect(searchSection).toContain('identity');
    expect(searchSection).toContain('knowledge');
    expect(searchSection).toContain('20');
    expect(searchSection).toContain('savestate init');
  });

  it('documents search --json when missing', () => {
    const searchSection = docs.slice(docs.indexOf('id="search"'), docs.indexOf('id="config"'));
    expect(searchSection).toContain('--json');
    expect(searchSection).toContain('scripting');
    expect(searchSection).toContain('found, query, snapshot, count');
    expect(searchSection).toContain('--snapshot missing --json');
    expect(search).toContain('export function formatSearchMissingJson');
  });

  it('documents search --json when SaveState is not initialized', () => {
    const searchSection = docs.slice(docs.indexOf('id="search"'), docs.indexOf('id="config"'));
    expect(searchSection).toContain('--json');
    expect(searchSection).toContain('scripting');
    expect(searchSection).toContain(
      'When SaveState is not initialized, emits a missing summary (found, query, snapshot, count',
    );
    expect(searchSection).toContain('savestate search');
    expect(search).toContain('export function formatSearchMissingJson');
    expect(search).toContain("formatSearchMissingJson(query, snapshotId ?? '')");
  });

  it('documents search --limit as a bounded positive integer', () => {
    const searchSection = docs.slice(docs.indexOf('id="search"'), docs.indexOf('id="config"'));
    expect(searchSection).toContain('--limit');
    expect(searchSection).toContain('positive integer up to 1000');
    expect(search).toContain('export function parseSearchLimit');
  });

  it('documents search query as non-empty', () => {
    const searchSection = docs.slice(docs.indexOf('id="search"'), docs.indexOf('id="config"'));
    expect(searchSection).toContain('&lt;query&gt;');
    expect(searchSection).toContain('Must be a non-empty query');
    expect(search).toContain('export function parseSearchQuery');
  });

  it('registers --json on savestate config', () => {
    const configBlock = cli.slice(cli.indexOf("command('config')"), cli.indexOf("command('adapters')"));
    expect(configBlock).toContain(".option('--json'");
  });

  it('documents config --json', () => {
    const configSection = docs.slice(docs.indexOf('id="config"'), docs.indexOf('id="adapters"'));
    expect(configSection).toContain('--json');
    expect(configSection).toContain('scripting');
    expect(configSection).toContain('savestate config --json');
  });

  it('documents config --set as a non-empty key=value pair', () => {
    const configSection = docs.slice(docs.indexOf('id="config"'), docs.indexOf('id="adapters"'));
    expect(configSection).toContain('--set');
    expect(configSection).toContain('Must be a non-empty key=value pair');
    expect(configSource).toContain('export function parseConfigSet');
  });

  it('documents config --json when missing', () => {
    const configSection = docs.slice(docs.indexOf('id="config"'), docs.indexOf('id="adapters"'));
    expect(configSection).toContain('--json');
    expect(configSection).toContain('scripting');
    expect(configSection).toContain('found, version, storage, defaultAdapter');
    expect(configSection).toContain('savestate config --json');
    expect(configSource).toContain('export function formatConfigMissingJson');
  });

  it('registers --json on savestate adapters', () => {
    const adaptersBlock = cli.slice(cli.indexOf("command('adapters')"), cli.indexOf("command('antibodies"));
    expect(adaptersBlock).toContain(".option('--json'");
  });

  it('lists savestate adapters in the command overview', () => {
    expect(docs).toContain('id="adapters"');
    expect(docs).toContain('savestate adapters');
  });

  it('documents adapters --json', () => {
    const adaptersSection = docs.slice(docs.indexOf('id="adapters"'), docs.indexOf('id="export"'));
    expect(adaptersSection).toContain('--json');
    expect(adaptersSection).toContain('scripting');
    expect(adaptersSection).toContain('/docs/adapters.html');
  });

  it('documents adapters --json when missing', () => {
    const adaptersSection = docs.slice(docs.indexOf('id="adapters"'), docs.indexOf('id="export"'));
    expect(adaptersSection).toContain('--json');
    expect(adaptersSection).toContain('scripting');
    expect(adaptersSection).toContain('found, total');
    expect(adaptersSection).toContain('savestate adapters --json');
    expect(adapters).toContain('export function formatAdaptersMissingJson');
  });

  it('registers --json on savestate diff', () => {
    const diffBlock = cli.slice(cli.indexOf("command('diff <a> <b>')"), cli.indexOf("command('config')"));
    expect(diffBlock).toContain(".option('--json'");
  });

  it('lists savestate diff in the command overview', () => {
    expect(docs).toContain('id="diff"');
    expect(docs).toContain('savestate diff');
  });

  it('documents diff --json and that it decrypts both archives', () => {
    const diffSection = docs.slice(docs.indexOf('id="diff"'), docs.indexOf('id="search"'));
    expect(diffSection).toContain('--json');
    expect(diffSection).toContain('identity');
    expect(diffSection).toContain('savestate init');
    expect(diffSection).toContain('passphrase');
    expect(diffSection).toContain('Decrypts both archives');
  });

  it('documents diff snapshot ids as single snapshot ids', () => {
    const diffSection = docs.slice(docs.indexOf('id="diff"'), docs.indexOf('id="search"'));
    expect(diffSection).toContain('&lt;snapshot-a&gt;');
    expect(diffSection).toContain('&lt;snapshot-b&gt;');
    expect(diffSection).toContain('Must be a single non-empty snapshot id');
    expect(diff).toContain('export function parseDiffId');
  });

  it('documents diff --json', () => {
    const diffSection = docs.slice(docs.indexOf('id="diff"'), docs.indexOf('id="search"'));
    expect(diffSection).toContain('--json');
    expect(diffSection).toContain('scripting');
    expect(diffSection).toContain('savestate diff ss-2026-01-25 ss-2026-01-27 --json');
  });

  it('documents diff --json when missing', () => {
    const diffSection = docs.slice(docs.indexOf('id="diff"'), docs.indexOf('id="search"'));
    expect(diffSection).toContain('--json');
    expect(diffSection).toContain('scripting');
    expect(diffSection).toContain('found, snapshotA, snapshotB, hasChanges');
    expect(diffSection).toContain('savestate diff ss-2026-01-25 ss-2026-01-27 --json');
    expect(diff).toContain('export function formatDiffMissingJson');
  });

  it('documents diff --json when SaveState is not initialized', () => {
    const diffSection = docs.slice(docs.indexOf('id="diff"'), docs.indexOf('id="search"'));
    expect(diffSection).toContain('--json');
    expect(diffSection).toContain('scripting');
    expect(diffSection).toContain(
      'When SaveState is not initialized, emits a missing summary (found, snapshotA, snapshotB, hasChanges',
    );
    expect(diffSection).toContain('savestate diff ss-2026-01-25 ss-2026-01-27 --json');
    expect(diff).toContain('export function formatDiffMissingJson');
    expect(diff).toContain('formatDiffMissingJson(snapshotA, snapshotB)');
  });
});
