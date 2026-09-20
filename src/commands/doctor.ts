/**
 * savestate doctor — Health check across all snapshots.
 *
 * Decrypts every snapshot in the index, verifies that:
 *   - the archive can be unpacked
 *   - the manifest is parseable and consistent
 *   - the content checksum matches (post-fix snapshots)
 *   - incremental chains can be reconstructed end-to-end
 *
 * Reports a per-snapshot status table + a final summary.
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex } from '../index-file.js';
import type { SnapshotIndexEntry } from '../index-file.js';
import { resolveStorage } from '../storage/index.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, computeContentChecksum } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { getPassphrase } from '../passphrase.js';

interface DoctorOptions {
  json?: boolean;
  adapter?: string;
  snapshot?: string;
  until?: string;
  limit?: string;
}

const MAX_DOCTOR_LIMIT = 1000;
const DOCTOR_ADAPTERS = [
  'clawdbot',
  'claude-code',
  'claude-web',
  'openai-assistants',
  'chatgpt',
  'gemini',
  'cursor',
  'windsurf',
] as const;
const DOCTOR_ADAPTER_LIST = DOCTOR_ADAPTERS.join(', ');

/** Parse a doctor snapshot cap without turning user input errors into empty output. */
export function parseDoctorLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DOCTOR_LIMIT) {
    throw new Error(
      `Invalid --limit value "${value}". Expected a positive integer up to ${MAX_DOCTOR_LIMIT}.`,
    );
  }
  return limit;
}

/** Parse doctor --adapter without treating unknown ids as an empty snapshot set. */
export function parseDoctorAdapter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const adapter = value.trim().toLowerCase();
  if ((DOCTOR_ADAPTERS as readonly string[]).includes(adapter)) {
    return adapter;
  }

  throw new Error(
    `Invalid --adapter value "${value}". Expected one of: ${DOCTOR_ADAPTER_LIST}.`,
  );
}

/** Parse doctor --snapshot without treating blank ids as an empty snapshot set. */
export function parseDoctorSnapshot(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const snapshot = value.trim();
  if (snapshot.length === 0 || snapshot.includes(',') || /\s/.test(snapshot)) {
    throw new Error(
      `Invalid --snapshot value "${value}". Expected a single non-empty snapshot id.`,
    );
  }

  return snapshot;
}

