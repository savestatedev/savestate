/**
 * savestate cloud — Cloud storage commands (Pro/Team)
 *
 * Manages cloud backups through the SaveState API.
 * Requires Pro or Team subscription.
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, createReadStream, createWriteStream, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isInitialized, loadConfig, localConfigDir } from '../config.js';
import { loadIndex } from '../index-file.js';

/** Get the snapshots directory */
function getSnapshotsDir(): string {
  return join(localConfigDir(), 'snapshots');
}

const API_BASE = process.env.SAVESTATE_API_URL || 'https://savestate.dev/api';

interface CloudOptions {
  id?: string;
  all?: boolean;
  force?: boolean;
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
    const cloudStorageUsed = data.cloudStorageUsed as number || 0;
    const cloudStorageLimit = data.cloudStorageLimit as number || 0;

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
 * Get presigned upload URL from API
 */
async function getUploadUrl(snapshotId: string, size: number): Promise<{ url: string; fields?: Record<string, string> } | null> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const res = await fetch(`${API_BASE}/storage/upload-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshotId, size }),
    });

    if (!res.ok) return null;
    return await res.json() as { url: string; fields?: Record<string, string> };
  } catch {
    return null;
  }
}

/**
 * Get presigned download URL from API
 */
async function getDownloadUrl(snapshotId: string): Promise<string | null> {
  const config = await loadConfig();
  const extConfig = config as unknown as Record<string, unknown>;
  const apiKey = extConfig.apiKey as string | undefined;

  try {
    const res = await fetch(`${API_BASE}/storage/download-url?id=${snapshotId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return null;
    const data = await res.json() as { url: string };
    return data.url;
  } catch {
    return null;
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
    const res = await fetch(`${API_BASE}/storage/list`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) return [];
    const data = await res.json() as { snapshots: Array<{ id: string; size: number; createdAt: string }> };
    return data.snapshots || [];
  } catch {
    return [];
  }
}

/**
 * Push local snapshots to cloud
 */
export async function cloudPushCommand(options: CloudOptions): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Verify subscription
  const spinner = ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    if (sub.tier === 'free') {
      console.log();
      console.log(chalk.dim('  Upgrade at: https://savestate.dev/#pricing'));
    }
    process.exit(1);
  }

  spinner.succeed(`Subscription verified (${sub.tier})`);

  // Show storage usage
  if (sub.cloudStorageLimit) {
    const usedMB = Math.round((sub.cloudStorageUsed || 0) / 1024 / 1024);
    const limitMB = Math.round(sub.cloudStorageLimit / 1024 / 1024);
    console.log(chalk.dim(`  Cloud storage: ${usedMB} MB / ${limitMB} MB`));
  }
  console.log();

  // Get local snapshots
  const index = await loadIndex();
  const entries = index.snapshots || [];

  if (entries.length === 0) {
    console.log(chalk.yellow('No local snapshots to push.'));
    console.log(chalk.dim('  Run `savestate snapshot` to create one.'));
    process.exit(0);
  }

  // Filter to specific snapshot or all
  let toPush = entries;
  if (options.id) {
    toPush = entries.filter(e => e.id === options.id || e.id.startsWith(options.id!));
    if (toPush.length === 0) {
      console.log(chalk.red(`Snapshot not found: ${options.id}`));
      process.exit(1);
    }
  } else if (!options.all) {
    // Default: push latest only
    toPush = [entries[entries.length - 1]];
  }

  console.log(chalk.blue(`Pushing ${toPush.length} snapshot(s) to cloud...`));
  console.log();

  const snapshotsDir = getSnapshotsDir();
  let success = 0;
  let failed = 0;

  for (const entry of toPush) {
    const filePath = join(snapshotsDir, `${entry.id}.saf.enc`);
    
    if (!existsSync(filePath)) {
      console.log(chalk.yellow(`  ⚠ ${entry.id.slice(0, 8)} — file not found, skipping`));
      failed++;
      continue;
    }

    const stat = statSync(filePath);
    const uploadSpinner = ora(`  Uploading ${entry.id.slice(0, 8)}... (${Math.round(stat.size / 1024)} KB)`).start();

    try {
      const uploadInfo = await getUploadUrl(entry.id, stat.size);
      if (!uploadInfo) {
        uploadSpinner.fail(`  ${entry.id.slice(0, 8)} — failed to get upload URL`);
        failed++;
        continue;
      }

      // Upload the file
      const fileBuffer = readFileSync(filePath);
      const uploadRes = await fetch(uploadInfo.url, {
        method: 'PUT',
        body: fileBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      if (!uploadRes.ok) {
        uploadSpinner.fail(`  ${entry.id.slice(0, 8)} — upload failed (${uploadRes.status})`);
        failed++;
        continue;
      }

      uploadSpinner.succeed(`  ${entry.id.slice(0, 8)} — uploaded`);
      success++;
    } catch (err) {
      uploadSpinner.fail(`  ${entry.id.slice(0, 8)} — ${err instanceof Error ? err.message : 'failed'}`);
      failed++;
    }
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
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  // Verify subscription
  const spinner = ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    process.exit(1);
  }

  spinner.succeed(`Subscription verified (${sub.tier})`);
  console.log();

  // Get cloud snapshots
  const listSpinner = ora('Fetching cloud snapshots...').start();
  const cloudSnapshots = await listCloudSnapshots();
  listSpinner.stop();

  if (cloudSnapshots.length === 0) {
    console.log(chalk.yellow('No snapshots in cloud storage.'));
    console.log(chalk.dim('  Run `savestate cloud push` to upload snapshots.'));
    process.exit(0);
  }

  // Filter
  let toPull = cloudSnapshots;
  if (options.id) {
    toPull = cloudSnapshots.filter(s => s.id === options.id || s.id.startsWith(options.id!));
    if (toPull.length === 0) {
      console.log(chalk.red(`Snapshot not found in cloud: ${options.id}`));
      process.exit(1);
    }
  } else if (!options.all) {
    toPull = [cloudSnapshots[cloudSnapshots.length - 1]];
  }

  console.log(chalk.blue(`Pulling ${toPull.length} snapshot(s) from cloud...`));
  console.log();

  const snapshotsDir = getSnapshotsDir();
  let success = 0;

  for (const snap of toPull) {
    const filePath = join(snapshotsDir, `${snap.id}.saf.enc`);
    
    if (existsSync(filePath) && !options.force) {
      console.log(chalk.dim(`  ⏭ ${snap.id.slice(0, 8)} — already exists locally`));
      continue;
    }

    const dlSpinner = ora(`  Downloading ${snap.id.slice(0, 8)}...`).start();

    try {
      const url = await getDownloadUrl(snap.id);
      if (!url) {
        dlSpinner.fail(`  ${snap.id.slice(0, 8)} — failed to get download URL`);
        continue;
      }

      const res = await fetch(url);
      if (!res.ok || !res.body) {
        dlSpinner.fail(`  ${snap.id.slice(0, 8)} — download failed`);
        continue;
      }

      const fileStream = createWriteStream(filePath);
      await pipeline(res.body as unknown as NodeJS.ReadableStream, fileStream);

      dlSpinner.succeed(`  ${snap.id.slice(0, 8)} — downloaded`);
      success++;
    } catch (err) {
      dlSpinner.fail(`  ${snap.id.slice(0, 8)} — ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  console.log();
  console.log(chalk.green(`✓ Pulled ${success} snapshot(s) from cloud`));
}

/**
 * List cloud snapshots
 */
export async function cloudListCommand(): Promise<void> {
  console.log();

  // Verify subscription
  const spinner = ora('Verifying subscription...').start();
  const sub = await verifySubscription();

  if (!sub.valid) {
    spinner.fail('Subscription required');
    console.log();
    console.log(chalk.red(`  ${sub.error}`));
    process.exit(1);
  }

  spinner.text = 'Fetching cloud snapshots...';
  const snapshots = await listCloudSnapshots();
  spinner.stop();

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
      await cloudListCommand();
      break;
    default:
      console.log(chalk.red(`Unknown cloud command: ${subcommand}`));
      console.log();
      console.log('Usage:');
      console.log('  savestate cloud push [--id <id>] [--all]   Push snapshots to cloud');
      console.log('  savestate cloud pull [--id <id>] [--all]   Pull snapshots from cloud');
      console.log('  savestate cloud list                       List cloud snapshots');
      process.exit(1);
  }
}
