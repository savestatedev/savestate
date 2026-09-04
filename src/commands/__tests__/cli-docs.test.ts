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

  it('documents import --target, --force, and missing parent rejection', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--target');
    expect(importSection).toContain('--force');
    expect(importSection).toContain('missing parent directory');
  });

  it('documents import --json', () => {
    const importSection = docs.slice(docs.indexOf('id="import"'), docs.indexOf('id="verify"'));
    expect(importSection).toContain('--json');
    expect(importSection).toContain('Decrypts the archive');
    expect(importSection).toContain('savestate import agent.savestate --json --dry-run');
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

  it('registers --json on savestate cloud', () => {
    const cloudBlock = cli.slice(cli.indexOf("command('cloud <subcommand>')"), cli.indexOf("command('team')"));
    expect(cloudBlock).toContain(".option('--json'");
  });

  it('documents cloud --json', () => {
    const cloudSection = docs.slice(docs.indexOf('id="cloud"'), docs.indexOf('id="mcp"'));
    expect(cloudSection).toContain('--json');
    expect(cloudSection).toContain('scripting');
    expect(cloudSection).toContain('savestate cloud list --json');
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

  it('documents integrity --user on quarantine and release', () => {
    const integritySection = docs.slice(docs.indexOf('id="integrity"'), docs.indexOf('id="trace"'));
    expect(integritySection).toContain('--user');
    expect(integritySection).toContain('quarantine');
    expect(integritySection).toContain('release');
    expect(integritySection).toContain('cli');
    expect(integritySection).toContain('--user reviewer-1');
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
    const doctorSection = docs.slice(docs.indexOf('id="doctor"'), docs.indexOf('id="inspect"'));
    expect(doctorSection).toContain('--json');
    expect(doctorSection).toContain('--adapter');
    expect(doctorSection).toContain('--limit');
    expect(doctorSection).toContain('checksums');
    expect(doctorSection).toContain('incremental chains');
  });

  it('registers savestate inspect on the CLI', () => {
    expect(cli).toContain("command('inspect <snapshot-id>')");
    expect(cli).toContain(".option('--json'");
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

  it('lists savestate search in the command overview', () => {
    expect(docs).toContain('id="search"');
    expect(docs).toContain('savestate search');
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
});
