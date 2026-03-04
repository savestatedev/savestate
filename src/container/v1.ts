import { createHash } from 'node:crypto';

/**
 * SaveState Container v1
 *
 * A deterministic single-file container for SaveState payloads.
 *
 * NOTE: This file format is intentionally *not* coupled to any particular
 * adapter/platform payload schema; it only defines how bytes are packaged.
 */

export const SSC_V1_MAGIC = Buffer.from('SSCNTRv1', 'ascii'); // 8 bytes
export const SSC_V1_MAJOR = 1;
export const SSC_V1_MINOR = 0;

export type ContainerV1PayloadManifestEntry = {
  /** Stable, human-readable identifier (e.g. "identity/personality.md"). */
  name: string;
  /** MIME-ish content type (e.g. "application/json", "text/markdown"). */
  contentType: string;
  /** Number of bytes in the payload blob. */
  byteLength: number;
  /** Lowercase hex SHA-256 of the payload blob. */
  sha256: string;
  /** Byte offset from start of file where the payload blob begins. */
  offset: number;
  /** Optional payload schema/version string (implementation-defined). */
  schemaVersion?: string;
};

export type ContainerV1Manifest = {
  /** Container format semantic version. Major bumps are breaking. */
  formatVersion: '1.0.0';
  createdAt?: string;
  payloads: ContainerV1PayloadManifestEntry[];
  /** Free-form metadata; must be ignored by readers. */
  meta?: Record<string, unknown>;
};

export type ContainerV1File = {
  manifest: ContainerV1Manifest;
  payloads: Record<string, Buffer>;
};

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function sha256Raw(buf: Buffer): Buffer {
  return createHash('sha256').update(buf).digest();
}

/**
 * Encode a v1 container.
 */
export function encodeContainerV1(input: Omit<ContainerV1File, 'manifest'> & {
  manifest?: Omit<ContainerV1Manifest, 'formatVersion' | 'payloads'>;
}): Buffer {
  const payloadEntries: Array<{ name: string; contentType: string; data: Buffer; schemaVersion?: string }> = [];

  for (const [name, data] of Object.entries(input.payloads)) {
    // Caller may provide content type in meta; default based on extension.
    const lower = name.toLowerCase();
    const contentType =
      lower.endsWith('.json')
        ? 'application/json'
        : lower.endsWith('.md') || lower.endsWith('.markdown')
          ? 'text/markdown'
          : 'application/octet-stream';

    payloadEntries.push({ name, contentType, data });
  }

  // Stable ordering for deterministic output
  payloadEntries.sort((a, b) => a.name.localeCompare(b.name));

  const headerSize = 8 + 2 + 2 + 4 + 32; // magic + major + minor + manifestLen + manifestSha256

  // First pass: compute payload offsets assuming manifest size; we'll fill after manifest is built.
  let payloadStartOffset = headerSize; // + manifest bytes

  // Build manifest with placeholder offsets; we'll update after we know manifest length.
  const baseManifest: Omit<ContainerV1Manifest, 'payloads'> = {
    formatVersion: '1.0.0',
    ...input.manifest,
  };

  const placeholderPayloads: ContainerV1PayloadManifestEntry[] = payloadEntries.map((p) => ({
    name: p.name,
    contentType: p.contentType,
    byteLength: p.data.byteLength,
    sha256: sha256Hex(p.data),
    offset: 0,
  }));

  // Iterate until manifest size stabilizes (offsets depend on manifest length).
  let manifestBuf = Buffer.from('');
  for (let i = 0; i < 5; i++) {
    const payloadOffsetBase = headerSize + manifestBuf.byteLength;
    let offset = payloadOffsetBase;

    const payloads = placeholderPayloads.map((p) => {
      const out = { ...p, offset };
      offset += p.byteLength;
      return out;
    });

    const manifest: ContainerV1Manifest = {
      ...baseManifest,
      payloads,
    };

    const nextManifestBuf = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    if (nextManifestBuf.byteLength === manifestBuf.byteLength) {
      manifestBuf = nextManifestBuf;
      payloadStartOffset = payloadOffsetBase;
      break;
    }
    manifestBuf = nextManifestBuf;
    payloadStartOffset = payloadOffsetBase;
  }

  // Final payload table with correct offsets
  let offset = payloadStartOffset;
  const finalPayloads: ContainerV1PayloadManifestEntry[] = payloadEntries.map((p) => {
    const entry: ContainerV1PayloadManifestEntry = {
      name: p.name,
      contentType: p.contentType,
      byteLength: p.data.byteLength,
      sha256: sha256Hex(p.data),
      offset,
    };
    offset += p.data.byteLength;
    return entry;
  });

  const finalManifest: ContainerV1Manifest = {
    ...(baseManifest as Omit<ContainerV1Manifest, 'payloads'>),
    payloads: finalPayloads,
  };
  manifestBuf = Buffer.from(JSON.stringify(finalManifest, null, 2) + '\n', 'utf-8');

  const manifestSha = sha256Raw(manifestBuf);

  const header = Buffer.alloc(headerSize);
  SSC_V1_MAGIC.copy(header, 0);
  header.writeUInt16LE(SSC_V1_MAJOR, 8);
  header.writeUInt16LE(SSC_V1_MINOR, 10);
  header.writeUInt32LE(manifestBuf.byteLength, 12);
  manifestSha.copy(header, 16);

  const payloadBlobs = payloadEntries.map((p) => p.data);

  return Buffer.concat([header, manifestBuf, ...payloadBlobs]);
}

/**
 * Decode a v1 container.
 */
export function decodeContainerV1(buf: Buffer): ContainerV1File {
  if (buf.byteLength < 8 + 2 + 2 + 4 + 32) {
    throw new Error('Invalid container: too small');
  }

  const magic = buf.subarray(0, 8);
  if (!magic.equals(SSC_V1_MAGIC)) {
    throw new Error(`Invalid container magic: ${magic.toString('ascii')}`);
  }

  const major = buf.readUInt16LE(8);
  const minor = buf.readUInt16LE(10);
  if (major !== SSC_V1_MAJOR) {
    throw new Error(`Unsupported container major version: ${major}`);
  }

  const manifestLen = buf.readUInt32LE(12);
  const manifestSha = buf.subarray(16, 48);
  const manifestStart = 48;
  const manifestEnd = manifestStart + manifestLen;
  if (manifestEnd > buf.byteLength) {
    throw new Error('Invalid container: manifest length exceeds file size');
  }

  const manifestBuf = buf.subarray(manifestStart, manifestEnd);
  const computedSha = sha256Raw(manifestBuf);
  if (!computedSha.equals(manifestSha)) {
    throw new Error('Invalid container: manifest sha256 mismatch');
  }

  const manifest = JSON.parse(manifestBuf.toString('utf-8')) as ContainerV1Manifest;
  if (manifest.formatVersion !== '1.0.0') {
    throw new Error(`Unsupported manifest formatVersion: ${manifest.formatVersion}`);
  }

  const payloads: Record<string, Buffer> = {};
  for (const p of manifest.payloads) {
    const start = p.offset;
    const end = p.offset + p.byteLength;
    if (start < 0 || end > buf.byteLength || end < start) {
      throw new Error(`Invalid payload range for ${p.name}`);
    }
    const data = buf.subarray(start, end);
    const hash = sha256Hex(data);
    if (hash !== p.sha256) {
      throw new Error(`Payload sha256 mismatch for ${p.name}`);
    }
    payloads[p.name] = Buffer.from(data);
  }

  // minor is reserved for additive changes; currently unused
  void minor;

  return { manifest, payloads };
}