/** Parse doctor --until without treating invalid dates as an empty snapshot set. */
export function parseDoctorUntil(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid --until value "${value}". Expected an ISO 8601 date.`,
    );
  }
  return ms;
}

/** Resolve doctor snapshot filters before decrypting archives. */
export function resolveDoctorSnapshots<T extends { id: string; timestamp: string; adapter?: string }>(
  snapshots: T[],
  options: Pick<DoctorOptions, 'adapter' | 'snapshot' | 'until' | 'limit'>,
): T[] {
  const adapter = parseDoctorAdapter(options.adapter);
  const snapshot = parseDoctorSnapshot(options.snapshot);
  const until = parseDoctorUntil(options.until);
  let targets = snapshots.filter((entry) => {
    if (adapter !== undefined && entry.adapter !== adapter) return false;
    if (snapshot !== undefined && entry.id !== snapshot) return false;
    if (until !== undefined && new Date(entry.timestamp).getTime() > until) {
      return false;
    }
    return true;
  });
  const limit = parseDoctorLimit(options.limit);
  if (limit !== undefined) {
    targets = [...targets]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  return targets;
}

export interface SnapshotDiagnosis {
  id: string;
  filename: string;
  ok: boolean;
  incremental: boolean;
  errors: string[];
  warnings: string[];
}

export interface DoctorJson {
  total: number;
  healthy: number;
  unhealthy: number;
  results: SnapshotDiagnosis[];
}

export function formatDoctorJson(results: SnapshotDiagnosis[]): string {
  const healthy = results.filter((r) => r.ok).length;
  const unhealthy = results.length - healthy;
  const record: DoctorJson = {
    total: results.length,
    healthy,
    unhealthy,
    results,
  };
  return JSON.stringify(record, null, 2);
}

export interface DoctorMissingJson {
  found: false;
  total: 0;
  healthy: 0;
  unhealthy: 0;
}

export function formatDoctorMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
      healthy: 0,
      unhealthy: 0,
    },
    null,
    2,
  );
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  parseDoctorAdapter(options.adapter);
  parseDoctorSnapshot(options.snapshot);
  parseDoctorUntil(options.until);
  parseDoctorLimit(options.limit);

  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatDoctorMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const index = await loadIndex();
  const targets = resolveDoctorSnapshots(index.snapshots, options);

  if (targets.length === 0) {
    if (options.json) {
      console.log(formatDoctorJson([]));
      return;
    }
    console.log(
      chalk.dim(
        index.snapshots.length === 0
          ? '  No snapshots in index. Nothing to check.'
          : '  No snapshots match those filters.',
      ),
    );
    console.log();
    return;
  }

  const passphrase = await getPassphrase();
  const storage = resolveStorage(config);

  const spinner = options.json
    ? null
    : ora(`Checking ${targets.length} snapshot(s)...`).start();

  const results: SnapshotDiagnosis[] = [];
  for (const entry of targets) {
    const diag = await diagnoseSnapshot(entry, storage, passphrase);
    results.push(diag);
  }

  spinner?.stop();

  if (options.json) {
    console.log(formatDoctorJson(results));
    return;
  }

  const healthy = results.filter((r) => r.ok).length;
  const unhealthy = results.length - healthy;

  console.log(chalk.bold(`🩺 SaveState Doctor`));
  console.log(chalk.dim(`   Storage: ${config.storage.type}`));
  console.log();

  for (const r of results) {
    const icon = r.ok ? chalk.green('✓') : chalk.red('✗');
    const tag = r.incremental ? chalk.dim(' (incremental)') : '';
    console.log(`  ${icon} ${chalk.cyan(r.id)}${tag}`);
    for (const err of r.errors) console.log(`    ${chalk.red('error:')} ${err}`);
    for (const warn of r.warnings) console.log(`    ${chalk.yellow('warn:')} ${warn}`);
  }

  console.log();
  if (unhealthy === 0) {
    console.log(chalk.green(`  ✓ All ${healthy} snapshot(s) healthy.`));
  } else {
    console.log(
      chalk.red(`  ✗ ${unhealthy} unhealthy / ${healthy} healthy / ${results.length} total.`),
    );
  }
  console.log();

  if (unhealthy > 0) {
    process.exit(1);
  }
}

export async function diagnoseSnapshot(
  entry: SnapshotIndexEntry,
  storage: import('../types.js').StorageBackend,
  passphrase: string,
): Promise<SnapshotDiagnosis> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let incremental = false;

  let encrypted: Buffer;
  try {
    encrypted = await storage.get(entry.filename);
  } catch (err) {
    errors.push(`storage read failed: ${errMessage(err)}`);
    return { id: entry.id, filename: entry.filename, ok: false, incremental, errors, warnings };
  }

  let archive: Buffer;
  try {
    archive = await decrypt(encrypted, passphrase);
  } catch (err) {
    errors.push(`decrypt failed: ${errMessage(err)}`);
    return { id: entry.id, filename: entry.filename, ok: false, incremental, errors, warnings };
  }

  let fileMap: Map<string, Buffer>;
  try {
    fileMap = await unpackFromArchive(archive);
  } catch (err) {
    errors.push(`unpack failed: ${errMessage(err)}`);
    return { id: entry.id, filename: entry.filename, ok: false, incremental, errors, warnings };
  }

  if (isIncremental(fileMap)) {
    incremental = true;
    try {
      fileMap = await reconstructFromChain(entry.id, storage, passphrase);
    } catch (err) {
      errors.push(`chain reconstruction failed: ${errMessage(err)}`);
      return { id: entry.id, filename: entry.filename, ok: false, incremental, errors, warnings };
    }
  }

  let snapshot;
  try {
    snapshot = unpackSnapshot(fileMap);
  } catch (err) {
    errors.push(`manifest parse failed: ${errMessage(err)}`);
    return { id: entry.id, filename: entry.filename, ok: false, incremental, errors, warnings };
  }

  if (snapshot.manifest.id !== entry.id) {
    warnings.push(
      `manifest id (${snapshot.manifest.id}) does not match index id (${entry.id})`,
    );
  }

  const expected = snapshot.manifest.checksum;
  if (expected) {
    const actual = computeContentChecksum(fileMap);
    if (actual !== expected) {
      warnings.push(`content checksum mismatch (likely legacy hash format)`);
    }
  } else {
    warnings.push('no checksum in manifest');
  }

  return {
    id: entry.id,
    filename: entry.filename,
    ok: errors.length === 0,
    incremental,
    errors,
    warnings,
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
