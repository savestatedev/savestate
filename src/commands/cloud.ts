/**
 * savestate cloud — Cloud storage commands (Pro/Team)
 *
 * Manages cloud backups through the SaveState API.
 * Requires Pro or Team subscription.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, writeFileSync, createWriteStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isInitialized, loadConfig } from '../config.js';
import { loadIndex } from '../index-file.js';

/** Get the snapshots directory (global ~/.savestate/snapshots/) */
function getSnapshotsDir(): string {
  return join(homedir(), '.savestate', 'snapshots');
}

const API_BASE = process.env.SAVESTATE_API_URL || 'https://savestate.dev/api';

interface CloudOptions {
  id?: string;
  all?: boolean;
  force?: boolean;
  json?: boolean;
}

export interface CloudSnapshotJson {
  id: string;
  size: number;
  createdAt: string;
}

export interface CloudListResult {
  tier: string;
  cloudStorageUsed: number;
  cloudStorageLimit: number;
  snapshots: CloudSnapshotJson[];
}

export function formatCloudListJson(result: CloudListResult): string {
  return JSON.stringify(
    {
      tier: result.tier,
      cloudStorageUsed: result.cloudStorageUsed,
      cloudStorageLimit: result.cloudStorageLimit,
      snapshots: result.snapshots,
    },
    null,
    2,
  );
}

export interface CloudListMissingJson {
  found: false;
  total: 0;
  shown: 0;
}

export function formatCloudListMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      total: 0,
      shown: 0,
    },
    null,
    2,
  );
}

export interface CloudPushSnapshotJson {
  id: string;
  uploaded: boolean;
}

export interface CloudPushResult {
  pushed: number;
  failed: number;
  all: boolean;
  snapshots: CloudPushSnapshotJson[];
}

export function formatCloudPushJson(result: CloudPushResult): string {
  return JSON.stringify(
    {
      pushed: result.pushed,
      failed: result.failed,
      all: result.all,
      snapshots: result.snapshots,
    },
    null,
    2,
  );
}

export interface CloudDeleteSnapshotJson {
  id: string;
  deleted: boolean;
}

export interface CloudDeleteResult {
  deleted: number;
  failed: number;
  all: boolean;
  snapshots: CloudDeleteSnapshotJson[];
}

export function formatCloudDeleteJson(result: CloudDeleteResult): string {
  return JSON.stringify(
    {
      deleted: result.deleted,
      failed: result.failed,
      all: result.all,
      snapshots: result.snapshots,
    },
    null,
    2,
  );
}

export interface CloudDeleteMissingJson {
  found: false;
  id: string;
  deleted: 0;
  failed: 0;
}

export function formatCloudDeleteMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      deleted: 0,
      failed: 0,
    },
    null,
    2,
  );
}

export interface CloudPushMissingJson {
  found: false;
  id: string;
  pushed: 0;
  failed: 0;
}

export function formatCloudPushMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      pushed: 0,
      failed: 0,
    },
    null,
    2,
  );
}

export interface CloudPullSnapshotJson {
  id: string;
  downloaded: boolean;
  skipped: boolean;
}

export interface CloudPullResult {
  pulled: number;
  failed: number;
  skipped: number;
  all: boolean;
  snapshots: CloudPullSnapshotJson[];
}

export function formatCloudPullJson(result: CloudPullResult): string {
  return JSON.stringify(
    {
      pulled: result.pulled,
      failed: result.failed,
      skipped: result.skipped,
      all: result.all,
      snapshots: result.snapshots,
    },
    null,
    2,
  );
}

export interface CloudPullMissingJson {
  found: false;
  id: string;
  pulled: 0;
  failed: 0;
  skipped: 0;
}

export function formatCloudPullMissingJson(id: string): string {
  return JSON.stringify(
    {
      found: false,
      id,
      pulled: 0,
      failed: 0,
      skipped: 0,
    },
    null,
    2,
  );
}

interface SubscriptionStatus {
  valid: boolean;
  tier?: string;
  error?: string;
  cloudStorageUsed?: number;
  cloudStorageLimit?: number;
}

