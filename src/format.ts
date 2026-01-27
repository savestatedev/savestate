/**
 * SaveState Archive Format (SAF)
 *
 * Packing: JSON + files → tar.gz → encrypt → .saf.enc
 * Unpacking: .saf.enc → decrypt → tar.gz → extract
 */

import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Header, Parser } from 'tar';
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

/**
 * Build a raw tar archive from in-memory files.
 * Uses tar's Header class for proper POSIX-compliant headers.
 */
function buildTar(files: Map<string, Buffer>): Buffer {
  const blocks: Buffer[] = [];

  for (const [path, data] of files) {
    const headerBuf = Buffer.alloc(512);
    const h = new Header();
    h.path = path;
    h.size = data.length;
    h.type = 'File';
    h.mode = 0o644;
    h.mtime = new Date();
    h.uid = 0;
    h.gid = 0;
    h.uname = 'savestate';
    h.gname = 'savestate';
    h.encode(headerBuf, 0);

    blocks.push(headerBuf);
    blocks.push(data);

    // Pad data to 512-byte boundary
    const remainder = data.length % 512;
    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder));
    }
  }

  // End-of-archive marker: two 512-byte zero blocks
  blocks.push(Buffer.alloc(1024));

  return Buffer.concat(blocks);
}

/**
 * Pack a file map into a tar.gz buffer.
 *
 * Creates an in-memory tar archive, gzips it, and returns the buffer.
 * Each entry in the map is a relative path → content buffer.
 */
export function packToArchive(files: Map<string, Buffer>): Buffer {
  const tar = buildTar(files);
  return gzipSync(tar);
}

/**
 * Unpack a tar.gz buffer into a file map.
 *
 * Decompresses and extracts all files from the archive,
 * returning their paths and content buffers.
 */
export async function unpackFromArchive(archive: Buffer): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const tar = gunzipSync(archive);

  const parser = new Parser({
    onReadEntry: (entry) => {
      const chunks: Buffer[] = [];
      entry.on('data', (chunk: Buffer) => chunks.push(chunk));
      entry.on('end', () => {
        if (entry.type === 'File') {
          files.set(entry.path, Buffer.concat(chunks));
        }
      });
    },
  });

  const source = Readable.from(tar);
  await pipeline(source, parser);

  return files;
}
