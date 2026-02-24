/**
 * SaveState Archive Format (SAF)
 *
 * Packing: JSON + files → tar.gz → encrypt → .saf.enc
 * Unpacking: .saf.enc → decrypt → tar.gz → extract
 */

import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Header, Parser } from 'tar';
import type { Snapshot } from './types.js';
import { TRACE_SCHEMA_VERSION, type SnapshotTrace, type TraceRunIndexEntry } from './trace/types.js';

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
  if (snapshot.identity.skills?.length) {
    files.set('identity/skills.json', Buffer.from(JSON.stringify(snapshot.identity.skills, null, 2)));
  }
  if (snapshot.identity.scripts?.length) {
    files.set('identity/scripts.json', Buffer.from(JSON.stringify(snapshot.identity.scripts, null, 2)));
  }
  if (snapshot.identity.extensions?.length) {
    files.set('identity/extensions.json', Buffer.from(JSON.stringify(snapshot.identity.extensions, null, 2)));
  }
  if (snapshot.identity.fileManifest?.length) {
    files.set('identity/file-manifest.json', Buffer.from(JSON.stringify(snapshot.identity.fileManifest, null, 2)));
  }
  if (snapshot.identity.projectMeta && Object.keys(snapshot.identity.projectMeta).length > 0) {
    files.set('identity/project-meta.json', Buffer.from(JSON.stringify(snapshot.identity.projectMeta, null, 2)));
  }

  // memory/
  files.set('memory/core.json', Buffer.from(JSON.stringify(snapshot.memory.core, null, 2)));
  if (snapshot.memory.knowledge.length > 0) {
    files.set('memory/knowledge/index.json', Buffer.from(JSON.stringify(snapshot.memory.knowledge, null, 2)));
  }
  if (snapshot.memory.tierConfig) {
    files.set('memory/tier-config.json', Buffer.from(JSON.stringify(snapshot.memory.tierConfig, null, 2)));
  }

  // conversations/
  files.set('conversations/index.json', Buffer.from(JSON.stringify(snapshot.conversations, null, 2)));

  // meta/
  files.set('meta/platform.json', Buffer.from(JSON.stringify(snapshot.platform, null, 2)));
  files.set('meta/snapshot-chain.json', Buffer.from(JSON.stringify(snapshot.chain, null, 2)));
  files.set('meta/restore-hints.json', Buffer.from(JSON.stringify(snapshot.restoreHints, null, 2)));

  // trace/
  if (snapshot.trace) {
    const trace = snapshot.trace;
    const traceIndex = {
      schema_version: trace.schema_version ?? TRACE_SCHEMA_VERSION,
      runs: trace.index,
    };
    files.set('trace/index.json', Buffer.from(JSON.stringify(traceIndex, null, 2)));

    const indexedRunIds = new Set<string>();
    for (const run of trace.index) {
      indexedRunIds.add(run.run_id);
      const runJsonl = trace.runs[run.run_id];
      if (runJsonl === undefined) {
        continue;
      }
      const sanitizedFile = sanitizeTraceFilename(run.file);
      files.set(`trace/runs/${sanitizedFile}`, Buffer.from(normalizeJsonl(runJsonl)));
    }

    for (const [runId, runJsonl] of Object.entries(trace.runs)) {
      if (indexedRunIds.has(runId)) {
        continue;
      }
      const fallbackFile = makeTraceRunFilename(runId);
      files.set(`trace/runs/${fallbackFile}`, Buffer.from(normalizeJsonl(runJsonl)));
    }
  }

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
    skills: files.has('identity/skills.json')
      ? getJson<Snapshot['identity']['skills']>('identity/skills.json')
      : undefined,
    scripts: files.has('identity/scripts.json')
      ? getJson<Snapshot['identity']['scripts']>('identity/scripts.json')
      : undefined,
    extensions: files.has('identity/extensions.json')
      ? getJson<Snapshot['identity']['extensions']>('identity/extensions.json')
      : undefined,
    fileManifest: files.has('identity/file-manifest.json')
      ? getJson<Snapshot['identity']['fileManifest']>('identity/file-manifest.json')
      : undefined,
    projectMeta: files.has('identity/project-meta.json')
      ? getJson<Record<string, string>>('identity/project-meta.json')
      : undefined,
  };

  const memory: Snapshot['memory'] = {
    core: getJson<Snapshot['memory']['core']>('memory/core.json'),
    knowledge: files.has('memory/knowledge/index.json')
      ? getJson<Snapshot['memory']['knowledge']>('memory/knowledge/index.json')
      : [],
    tierConfig: files.has('memory/tier-config.json')
      ? getJson<Snapshot['memory']['tierConfig']>('memory/tier-config.json')
      : undefined,
  };

  const conversations = getJson<Snapshot['conversations']>('conversations/index.json');
  const platform = getJson<Snapshot['platform']>('meta/platform.json');
  const chain = getJson<Snapshot['chain']>('meta/snapshot-chain.json');
  const restoreHints = getJson<Snapshot['restoreHints']>('meta/restore-hints.json');
  const trace = unpackTrace(files);

  return { manifest, identity, memory, conversations, platform, chain, restoreHints, trace };
}

function unpackTrace(files: Map<string, Buffer>): SnapshotTrace | undefined {
  if (!files.has('trace/index.json')) {
    return undefined;
  }

  const rawIndex = JSON.parse(files.get('trace/index.json')!.toString('utf-8')) as {
    schema_version?: number;
    runs?: TraceRunIndexEntry[];
  };
  const index = rawIndex.runs ?? [];
  const runs: Record<string, string> = {};

  for (const run of index) {
    const sanitizedFile = sanitizeTraceFilename(run.file);
    const runPath = `trace/runs/${sanitizedFile}`;
    const buf = files.get(runPath);
    if (!buf) {
      continue;
    }
    runs[run.run_id] = buf.toString('utf-8');
  }

  return {
    schema_version: rawIndex.schema_version ?? TRACE_SCHEMA_VERSION,
    index,
    runs,
  };
}

function makeTraceRunFilename(runId: string): string {
  return `run-${encodeURIComponent(runId)}.jsonl`;
}

function sanitizeTraceFilename(file: string): string {
  const sanitized = basename(file);
  if (sanitized !== file || file.includes('..')) {
    throw new Error(`Invalid trace filename: ${file}`);
  }
  return sanitized;
}

function normalizeJsonl(content: string): string {
  const trimmed = content.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n` : '';
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