/**
 * Verify subscription is Pro or Team
 */
async function verifySubscription(): Promise<SubscriptionStatus> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  if (!apiKey) {
    return { valid: false, error: 'Not logged in. Run `savestate login` first.' };
  }

  try {
    const res = await fetch(`${API_BASE}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return { valid: false, error: 'Could not verify subscription.' };
    }

    const data = await res.json() as Record<string, unknown>;
    const tier = (data.tier as string || 'free').toLowerCase();
    const storage = data.storage as { used?: number; limit?: number } || {};
    const cloudStorageUsed = storage.used || 0;
    const cloudStorageLimit = storage.limit || 0;

    if (tier === 'pro' || tier === 'team') {
      return { valid: true, tier, cloudStorageUsed, cloudStorageLimit };
    }

    return { 
      valid: false, 
      tier, 
      error: 'Cloud storage requires a Pro or Team subscription.' 
    };
  } catch {
    return { valid: false, error: 'Could not verify subscription. Check your internet connection.' };
  }
}

/**
 * Upload snapshot to cloud via proxy API
 */
async function uploadToCloud(snapshotId: string, data: Buffer): Promise<{ success: boolean; error?: string }> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const key = `snapshots/${snapshotId}.saf.enc`;
    const res = await fetch(`${API_BASE}/storage?key=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: data,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

/**
 * Download snapshot from cloud via proxy API
 */
async function downloadFromCloud(snapshotId: string): Promise<Buffer | null> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const key = `snapshots/${snapshotId}.saf.enc`;
    const res = await fetch(`${API_BASE}/storage?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Delete snapshot from cloud
 */
async function deleteFromCloud(snapshotId: string): Promise<boolean> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const key = `snapshots/${snapshotId}.saf.enc`;
    const res = await fetch(`${API_BASE}/storage?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List cloud snapshots from API
 */
async function listCloudSnapshots(): Promise<Array<{ id: string; size: number; createdAt: string }>> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const res = await fetch(`${API_BASE}/storage?list=true`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return [];
    const data = await res.json() as { items: Array<{ key: string; size: number; lastModified: string }> };
    
    // Transform API response to expected format
    return (data.items || []).map(item => ({
      id: item.key.replace('snapshots/', '').replace('.saf.enc', ''),
      size: item.size,
      createdAt: item.lastModified,
    }));
  } catch {
    return [];
  }
}

/**
 * Push local snapshots to cloud
 */
export async function cloudPushCommand(options: CloudOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatCloudPushMissingJson(options.id ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Verify subscription
  const spinner = options.json ? null : ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner?.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    if (sub.tier === 'free') {
      console.log();
      console.log(chalk.dim('  Upgrade at: https://savestate.dev/#pricing'));
    }
    process.exit(1);
  }

  spinner?.succeed(`Subscription verified (${sub.tier})`);

  // Show storage usage
  if (!options.json && sub.cloudStorageLimit) {
    const usedMB = Math.round((sub.cloudStorageUsed || 0) / 1024 / 1024);
    const limitMB = Math.round(sub.cloudStorageLimit / 1024 / 1024);
    console.log(chalk.dim(`  Cloud storage: ${usedMB} MB / ${limitMB} MB`));
  }
  if (!options.json) {
    console.log();
  }

  // Get local snapshots
  const index = await loadIndex();
  const entries = index.snapshots || [];

  if (entries.length === 0) {
    if (options.json) {
      if (options.id) {
        console.log(formatCloudPushMissingJson(options.id));
        return;
      }
      console.log(formatCloudPushJson({ pushed: 0, failed: 0, all: Boolean(options.all), snapshots: [] }));
      return;
    }
    console.log(chalk.yellow('No local snapshots to push.'));
    console.log(chalk.dim('  Run `savestate snapshot` to create one.'));
    process.exit(0);
  }

  // Filter to specific snapshot or all
  let toPush = entries;
  if (options.id) {
    toPush = entries.filter(e => e.id === options.id || e.id.startsWith(options.id!));
    if (toPush.length === 0) {
      if (options.json) {
        console.log(formatCloudPushMissingJson(options.id));
        return;
      }
      console.log(chalk.red(`Snapshot not found: ${options.id}`));
      process.exit(1);
    }
  } else if (!options.all) {
    // Default: push latest only
    toPush = [entries[entries.length - 1]];
  }

  if (!options.json) {
    console.log(chalk.blue(`Pushing ${toPush.length} snapshot(s) to cloud...`));
    console.log();
  }

  const snapshotsDir = getSnapshotsDir();
  const snapshots: CloudPushSnapshotJson[] = [];
  let success = 0;
  let failed = 0;

  for (const entry of toPush) {
    const filePath = join(snapshotsDir, `${entry.id}.saf.enc`);
    
    if (!existsSync(filePath)) {
      if (!options.json) {
        console.log(chalk.yellow(`  ⚠ ${entry.id.slice(0, 8)} — file not found, skipping`));
      }
      snapshots.push({ id: entry.id, uploaded: false });
      failed++;
      continue;
    }

    const stat = statSync(filePath);
    const uploadSpinner = options.json
      ? null
      : ora(`  Uploading ${entry.id.slice(0, 8)}... (${Math.round(stat.size / 1024)} KB)`).start();

    try {
      // Read and upload the file through the proxy API
      const fileBuffer = readFileSync(filePath);
      const result = await uploadToCloud(entry.id, fileBuffer);

      if (!result.success) {
        uploadSpinner?.fail(`  ${entry.id.slice(0, 8)} — ${result.error || 'upload failed'}`);
        snapshots.push({ id: entry.id, uploaded: false });
        failed++;
        continue;
      }

      uploadSpinner?.succeed(`  ${entry.id.slice(0, 8)} — uploaded`);
      snapshots.push({ id: entry.id, uploaded: true });
      success++;
    } catch (err) {
      uploadSpinner?.fail(`  ${entry.id.slice(0, 8)} — ${err instanceof Error ? err.message : 'failed'}`);
      snapshots.push({ id: entry.id, uploaded: false });
      failed++;
    }
  }

  if (options.json) {
    console.log(formatCloudPushJson({
      pushed: success,
      failed,
      all: Boolean(options.all),
      snapshots,
    }));
    return;
  }

  console.log();
  if (success > 0) {
    console.log(chalk.green(`✓ Pushed ${success} snapshot(s) to cloud`));
  }
  if (failed > 0) {
    console.log(chalk.yellow(`⚠ ${failed} snapshot(s) failed`));
  }
}

/**
 * Pull snapshots from cloud
 */
export async function cloudPullCommand(options: CloudOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatCloudPullMissingJson(options.id ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Verify subscription
  const spinner = options.json ? null : ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner?.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    process.exit(1);
  }

  spinner?.succeed(`Subscription verified (${sub.tier})`);
  if (!options.json) {
    console.log();
  }

  // Get cloud snapshots
  const listSpinner = options.json ? null : ora('Fetching cloud snapshots...').start();
  const cloudSnapshots = await listCloudSnapshots();
  listSpinner?.stop();

  if (cloudSnapshots.length === 0) {
    if (options.json) {
      if (options.id) {
        console.log(formatCloudPullMissingJson(options.id));
        return;
      }
      console.log(formatCloudPullJson({ pulled: 0, failed: 0, skipped: 0, all: Boolean(options.all), snapshots: [] }));
      return;
    }
    console.log(chalk.yellow('No snapshots in cloud storage.'));
    console.log(chalk.dim('  Run `savestate cloud push` to upload snapshots.'));
    process.exit(0);
  }

  // Filter
  let toPull = cloudSnapshots;
  if (options.id) {
    toPull = cloudSnapshots.filter(s => s.id === options.id || s.id.startsWith(options.id!));
    if (toPull.length === 0) {
      if (options.json) {
        console.log(formatCloudPullMissingJson(options.id));
        return;
      }
      console.log(chalk.red(`Snapshot not found in cloud: ${options.id}`));
      process.exit(1);
    }
  } else if (!options.all) {
    toPull = [cloudSnapshots[cloudSnapshots.length - 1]];
  }

  if (!options.json) {
    console.log(chalk.blue(`Pulling ${toPull.length} snapshot(s) from cloud...`));
    console.log();
  }

  const snapshotsDir = getSnapshotsDir();
  const snapshots: CloudPullSnapshotJson[] = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const snap of toPull) {
    const filePath = join(snapshotsDir, `${snap.id}.saf.enc`);
    
    if (existsSync(filePath) && !options.force) {
      if (!options.json) {
        console.log(chalk.dim(`  ⏭ ${snap.id.slice(0, 8)} — already exists locally`));
      }
      snapshots.push({ id: snap.id, downloaded: false, skipped: true });
      skipped++;
      continue;
    }

    const dlSpinner = options.json
      ? null
      : ora(`  Downloading ${snap.id.slice(0, 8)}...`).start();

    try {
      const data = await downloadFromCloud(snap.id);
      if (!data) {
        dlSpinner?.fail(`  ${snap.id.slice(0, 8)} — download failed`);
        snapshots.push({ id: snap.id, downloaded: false, skipped: false });
        failed++;
        continue;
      }

      const fileStream = createWriteStream(filePath);
      fileStream.write(data);
      fileStream.end();

      dlSpinner?.succeed(`  ${snap.id.slice(0, 8)} — downloaded`);
      snapshots.push({ id: snap.id, downloaded: true, skipped: false });
      success++;
    } catch (err) {
      dlSpinner?.fail(`  ${snap.id.slice(0, 8)} — ${err instanceof Error ? err.message : 'failed'}`);
      snapshots.push({ id: snap.id, downloaded: false, skipped: false });
      failed++;
    }
  }

  if (options.json) {
    console.log(formatCloudPullJson({
      pulled: success,
      failed,
      skipped,
      all: Boolean(options.all),
      snapshots,
    }));
    return;
  }

  console.log();
  console.log(chalk.green(`✓ Pulled ${success} snapshot(s) from cloud`));
}

/**
 * List cloud snapshots
 */
export async function cloudListCommand(options: CloudOptions = {}): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatCloudListMissingJson());
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  const spinner = options.json ? null : ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner?.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    process.exit(1);
  }

  if (spinner) {
    spinner.text = 'Fetching cloud snapshots...';
  }
  const snapshots = await listCloudSnapshots();
  spinner?.stop();

  if (options.json) {
    console.log(
      formatCloudListJson({
        tier: sub.tier ?? 'unknown',
        cloudStorageUsed: sub.cloudStorageUsed ?? 0,
        cloudStorageLimit: sub.cloudStorageLimit ?? 0,
        snapshots,
      }),
    );
    return;
  }

  console.log(chalk.blue(`Cloud Storage (${sub.tier})`));
  
  if (sub.cloudStorageLimit) {
    const usedMB = Math.round((sub.cloudStorageUsed || 0) / 1024 / 1024);
    const limitMB = Math.round(sub.cloudStorageLimit / 1024 / 1024);
    const pct = Math.round((sub.cloudStorageUsed || 0) / sub.cloudStorageLimit * 100);
    console.log(chalk.dim(`  Usage: ${usedMB} MB / ${limitMB} MB (${pct}%)`));
  }
  console.log();

  if (snapshots.length === 0) {
    console.log(chalk.yellow('  No snapshots in cloud.'));
    console.log(chalk.dim('  Run `savestate cloud push` to upload.'));
    return;
  }

  console.log(chalk.dim('  ID         Size       Date'));
  console.log(chalk.dim('  ─────────  ─────────  ──────────────────'));
  
  for (const snap of snapshots) {
    const sizeKB = Math.round(snap.size / 1024);
    const date = new Date(snap.createdAt).toLocaleDateString();
    console.log(`  ${snap.id.slice(0, 8)}   ${String(sizeKB).padStart(6)} KB   ${date}`);
  }
  
  console.log();
  console.log(chalk.dim(`  ${snapshots.length} snapshot(s) in cloud`));
}

