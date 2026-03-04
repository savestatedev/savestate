/**
 * savestate diff <a> <b> — Compare two snapshots (Issue #92)
 *
 * Generates semantic diffs for agent identity and state events.
 */

import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, loadConfig } from '../config.js';
import { resolveStorage } from '../storage/resolve.js';
import { getPassphrase } from '../passphrase.js';
import { findEntry } from '../index-file.js';
import { decrypt } from '../encryption.js';
import { unpackFromArchive, unpackSnapshot, snapshotFilename } from '../format.js';
import { isIncremental, reconstructFromChain } from '../incremental.js';
import { loadIdentityFromArchive } from '../identity/store.js';
import { diffIdentity, formatIdentityDiff } from '../diff/semantic.js';
import { diffStateEvents, formatStateEventDiff } from '../diff/state-events.js';
import type { Snapshot } from '../types.js';
import type { AgentIdentity } from '../identity/schema.js';

interface DiffOptions {
  json?: boolean;
}

export async function diffCommand(
  snapshotA: string,
  snapshotB: string,
  options?: DiffOptions,
): Promise<void> {
  console.log();

  if (!isInitialized()) {
    console.log(chalk.red('✗ SaveState not initialized. Run `savestate init` first.'));
    process.exit(1);
  }

  console.log(chalk.bold('Comparing snapshots'));
  console.log(`   ${chalk.cyan(snapshotA)} ↔ ${chalk.cyan(snapshotB)}`);
  console.log();

  const spinner = ora('Loading and decrypting snapshots...').start();

  try {
    const config = await loadConfig();
    const storage = resolveStorage(config);
    const passphrase = await getPassphrase();

    // Load both snapshots
    spinner.text = `Loading snapshot ${snapshotA}...`;
    const { snapshot: snapA, identity: identityA } = await loadSnapshotWithIdentity(
      snapshotA,
      storage,
      passphrase,
    );

    spinner.text = `Loading snapshot ${snapshotB}...`;
    const { snapshot: snapB, identity: identityB } = await loadSnapshotWithIdentity(
      snapshotB,
      storage,
      passphrase,
    );

    spinner.text = 'Computing semantic diff...';

    // Compute diffs
    const identityDiff = diffIdentity(identityA, identityB);
    const stateDiff = diffStateEvents(snapA, snapB);

    spinner.succeed('Diff complete');
    console.log();

    if (options?.json) {
      // JSON output mode
      console.log(
        JSON.stringify(
          {
            snapshotA: snapshotA,
            snapshotB: snapshotB,
            identity: {
              hasChanges: identityDiff.hasChanges,
              changes: identityDiff.changes,
              summary: identityDiff.summary,
              versionChange: identityDiff.versionChange,
            },
            state: {
              hasChanges: stateDiff.hasChanges,
              byType: Object.fromEntries(stateDiff.byType),
              summary: stateDiff.summary,
              memoryTierChanges: stateDiff.memoryTierChanges,
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    // Human-readable output

    // Identity diff section
    if (identityDiff.hasChanges) {
      console.log(chalk.bold.cyan('Agent Identity Changes:'));
      if (identityDiff.versionChange) {
        console.log(
          chalk.dim('  Version:') +
            ` ${identityDiff.versionChange.before || '(none)'} → ${identityDiff.versionChange.after || '(none)'}`,
        );
      }
      for (const change of identityDiff.changes) {
        const symbol = getChangeSymbol(change.type);
        const color = getChangeColor(change.type);
        console.log(color(`  ${symbol} ${formatChangeDescription(change)}`));
      }
      console.log();
    } else {
      console.log(chalk.dim('  No identity changes.'));
      console.log();
    }

    // State events diff section
    if (stateDiff.hasChanges) {
      console.log(chalk.bold.cyan('State Changes:'));

      // Display by type in a specific order
      const typeOrder = [
        'decision',
        'preference',
        'error',
        'api_response',
        'memory',
        'conversation',
        'knowledge',
      ] as const;

      const typeLabels: Record<string, string> = {
        decision: 'Decisions',
        preference: 'Preferences',
        error: 'Errors',
        api_response: 'API Responses',
        memory: 'Memories',
        conversation: 'Conversations',
        knowledge: 'Knowledge',
      };

      for (const type of typeOrder) {
        const changes = stateDiff.byType.get(type);
        if (!changes || changes.length === 0) continue;

        const added = changes.filter((c) => c.operation === 'added').length;
        const removed = changes.filter((c) => c.operation === 'removed').length;
        const modified = changes.filter((c) => c.operation === 'modified').length;

        const counts: string[] = [];
        if (added > 0) counts.push(chalk.green(`${added} new`));
        if (removed > 0) counts.push(chalk.red(`${removed} removed`));
        if (modified > 0) counts.push(chalk.yellow(`${modified} modified`));

        console.log(`  ${chalk.bold(typeLabels[type])} (${counts.join(', ')}):`);

        // Show up to 5 examples per type
        const examples = changes.slice(0, 5);
        for (const change of examples) {
          const symbol = getChangeSymbol(change.operation);
          const color = getChangeColor(change.operation);
          console.log(color(`    ${symbol} ${formatStateDescription(change)}`));
        }

        if (changes.length > 5) {
          console.log(chalk.dim(`    ... and ${changes.length - 5} more`));
        }
      }

      // Show memory tier changes if any
      if (stateDiff.memoryTierChanges) {
        const tc = stateDiff.memoryTierChanges;
        const tierChanges: string[] = [];
        if (tc.promoted > 0) tierChanges.push(`${tc.promoted} promoted`);
        if (tc.demoted > 0) tierChanges.push(`${tc.demoted} demoted`);
        if (tc.pinned > 0) tierChanges.push(`${tc.pinned} pinned`);
        if (tc.unpinned > 0) tierChanges.push(`${tc.unpinned} unpinned`);

        if (tierChanges.length > 0) {
          console.log();
          console.log(chalk.dim(`  Memory Tiers: ${tierChanges.join(', ')}`));
        }
      }

      console.log();
    } else {
      console.log(chalk.dim('  No state changes.'));
      console.log();
    }

    // Summary
    const totalAdded = identityDiff.summary.added + stateDiff.summary.added;
    const totalRemoved = identityDiff.summary.removed + stateDiff.summary.removed;
    const totalModified = identityDiff.summary.modified + stateDiff.summary.modified;

    console.log(
      chalk.bold('Summary:') +
        ` ${chalk.green(`+${totalAdded}`)} added, ` +
        `${chalk.red(`-${totalRemoved}`)} removed, ` +
        `${chalk.yellow(`~${totalModified}`)} modified`,
    );
    console.log();
  } catch (err) {
    spinner.fail('Diff failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

/**
 * Load a snapshot and extract its identity document.
 */
async function loadSnapshotWithIdentity(
  snapshotId: string,
  storage: { get: (key: string) => Promise<Buffer> },
  passphrase: string,
): Promise<{ snapshot: Snapshot; identity?: AgentIdentity }> {
  // Resolve snapshot ID to filename
  const entry = await findEntry(snapshotId);
  const filename = entry?.filename ?? snapshotFilename(snapshotId);

  // Retrieve from storage
  let encrypted: Buffer;
  try {
    encrypted = await storage.get(filename);
  } catch {
    throw new Error(`Snapshot not found in storage: ${snapshotId}`);
  }

  // Decrypt
  let archive: Buffer;
  try {
    archive = await decrypt(encrypted, passphrase);
  } catch (err) {
    if (err instanceof Error && err.message.includes('GCM')) {
      throw new Error('Wrong passphrase or corrupted archive.');
    }
    throw err;
  }

  // Unpack
  let fileMap = await unpackFromArchive(archive);

  // If incremental, reconstruct full state from chain
  if (isIncremental(fileMap)) {
    fileMap = await reconstructFromChain(snapshotId, storage as any, passphrase);
  }

  const snapshot = unpackSnapshot(fileMap);
  const identity = loadIdentityFromArchive(fileMap);

  return { snapshot, identity };
}

/**
 * Get the symbol for a change type.
 */
function getChangeSymbol(type: string): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
    default:
      return '?';
  }
}

/**
 * Get the chalk color for a change type.
 */
function getChangeColor(type: string): (text: string) => string {
  switch (type) {
    case 'added':
      return chalk.green;
    case 'removed':
      return chalk.red;
    case 'modified':
      return chalk.yellow;
    default:
      return chalk.white;
  }
}

/**
 * Format an identity change for display.
 */
function formatChangeDescription(change: { field: string; before?: unknown; after?: unknown; type: string }): string {
  const truncate = (val: unknown, max = 40): string => {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    if (str.length <= max) return str;
    return str.slice(0, max - 3) + '...';
  };

  if (change.type === 'added') {
    return `${change.field}: "${truncate(change.after)}"`;
  } else if (change.type === 'removed') {
    return `${change.field}: "${truncate(change.before)}"`;
  } else {
    return `${change.field}: "${truncate(change.before)}" → "${truncate(change.after)}"`;
  }
}

/**
 * Format a state event change for display.
 */
function formatStateDescription(change: { description: string }): string {
  // Remove leading +/- symbols if present (we add our own)
  return change.description.replace(/^[+\-~]\s*/, '');
}
