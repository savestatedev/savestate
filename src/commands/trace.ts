/**
 * savestate trace — Askable Echoes trace ledger commands
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import { isInitialized } from '../config.js';
import {
  TraceStore,
  type TraceEvent,
  type TraceExportFormat,
  type TraceRunIndexEntry,
} from '../trace/index.js';

interface TraceListOptions {
  json?: boolean;
}

interface TraceShowOptions {
  json?: boolean;
}

interface TraceExportOptions {
  format?: TraceExportFormat;
  run?: string;
  json?: boolean;
}

export interface TraceRunJson {
  runId: string;
  adapter: string;
  eventCount: number;
  startedAt: string;
  updatedAt: string;
  tags: string[];
}

export interface TraceEventJson {
  timestamp: string;
  runId: string;
  adapter: string;
  eventType: string;
  tags: string[];
}

function toRunJson(run: TraceRunIndexEntry): TraceRunJson {
  return {
    runId: run.run_id,
    adapter: run.adapter,
    eventCount: run.event_count,
    startedAt: run.started_at,
    updatedAt: run.updated_at,
    tags: run.tags ?? [],
  };
}

function toEventJson(event: TraceEvent): TraceEventJson {
  return {
    timestamp: event.timestamp,
    runId: event.run_id,
    adapter: event.adapter,
    eventType: event.event_type,
    tags: event.tags ?? [],
  };
}

export function formatTraceRunsJson(runs: TraceRunIndexEntry[]): string {
  return JSON.stringify(runs.map(toRunJson), null, 2);
}

export function formatTraceEventsJson(events: TraceEvent[]): string {
  return JSON.stringify(events.map(toEventJson), null, 2);
}

export interface TraceShowMissingJson {
  found: false;
  runId: string;
  adapter: null;
  eventCount: 0;
}

export function formatTraceShowMissingJson(runId: string): string {
  return JSON.stringify(
    {
      found: false,
      runId,
      adapter: null,
      eventCount: 0,
    },
    null,
    2,
  );
}

export interface TraceExportJson {
  format: string;
  run: string;
  runCount: number;
  eventCount: number;
  runs: TraceRunJson[];
}

export interface TraceExportMissingJson {
  found: false;
  format: string;
  run: string;
  runCount: 0;
  eventCount: 0;
}

export function formatTraceExportMissingJson(run: string, format?: string): string {
  return JSON.stringify(
    {
      found: false,
      format: format ?? 'jsonl',
      run,
      runCount: 0,
      eventCount: 0,
    },
    null,
    2,
  );
}

export function formatTraceExportJson(input: {
  format?: string;
  run?: string;
  runs?: TraceRunIndexEntry[];
}): string {
  const runs = (input.runs ?? []).map((run) => {
    const json = toRunJson(run);
    return {
      runId: json.runId,
      adapter: json.adapter,
      eventCount: json.eventCount,
      startedAt: json.startedAt,
      updatedAt: json.updatedAt,
      tags: json.tags,
    };
  });
  return JSON.stringify(
    {
      format: input.format ?? 'jsonl',
      run: input.run ?? 'all',
      runCount: runs.length,
      eventCount: runs.reduce((sum, run) => sum + run.eventCount, 0),
      runs,
    },
    null,
    2,
  );
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
    .option('--json', 'Output as JSON')
    .action(traceExportCommand);
}

export async function traceListCommand(options: TraceListOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const store = new TraceStore();
  const runs = await store.listRuns();

  if (options.json) {
    console.log(formatTraceRunsJson(runs));
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
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const store = new TraceStore();
  const events = await store.getRun(runId);

  if (events.length === 0) {
    if (options.json) {
      console.log(formatTraceShowMissingJson(runId));
      return;
    }
    console.log(chalk.red(`✗ Trace run not found: ${runId}`));
    console.log();
    process.exit(1);
  }

  if (options.json) {
    console.log(formatTraceEventsJson(events));
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
  const run = options.run ?? 'all';

  if (options.json) {
    const allRuns = await store.listRuns();
    const runs = run === 'all' ? allRuns : allRuns.filter((entry) => entry.run_id === run);
    if (run !== 'all' && runs.length === 0) {
      console.log(formatTraceExportMissingJson(run, format));
      return;
    }
    console.log(formatTraceExportJson({ format, run, runs }));
    return;
  }

  const output = await store.export(run, format);
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

