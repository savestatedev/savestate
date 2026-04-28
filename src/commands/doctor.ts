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
  limit?: string;
}

export interface SnapshotDiagnosis {
  id: string;
  filename: string;
  ok: boolean;
  incremental: boolean;
  errors: string[];
  warnings: string[];
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const config = await loadConfig();
  const index = await loadIndex();

  let targets = index.snapshots;
  if (options.adapter) {
    targets = targets.filter((s) => s.adapter === options.adapter);
  }
  if (options.limit) {
    const n = parseInt(options.limit, 10);
    targets = [...targets]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, n);
  }

  if (targets.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ total: 0, healthy: 0, unhealthy: 0, results: [] }, null, 2));
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

  const healthy = results.filter((r) => r.ok).length;
  const unhealthy = results.length - healthy;

  if (options.json) {
    console.log(
      JSON.stringify({ total: results.length, healthy, unhealthy, results }, null, 2),
    );
    return;
  }

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
