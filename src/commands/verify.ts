/**
 * savestate verify — Verify integrity of a .savestate container
 *
 * Issue #155: User Story: State file integrity verification
 */

import { promises as fs } from 'fs';
import { createHash } from 'node:crypto';
import { decrypt, KeySource } from '../container/crypto.js';

export type VerifyStatus = 'valid' | 'corrupted' | 'wrong_password' | 'invalid_format';

export interface VerifyResult {
  status: VerifyStatus;
  message: string;
  checksum?: string;
  payloadBytes?: number;
  contentType?: string;
  encryptionAlgorithm?: string;
  keyDerivation?: string;
  manifest?: {
    agentId: string;
    created: string;
    formatVersion: number;
  };
  components?: string[];
}

export function formatVerifyChecksum(checksum: string): string {
  return `   Checksum: ${checksum}`;
}

export function formatVerifySize(payloadBytes: number): string {
  return `   Size: ${payloadBytes} bytes`;
}

export function formatVerifyContentType(contentType: string): string {
  return `   Content-Type: ${contentType}`;
}

const DEFAULT_VERIFY_ENCRYPTION = 'AES-256-GCM';

export function formatVerifyEncryption(algorithm: string): string {
  return `   Encryption: ${algorithm}`;
}

function resolveEncryptionAlgorithm(manifest: { encryption?: { algorithm?: unknown } }): string {
  const named = manifest.encryption?.algorithm;
  if (typeof named === 'string' && named.trim().length > 0) {
    return named;
  }
  return DEFAULT_VERIFY_ENCRYPTION;
}

const DEFAULT_VERIFY_KDF = 'Argon2id';

export function formatVerifyKeyDerivation(kdf: string): string {
  return `   Key derivation: ${kdf}`;
}

function resolveKeyDerivation(manifest: { encryption?: { keyDerivation?: unknown } }): string {
  const named = manifest.encryption?.keyDerivation;
  if (typeof named === 'string' && named.trim().length > 0) {
    return named;
  }
  return DEFAULT_VERIFY_KDF;
}

const STATE_METADATA_KEYS = new Set(['agentId', 'version', 'exportedAt']);

export function listStateComponents(state: unknown): string[] {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return [];
  }

  return Object.keys(state as Record<string, unknown>)
    .filter((key) => !STATE_METADATA_KEYS.has(key))
    .sort();
}

/**
 * Verify a .savestate file's integrity and optionally its decryptability.
 *
 * Steps:
 * 1. Validate magic header and version
 * 2. Parse manifest
 * 3. Attempt decryption (verifies password and GCM auth tag)
 * 4. Verify SHA256 checksum of decrypted payload
 */
export async function verifyContainer(
  filePath: string,
  keySource: KeySource
): Promise<VerifyResult> {
  let fileBuffer: Buffer;

  // 1. Read file
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {
        status: 'invalid_format',
        message: `File not found: ${filePath}`,
      };
    }
    return {
      status: 'corrupted',
      message: `Failed to read file: ${err.message}`,
    };
  }

  // 2. Validate magic header
  if (fileBuffer.length < 20) {
    return {
      status: 'invalid_format',
      message: 'File too small to be a valid SaveState container',
    };
  }

  const magic = fileBuffer.subarray(0, 8).toString('ascii');
  if (magic !== 'SAVESTAT') {
    return {
      status: 'invalid_format',
      message: 'Not a SaveState file (invalid magic header)',
    };
  }

  const version = fileBuffer.readUInt8(8);
  if (version !== 1) {
    return {
      status: 'invalid_format',
      message: `Unsupported container version: ${version}. This tool supports version 1.`,
    };
  }

  const reserved = fileBuffer.subarray(9, 16);
  if (!reserved.every((byte) => byte === 0)) {
    return {
      status: 'invalid_format',
      message: 'Reserved header bytes must be zero',
    };
  }

  // 3. Parse manifest
  let manifest: any;
  let manifestEnd: number;
  try {
    const manifestLength = fileBuffer.readUInt32LE(16);
    manifestEnd = 20 + manifestLength;

    if (fileBuffer.length < manifestEnd) {
      return {
        status: 'corrupted',
        message: 'File truncated: manifest extends beyond file size',
      };
    }

    const manifestBuffer = fileBuffer.subarray(20, manifestEnd);
    manifest = JSON.parse(manifestBuffer.toString());
  } catch {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: could not parse JSON',
    };
  }

  if (
    'agentId' in manifest &&
    typeof manifest.agentId === 'string' &&
    manifest.agentId.trim() === ''
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: agentId must not be empty',
    };
  }

  // Validate manifest structure
  if (!manifest.formatVersion || !manifest.agentId || !manifest.payloads) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest structure',
    };
  }

  if (typeof manifest.created !== 'string' || manifest.created.trim() === '') {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing created timestamp',
    };
  }


  if (!Array.isArray(manifest.payloads) || manifest.payloads.length === 0) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payloads must contain at least one payload',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { name?: unknown }) => typeof entry?.name !== 'string' || entry.name.trim() === '',
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing payload name',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { contentType?: unknown }) =>
        typeof entry?.contentType !== 'string' || entry.contentType.trim() === '',
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing payload content type',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { byteLength?: unknown }) =>
        typeof entry?.byteLength !== 'number' || !Number.isInteger(entry.byteLength),
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing payload byte length',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { sha256?: unknown }) =>
        typeof entry?.sha256 !== 'string' || entry.sha256.trim() === '',
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing payload checksum',
    };
  }


  if (
    typeof manifest.created === 'string' &&
    manifest.created.trim() !== '' &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(manifest.created)
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: created timestamp must be ISO 8601',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { sha256?: unknown }) =>
        typeof entry?.sha256 === 'string' &&
        entry.sha256.trim() !== '' &&
        !/^[0-9a-fA-F]{64}$/.test(entry.sha256),
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payload checksum must be a hex SHA-256 digest',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { byteLength?: unknown }) =>
        typeof entry?.byteLength === 'number' &&
        Number.isInteger(entry.byteLength) &&
        entry.byteLength < 0,
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payload byte length must be a non-negative integer',
    };
  }

  const payload = manifest.payloads.find((p: any) => p.name === 'agent_state');
  if (!payload || !payload.sha256) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing agent_state payload or checksum',
    };
  }

  // 4. Attempt decryption
  const encryptedState = fileBuffer.subarray(manifestEnd);
  if (encryptedState.length === 0) {
    return {
      status: 'corrupted',
      message: 'No encrypted payload found',
    };
  }

  let decryptedState: Buffer;
  try {
    decryptedState = await decrypt(encryptedState, keySource);
  } catch {
    return {
      status: 'wrong_password',
      message: 'Decryption failed: incorrect passphrase or keyfile',
      manifest: {
        agentId: manifest.agentId,
        created: manifest.created,
        formatVersion: manifest.formatVersion,
      },
    };
  }

  // 5. Verify checksum
  const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
  if (calculatedHash !== payload.sha256) {
    return {
      status: 'corrupted',
      message: 'Integrity check failed: checksum mismatch (file may be corrupted or tampered)',
      manifest: {
        agentId: manifest.agentId,
        created: manifest.created,
        formatVersion: manifest.formatVersion,
      },
    };
  }

  // 6. Optionally validate JSON structure
  let components: string[] = [];
  try {
    components = listStateComponents(JSON.parse(decryptedState.toString()));
  } catch {
    return {
      status: 'corrupted',
      message: 'Decrypted payload is not valid JSON',
      manifest: {
        agentId: manifest.agentId,
        created: manifest.created,
        formatVersion: manifest.formatVersion,
      },
    };
  }

  return {
    status: 'valid',
    message: 'State file is valid and verified',
    checksum: calculatedHash,
    payloadBytes: decryptedState.length,
    contentType: typeof payload.contentType === 'string' ? payload.contentType : undefined,
    encryptionAlgorithm: resolveEncryptionAlgorithm(manifest),
    keyDerivation: resolveKeyDerivation(manifest),
    manifest: {
      agentId: manifest.agentId,
      created: manifest.created,
      formatVersion: manifest.formatVersion,
    },
    components,
  };
}

