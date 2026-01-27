/**
 * SaveState Archive Format (SAF)
 *
 * Packing: JSON + files → tar.gz → encrypt → .saf.enc
 * Unpacking: .saf.enc → decrypt → tar.gz → extract
 */

import { createHash } from 'node:crypto';
import type { Snapshot } from './types.js';

/** File extension for encrypted SaveState archives */
export const SAF_EXTENSION = '.saf.enc';

/** Current SAF format version */
export const SAF_VERSION = '0.1.0';

/**
 * Build the directory structure for a snapshot, ready to be tarred.
 * Returns a map of relative paths → content buffers.
 */
export function packSnapshot(snapshot: Snapshot): Map<string, Buffer> {
  const files = new Map<string, Buffer>();

  // manifest.json
  files.set('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));

  // identity/
  if (snapshot.identity.personality) {
    files.set('identity/personality.md', Buffer.from(snapshot.identity.personality));
  }
  if (snapshot.identity.config) {
    files.set('identity/config.json', Buffer.from(JSON.stringify(snapshot.identity.config, null, 2)));
  }
  if (snapshot.identity.tools?.length) {
    files.set('identity/tools.json', Buffer.from(JSON.stringify(snapshot.identity.tools, null, 2)));
  }

  // memory/
  files.set('memory/core.json', Buffer.from(JSON.stringify(snapshot.memory.core, null, 2)));
  if (snapshot.memory.knowledge.length > 0) {
    files.set('memory/knowledge/index.json', Buffer.from(JSON.stringify(snapshot.memory.knowledge, null, 2)));
  }

  // conversations/
  files.set('conversations/index.json', Buffer.from(JSON.stringify(snapshot.conversations, null, 2)));

  // meta/
  files.set('meta/platform.json', Buffer.from(JSON.stringify(snapshot.platform, null, 2)));
  files.set('meta/snapshot-chain.json', Buffer.from(JSON.stringify(snapshot.chain, null, 2)));
  files.set('meta/restore-hints.json', Buffer.from(JSON.stringify(snapshot.restoreHints, null, 2)));

  return files;
}

/**
 * Unpack a snapshot from extracted archive files.
 */
export function unpackSnapshot(files: Map<string, Buffer>): Snapshot {
  const getJson = <T>(path: string): T => {
    const buf = files.get(path);
    if (!buf) throw new Error(`Missing required file in archive: ${path}`);
    return JSON.parse(buf.toString('utf-8')) as T;
  };

  const getText = (path: string): string | undefined => {
    const buf = files.get(path);
    return buf ? buf.toString('utf-8') : undefined;
  };

  const manifest = getJson<Snapshot['manifest']>('manifest.json');
  const identity: Snapshot['identity'] = {
    personality: getText('identity/personality.md'),
    config: files.has('identity/config.json')
      ? getJson<Record<string, unknown>>('identity/config.json')
      : undefined,
    tools: files.has('identity/tools.json')
      ? getJson<Snapshot['identity']['tools']>('identity/tools.json')
      : undefined,
  };

  const memory: Snapshot['memory'] = {
    core: getJson<Snapshot['memory']['core']>('memory/core.json'),
    knowledge: files.has('memory/knowledge/index.json')
      ? getJson<Snapshot['memory']['knowledge']>('memory/knowledge/index.json')
      : [],
  };

  const conversations = getJson<Snapshot['conversations']>('conversations/index.json');
  const platform = getJson<Snapshot['platform']>('meta/platform.json');
  const chain = getJson<Snapshot['chain']>('meta/snapshot-chain.json');
  const restoreHints = getJson<Snapshot['restoreHints']>('meta/restore-hints.json');

  return { manifest, identity, memory, conversations, platform, chain, restoreHints };
}

/**
 * Compute SHA-256 checksum of a buffer.
 */
export function computeChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a snapshot ID from timestamp + random suffix.
 */
export function generateSnapshotId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ss-${ts}-${rand}`;
}

/**
 * Generate a filename for a snapshot archive.
 */
export function snapshotFilename(id: string): string {
  return `${id}${SAF_EXTENSION}`;
}
