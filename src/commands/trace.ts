/**
 * savestate trace — Askable Echoes trace ledger commands
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { isInitialized } from '../config.js';
import { TraceStore, type TraceExportFormat } from '../trace/index.js';

interface TraceListOptions {
  json?: boolean;
}

interface TraceShowOptions {
  json?: boolean;
}

interface TraceExportOptions {
  format?: TraceExportFormat;
  run?: string;
}

export function registerTraceCommands(program: Command): void {
  const trace = program
    .command('trace')
    .description('Inspect Askable Echoes trace runs');

  trace
    .command('list')
    .description('List trace runs')
    .option('--json', 'Output as JSON')
    .action(traceListCommand);

  trace
    .command('show <run_id>')
    .description('Show events for a trace run')
    .option('--json', 'Output as JSON')
    .action(traceShowCommand);

  trace
    .command('export')
    .description('Export trace events as JSONL')
    .option('--format <format>', 'Export format', 'jsonl')
    .option('--run <id>', 'Export only a specific run ID')
    .action(traceExportCommand);
}

export async function traceListCommand(options: TraceListOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const store = new TraceStore();
  const runs = await store.listRuns();

  if (options.json) {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  console.log(chalk.bold('🧾 Trace Runs'));
  console.log();

  if (runs.length === 0) {
    console.log(chalk.dim('  No trace runs found in .savestate/traces.'));
    console.log();
    return;
  }

  const runWidth = Math.max(6, ...runs.map((run) => run.run_id.length));
  const adapterWidth = Math.max(7, ...runs.map((run) => run.adapter.length));
  const eventsWidth = Math.max(6, ...runs.map((run) => String(run.event_count).length));

  const header = [
    'Run ID'.padEnd(runWidth),
    'Adapter'.padEnd(adapterWidth),
    'Events'.padStart(eventsWidth),
    'Updated',
  ].join('  ');

  console.log(chalk.dim(`  ${header}`));
  console.log(chalk.dim(`  ${'─'.repeat(header.length)}`));

  for (const run of runs) {
    const updated = formatDate(run.updated_at);
    const row = [
      chalk.cyan(run.run_id.padEnd(runWidth)),
      run.adapter.padEnd(adapterWidth),
      String(run.event_count).padStart(eventsWidth),
      updated,
    ].join('  ');
    console.log(`  ${row}`);
  }

  console.log();
}

export async function traceShowCommand(runId: string, options: TraceShowOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const store = new TraceStore();
  const events = await store.getRun(runId);

  if (events.length === 0) {
    console.log(chalk.red(`✗ Trace run not found: ${runId}`));
    console.log();
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  console.log(chalk.bold(`🧾 Trace Run: ${chalk.cyan(runId)}`));
  console.log(chalk.dim(`   ${events.length} event${events.length === 1 ? '' : 's'}`));
  console.log();

  for (const event of events) {
    const tags = event.tags?.length ? chalk.dim(` [${event.tags.join(', ')}]`) : '';
    console.log(
      `  ${chalk.cyan(event.timestamp)}  ${chalk.yellow(event.event_type)}  ${chalk.dim(event.adapter)}${tags}`,
    );

    const payload = JSON.stringify(event.payload, null, 2);
    if (payload && payload !== '{}') {
      for (const line of payload.split('\n')) {
        console.log(`    ${chalk.dim(line)}`);
      }
    }
  }

  console.log();
}

export async function traceExportCommand(options: TraceExportOptions): Promise<void> {
  if (!isInitialized()) {
    console.error(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const format = options.format ?? 'jsonl';
  if (format !== 'jsonl') {
    console.error(chalk.red(`✗ Unsupported format: ${format}. Only jsonl is supported.`));
    process.exit(1);
  }

  const store = new TraceStore();
  const output = await store.export(options.run ?? 'all', format);
  process.stdout.write(output);
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