export function verifyExitCode(status: VerifyStatus): number {
  if (status === 'valid') {
    return 0;
  }
  if (status === 'wrong_password') {
    return 2;
  }
  return 1;
}

export function formatVerifyResult(result: VerifyResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  switch (result.status) {
    case 'valid': {
      const lines = ['✅ State file is valid'];
      if (result.manifest) {
        lines.push(`   Agent: ${result.manifest.agentId}`);
        lines.push(`   Created: ${result.manifest.created}`);
        lines.push(`   Format: v${result.manifest.formatVersion}`);
      }
      lines.push(
        `   Components: ${result.components && result.components.length > 0 ? result.components.join(', ') : 'none'}`,
      );
      if (result.checksum) {
        lines.push(formatVerifyChecksum(result.checksum));
      }
      if (result.payloadBytes !== undefined) {
        lines.push(formatVerifySize(result.payloadBytes));
      }
      if (result.contentType) {
        lines.push(formatVerifyContentType(result.contentType));
      }
      if (result.encryptionAlgorithm) {
        lines.push(formatVerifyEncryption(result.encryptionAlgorithm));
      }
      if (result.keyDerivation) {
        lines.push(formatVerifyKeyDerivation(result.keyDerivation));
      }
      return lines.join('\n');
    }
    case 'wrong_password': {
      const lines = ['⚠️  Wrong password (cannot decrypt)'];
      if (result.manifest) {
        lines.push(`   Agent: ${result.manifest.agentId}`);
        lines.push(`   Created: ${result.manifest.created}`);
      }
      return lines.join('\n');
    }
    case 'invalid_format':
      return `❌ Invalid format: ${result.message}`;
    case 'corrupted': {
      const lines = [`❌ File corrupted: ${result.message}`];
      if (result.manifest) {
        lines.push(`   Agent: ${result.manifest.agentId}`);
      }
      return lines.join('\n');
    }
  }
}

export async function verifyCommand(
  filePath: string,
  options: { passphrase?: string; keyfile?: string; json?: boolean }
): Promise<void> {
  const passphrase = options.passphrase || process.env.SAVESTATE_PASSPHRASE;
  const keyfile = options.keyfile;

  if (!passphrase && !keyfile) {
    console.error(
      '✗ Either --passphrase or --keyfile is required.\n' +
      '  You can also set SAVESTATE_PASSPHRASE environment variable.'
    );
    process.exit(1);
  }

  if (passphrase && keyfile) {
    console.error('✗ Cannot use both --passphrase and --keyfile. Choose one.');
    process.exit(1);
  }

  const keySource: KeySource = keyfile ? { keyfile } : { passphrase };

  const result = await verifyContainer(filePath, keySource);
  const output = formatVerifyResult(result, !!options.json);
  const exitCode = verifyExitCode(result.status);

  if (options.json || result.status === 'valid' || result.status === 'wrong_password') {
    console.log(output);
  } else {
    console.error(output);
  }

  process.exit(exitCode);
}