/**
 * Delete cloud snapshots
 */
export async function cloudDeleteCommand(options: CloudOptions): Promise<void> {
  if (!options.json) {
    console.log();
  }

  if (!isInitialized()) {
    if (options.json) {
      console.log(formatCloudDeleteMissingJson(options.id ?? ''));
      return;
    }
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  if (!options.id && !options.all) {
    console.log(chalk.red('✗ Specify --id <snapshot> or --all to delete'));
    process.exit(1);
  }

  // Verify subscription
  const spinner = options.json ? null : ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner?.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    process.exit(1);
  }

  if (spinner) {
    spinner.text = 'Fetching cloud snapshots...';
  }
  const cloudSnapshots = await listCloudSnapshots();
  spinner?.stop();

  if (cloudSnapshots.length === 0) {
    if (options.json) {
      if (options.id) {
        console.log(formatCloudDeleteMissingJson(options.id));
        return;
      }
      console.log(formatCloudDeleteJson({ deleted: 0, failed: 0, all: Boolean(options.all), snapshots: [] }));
      return;
    }
    console.log(chalk.yellow('No snapshots in cloud storage.'));
    process.exit(0);
  }

  // Filter
  let toDelete = cloudSnapshots;
  if (options.id) {
    toDelete = cloudSnapshots.filter(s => s.id === options.id || s.id.startsWith(options.id!));
    if (toDelete.length === 0) {
      if (options.json) {
        console.log(formatCloudDeleteMissingJson(options.id));
        return;
      }
      console.log(chalk.red(`Snapshot not found in cloud: ${options.id}`));
      process.exit(1);
    }
  }

  // Confirm deletion (JSON mode is non-interactive)
  if (!options.force && !options.json) {
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.yellow(`  Delete ${toDelete.length} snapshot(s) from cloud? [y/N] `), (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });

    if (answer !== 'y' && answer !== 'yes') {
      console.log(chalk.dim('  Cancelled.'));
      process.exit(0);
    }
  }

  if (!options.json) {
    console.log();
    console.log(chalk.blue(`Deleting ${toDelete.length} snapshot(s)...`));
    console.log();
  }

  const snapshots: CloudDeleteSnapshotJson[] = [];
  let success = 0;
  let failed = 0;
  for (const snap of toDelete) {
    const delSpinner = options.json
      ? null
      : ora(`  Deleting ${snap.id.slice(0, 8)}...`).start();
    const ok = await deleteFromCloud(snap.id);
    if (ok) {
      delSpinner?.succeed(`  ${snap.id.slice(0, 8)} — deleted`);
      snapshots.push({ id: snap.id, deleted: true });
      success++;
    } else {
      delSpinner?.fail(`  ${snap.id.slice(0, 8)} — failed`);
      snapshots.push({ id: snap.id, deleted: false });
      failed++;
    }
  }

  if (options.json) {
    console.log(formatCloudDeleteJson({
      deleted: success,
      failed,
      all: Boolean(options.all),
      snapshots,
    }));
    return;
  }

  console.log();
  console.log(chalk.green(`✓ Deleted ${success} snapshot(s) from cloud`));
}

/**
 * Main cloud command handler
 */
export async function cloudCommand(subcommand: string, options: CloudOptions): Promise<void> {
  switch (subcommand) {
    case 'push':
      await cloudPushCommand(options);
      break;
    case 'pull':
      await cloudPullCommand(options);
      break;
    case 'list':
      await cloudListCommand(options);
      break;
    case 'delete':
      await cloudDeleteCommand(options);
      break;
    default:
      console.log(chalk.red(`Unknown cloud command: ${subcommand}`));
      console.log();
      console.log('Usage:');
      console.log('  savestate cloud push [--id <id>] [--all]   Push snapshots to cloud');
      console.log('  savestate cloud pull [--id <id>] [--all]   Pull snapshots from cloud');
      console.log('  savestate cloud list                       List cloud snapshots');
      console.log('  savestate cloud delete --id <id> [--force] Delete cloud snapshot');
      console.log('  savestate cloud delete --all [--force]     Delete all cloud snapshots');
      process.exit(1);
  }
}
