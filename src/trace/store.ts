/**
 * Askable Echoes Trace Ledger store.
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';
import {
  TRACE_SCHEMA_VERSION,
  type JsonValue,
  type SnapshotTrace,
  type TraceEvent,
  type TraceIndexFile,
  type TraceRunIndexEntry,
} from './types.js';

const TRACE_DIR_NAME = 'traces';
const TRACE_RUNS_DIR_NAME = 'runs';
const TRACE_INDEX_FILENAME = 'index.json';
const REDACTED_VALUE = '[REDACTED]';
const DEFAULT_REDACTION_KEYS = ['token', 'api_key', 'passphrase', 'secret', 'authorization'];

export type TraceExportFormat = 'jsonl';
export type TraceExportTarget = 'all' | string;

export interface TraceStoreOptions {
  cwd?: string;
  redactSecrets?: boolean;
  redactionKeys?: string[];
  redactionHook?: (payload: JsonValue) => JsonValue;
}

export class TraceStore {
  private readonly cwd?: string;
  private readonly redactSecrets: boolean;
  private readonly redactionKeys: string[];
  private readonly redactionHook?: (payload: JsonValue) => JsonValue;

  constructor(options?: TraceStoreOptions) {
    this.cwd = options?.cwd;
    this.redactSecrets = options?.redactSecrets ?? true;
    this.redactionKeys = (options?.redactionKeys ?? DEFAULT_REDACTION_KEYS)
      .map((key) => this.normalizeKey(key));
    this.redactionHook = options?.redactionHook;
  }

  async listRuns(): Promise<TraceRunIndexEntry[]> {
    const index = await this.loadIndex();
    return [...index.runs].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }

  async getRun(runId: string): Promise<TraceEvent[]> {
    const index = await this.loadIndex();
    const run = index.runs.find((entry) => entry.run_id === runId);
    if (!run) {
      return [];
    }

    const runPath = this.getRunPath(run.file);
    if (!existsSync(runPath)) {
      return [];
    }

    const raw = await readFile(runPath, 'utf-8');
    const events: TraceEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      events.push(JSON.parse(line) as TraceEvent);
    }
    return events;
  }

  async appendEvent(runId: string, event: TraceEvent): Promise<void> {
    if (!runId.trim()) {
      throw new Error('run_id is required');
    }
    if (event.run_id !== runId) {
      throw new Error(`Event run_id mismatch: expected "${runId}", got "${event.run_id}"`);
    }

    await this.ensureTraceDirs();

    const index = await this.loadIndex();
    const run = this.ensureRunEntry(index, runId, event);
    const persistedEvent: TraceEvent = {
      ...event,
      payload: this.redactPayload(event.payload),
    };

    await appendFile(
      this.getRunPath(run.file),
      `${JSON.stringify(persistedEvent)}\n`,
      'utf-8',
    );

    run.event_count += 1;
    run.updated_at = persistedEvent.timestamp;
    run.adapter = persistedEvent.adapter;
    run.tags = this.mergeTags(run.tags, persistedEvent.tags);
    await this.saveIndex(index);
  }

  async export(target: TraceExportTarget = 'all', format: TraceExportFormat = 'jsonl'): Promise<string> {
    if (format !== 'jsonl') {
      throw new Error(`Unsupported export format: ${format}`);
    }

    const runs = target === 'all'
      ? await this.listRuns()
      : (await this.listRuns()).filter((entry) => entry.run_id === target);

    const chunks: string[] = [];
    for (const run of runs) {
      const events = await this.getRun(run.run_id);
      for (const event of events) {
        chunks.push(JSON.stringify(event));
      }
    }

    return chunks.length > 0 ? `${chunks.join('\n')}\n` : '';
  }

  async readSnapshotTrace(): Promise<SnapshotTrace | undefined> {
    const index = await this.loadIndex();
    if (index.runs.length === 0) {
      return undefined;
    }

    const runs: Record<string, string> = {};
    for (const run of index.runs) {
      const runPath = this.getRunPath(run.file);
      if (!existsSync(runPath)) {
        continue;
      }
      runs[run.run_id] = await readFile(runPath, 'utf-8');
    }

    return {
      schema_version: index.schema_version,
      index: index.runs,
      runs,
    };
  }

  async writeSnapshotTrace(trace: SnapshotTrace): Promise<void> {
    await this.ensureTraceDirs();

    const knownRunIds = new Set<string>();
    const normalizedIndexRuns: TraceRunIndexEntry[] = trace.index.map((entry) => {
      knownRunIds.add(entry.run_id);
      return {
        ...entry,
        file: entry.file || this.makeRunFilename(entry.run_id),
      };
    });

    for (const runId of Object.keys(trace.runs)) {
      if (knownRunIds.has(runId)) {
        continue;
      }
      normalizedIndexRuns.push({
        run_id: runId,
        adapter: 'unknown',
        file: this.makeRunFilename(runId),
        event_count: this.countJsonlLines(trace.runs[runId]),
        started_at: '',
        updated_at: '',
      });
    }

    const index: TraceIndexFile = {
      schema_version: trace.schema_version || TRACE_SCHEMA_VERSION,
      runs: normalizedIndexRuns,
    };
    await this.saveIndex(index);

    for (const run of normalizedIndexRuns) {
      const content = trace.runs[run.run_id] ?? '';
      await writeFile(this.getRunPath(run.file), this.normalizeJsonl(content), 'utf-8');
    }
  }

  private traceDir(): string {
    return join(localConfigDir(this.cwd), TRACE_DIR_NAME);
  }

  private runsDir(): string {
    return join(this.traceDir(), TRACE_RUNS_DIR_NAME);
  }

  private indexPath(): string {
    return join(this.traceDir(), TRACE_INDEX_FILENAME);
  }

  private getRunPath(runFile: string): string {
    return join(this.runsDir(), runFile);
  }

  private async ensureTraceDirs(): Promise<void> {
    await mkdir(this.runsDir(), { recursive: true });
  }

  private async loadIndex(): Promise<TraceIndexFile> {
    const indexPath = this.indexPath();
    if (!existsSync(indexPath)) {
      return {
        schema_version: TRACE_SCHEMA_VERSION,
        runs: [],
      };
    }

    const raw = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TraceIndexFile>;
    return {
      schema_version: parsed.schema_version ?? TRACE_SCHEMA_VERSION,
      runs: parsed.runs ?? [],
    };
  }

  private async saveIndex(index: TraceIndexFile): Promise<void> {
    await mkdir(this.traceDir(), { recursive: true });
    await writeFile(this.indexPath(), `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
  }

  private ensureRunEntry(index: TraceIndexFile, runId: string, event: TraceEvent): TraceRunIndexEntry {
    const existing = index.runs.find((entry) => entry.run_id === runId);
    if (existing) {
      return existing;
    }

    const created: TraceRunIndexEntry = {
      run_id: runId,
      adapter: event.adapter,
      file: this.makeRunFilename(runId),
      event_count: 0,
      started_at: event.timestamp,
      updated_at: event.timestamp,
      tags: event.tags,
    };
    index.runs.push(created);
    return created;
  }

  private makeRunFilename(runId: string): string {
    return `run-${encodeURIComponent(runId)}.jsonl`;
  }

  private redactPayload(payload: JsonValue): JsonValue {
    const defaultRedacted = this.redactSecrets ? this.redactJson(payload) : payload;
    return this.redactionHook ? this.redactionHook(defaultRedacted) : defaultRedacted;
  }

  private redactJson(value: JsonValue): JsonValue {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactJson(item));
    }

    const output: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (this.shouldRedactKey(key)) {
        output[key] = REDACTED_VALUE;
      } else {
        output[key] = this.redactJson(child as JsonValue);
      }
    }
    return output;
  }

  private shouldRedactKey(key: string): boolean {
    const normalized = this.normalizeKey(key);
    return this.redactionKeys.some((needle) => normalized.includes(needle));
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private mergeTags(existing?: string[], incoming?: string[]): string[] | undefined {
    if (!existing && !incoming) {
      return undefined;
    }
    const merged = new Set<string>([...(existing ?? []), ...(incoming ?? [])]);
    return [...merged];
  }

  private normalizeJsonl(content: string): string {
    const trimmed = content.trimEnd();
    return trimmed.length > 0 ? `${trimmed}\n` : '';
  }

  private countJsonlLines(content: string): number {
    return content.split('\n').filter((line) => line.trim().length > 0).length;
  }
}
