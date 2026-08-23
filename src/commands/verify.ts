/**
 * savestate verify — Verify integrity of a .savestate container
 *
 * Issue #155: User Story: State file integrity verification
 */

import { promises as fs } from 'fs';
import { createHash } from 'node:crypto';
import { decrypt, KeySource } from '../container/crypto.js';
import { validateExcludedComponents, validateIncludedComponents } from './container.js';

export type VerifyStatus = 'valid' | 'corrupted' | 'wrong_password' | 'invalid_format';

export interface VerifyResult {
  status: VerifyStatus;
  message: string;
  checksum?: string;
  payloadBytes?: number;
  contentType?: string;
  payloadName?: string;
  encryptionAlgorithm?: string;
  keyDerivation?: string;
  input?: string;
  manifest?: {
    agentId: string;
    created: string;
    formatVersion: number;
    description?: string;
  };
  components?: string[];
  excluded?: string[];
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

export function formatVerifyPayloadName(name: string): string {
  return `   Payload: ${name}`;
}

export function formatVerifyAgent(agentId: string): string {
  return `   Agent: ${agentId}`;
}

export function formatVerifyCreated(created: string): string {
  return `   Created: ${created}`;
}

export function formatVerifyFormatVersion(formatVersion: number): string {
  return `   Format: v${formatVersion}`;
}

export function formatVerifyDescription(description: string): string {
  return `   Description: ${description}`;
}

export function formatVerifyInput(input: string): string {
  return `   Input: ${input}`;
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

export function formatVerifyExcluded(excluded: readonly string[]): string {
  return `   Excluded: ${excluded.join(', ')}`;
}

function resolveKeyDerivation(manifest: { encryption?: { keyDerivation?: unknown } }): string {
  const named = manifest.encryption?.keyDerivation;
  if (typeof named === 'string' && named.trim().length > 0) {
    return named;
  }
  return DEFAULT_VERIFY_KDF;
}


function optionalDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const description = value.trim();
  return description.length > 0 ? description : undefined;
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

export function missingPackedComponent(
  listed: readonly string[],
  packed: readonly string[],
): string | undefined {
  return listed.find((path) => !packed.includes(path));
}

export function packedExcludedPath(
  excluded: readonly string[],
  packed: readonly string[],
): string | undefined {
  return excluded.find((path) => packed.includes(path));
}

export function unlistedPackedComponent(
  listed: readonly string[],
  packed: readonly string[],
): string | undefined {
  return packed.find((path) => !listed.includes(path));
}

export function overlappingExcludedComponent(
  listed: readonly string[],
  excluded: readonly string[],
): string | undefined {
  return excluded.find((path) => listed.includes(path));
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


  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: manifest must be an object',
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


  if (
    manifest !== null &&
    typeof manifest === 'object' &&
    !Array.isArray(manifest) &&
    !('formatVersion' in manifest)
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: formatVersion is required',
    };
  }


  if (
    manifest !== null &&
    typeof manifest === 'object' &&
    !Array.isArray(manifest) &&
    'formatVersion' in manifest &&
    typeof manifest.formatVersion !== 'number'
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: formatVersion must be a number',
    };
  }


  if (
    manifest !== null &&
    typeof manifest === 'object' &&
    !Array.isArray(manifest) &&
    typeof manifest.formatVersion === 'number' &&
    !Number.isInteger(manifest.formatVersion)
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: formatVersion must be an integer',
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
      (entry: unknown) => entry === null || typeof entry !== 'object' || Array.isArray(entry),
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: each payload entry must be an object',
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

  if ('components' in manifest) {
    const validated = validateIncludedComponents(manifest.components);
    if ('error' in validated) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: ${validated.error.replace(/^Error: /, '')}`,
      };
    }
  }

  let excluded: string[] | undefined;
  if ('excluded' in manifest) {
    const validated = validateExcludedComponents(manifest.excluded);
    if ('error' in validated) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: ${validated.error.replace(/^Error: /, '')}`,
      };
    }
    excluded = validated.excluded;
  }

  if (Array.isArray(manifest.components) && Array.isArray(manifest.excluded)) {
    const overlap = overlappingExcludedComponent(manifest.components, manifest.excluded);
    if (overlap) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: excluded path is listed: ${overlap}`,
      };
    }
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


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { byteLength?: unknown }) =>
        typeof entry?.byteLength === 'number' &&
        !Number.isInteger(entry.byteLength),
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payload byte length must be an integer',
    };
  }


  if (
    Array.isArray(manifest.payloads) &&
    manifest.payloads.some(
      (entry: { byteLength?: unknown }) =>
        entry?.byteLength !== undefined &&
        entry.byteLength !== null &&
        typeof entry.byteLength !== 'number',
    )
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payload byte length must be a number',
    };
  }


  if (!Array.isArray(manifest.payloads)) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: payloads must be an array',
    };
  }


  if (manifest.formatVersion !== 1) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: formatVersion must be 1',
    };
  }


  if (typeof manifest.agentId !== 'string') {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: agentId must be a string',
    };
  }


  if (Array.isArray(manifest.payloads)) {
    for (const entry of manifest.payloads) {
      if (
        entry &&
        typeof entry === 'object' &&
        'name' in entry &&
        typeof entry.name !== 'string'
      ) {
        return {
          status: 'corrupted',
          message: 'Invalid manifest: payload name must be a string',
        };
      }
    }
  }


  if (Array.isArray(manifest.payloads)) {
    for (const entry of manifest.payloads) {
      if (
        entry &&
        typeof entry === 'object' &&
        'contentType' in entry &&
        typeof entry.contentType !== 'string'
      ) {
        return {
          status: 'corrupted',
          message: 'Invalid manifest: payload content type must be a string',
        };
      }
    }
  }


  if (Array.isArray(manifest.payloads)) {
    for (const entry of manifest.payloads) {
      if (
        entry &&
        typeof entry === 'object' &&
        'contentType' in entry &&
        typeof entry.contentType === 'string' &&
        entry.contentType.trim() === ''
      ) {
        return {
          status: 'corrupted',
          message: 'Invalid manifest: payload content type must not be empty',
        };
      }
    }
  }


  if (Array.isArray(manifest.payloads)) {
    for (const entry of manifest.payloads) {
      if (
        entry &&
        typeof entry === 'object' &&
        'name' in entry &&
        typeof entry.name === 'string' &&
        entry.name.trim() === ''
      ) {
        return {
          status: 'corrupted',
          message: 'Invalid manifest: payload name must not be empty',
        };
      }
    }
  }


  if (Array.isArray(manifest.payloads)) {
    for (const entry of manifest.payloads) {
      if (
        entry &&
        typeof entry === 'object' &&
        'sha256' in entry &&
        typeof entry.sha256 === 'string' &&
        entry.sha256.trim() === ''
      ) {
        return {
          status: 'corrupted',
          message: 'Invalid manifest: payload checksum must not be empty',
        };
      }
    }
  }


  if (
    'created' in manifest &&
    typeof manifest.created === 'string' &&
    manifest.created.trim() === ''
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: created timestamp must not be empty',
    };
  }


  if ('created' in manifest && typeof manifest.created !== 'string') {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: created must be a string',
    };
  }


  if ('description' in manifest && typeof manifest.description !== 'string') {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: description must be a string',
    };
  }


  if ('description' in manifest && manifest.description === '') {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: description must not be empty',
    };
  }


  if (
    'encryption' in manifest &&
    (manifest.encryption === null ||
      typeof manifest.encryption !== 'object' ||
      Array.isArray(manifest.encryption))
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: encryption must be an object',
    };
  }

  if (
    'encryption' in manifest &&
    manifest.encryption !== null &&
    typeof manifest.encryption === 'object' &&
    !Array.isArray(manifest.encryption) &&
    !('keyDerivation' in manifest.encryption)
  ) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest: missing key derivation',
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
    const description = optionalDescription(manifest.description);
    return {
      status: 'wrong_password',
      message: 'Decryption failed: incorrect passphrase or keyfile',
      manifest: {
        agentId: manifest.agentId,
        created: manifest.created,
        formatVersion: manifest.formatVersion,
        ...(description ? { description } : {}),
      },
      input: filePath,
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

  if (Array.isArray(manifest.components)) {
    const missing = missingPackedComponent(manifest.components, components);
    if (missing) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: component not packed: ${missing}`,
      };
    }
    const extra = unlistedPackedComponent(manifest.components, components);
    if (extra) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: packed path not listed: ${extra}`,
      };
    }
  }

  if (Array.isArray(manifest.excluded)) {
    const packedExclusion = packedExcludedPath(manifest.excluded, components);
    if (packedExclusion) {
      return {
        status: 'corrupted',
        message: `Invalid manifest: excluded path is packed: ${packedExclusion}`,
      };
    }
  }

  const description = optionalDescription(manifest.description);

  return {
    status: 'valid',
    message: 'State file is valid and verified',
    checksum: calculatedHash,
    payloadBytes: decryptedState.length,
    contentType: typeof payload.contentType === 'string' ? payload.contentType : undefined,
    payloadName: typeof payload.name === 'string' && payload.name.trim() !== '' ? payload.name.trim() : undefined,
    encryptionAlgorithm: resolveEncryptionAlgorithm(manifest),
    keyDerivation: resolveKeyDerivation(manifest),
    manifest: {
      agentId: manifest.agentId,
      created: manifest.created,
      formatVersion: manifest.formatVersion,
      ...(description ? { description } : {}),
    },
    components,
    ...(excluded ? { excluded } : {}),
    input: filePath,
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
        lines.push(formatVerifyAgent(result.manifest.agentId));
        lines.push(formatVerifyCreated(result.manifest.created));
        lines.push(formatVerifyFormatVersion(result.manifest.formatVersion));
        if (result.manifest.description) {
          lines.push(formatVerifyDescription(result.manifest.description));
        }
      }
      lines.push(
        `   Components: ${result.components && result.components.length > 0 ? result.components.join(', ') : 'none'}`,
      );
      if (result.excluded && result.excluded.length > 0) {
        lines.push(formatVerifyExcluded(result.excluded));
      }
      if (result.checksum) {
        lines.push(formatVerifyChecksum(result.checksum));
      }
      if (result.payloadBytes !== undefined) {
        lines.push(formatVerifySize(result.payloadBytes));
      }
      if (result.contentType) {
        lines.push(formatVerifyContentType(result.contentType));
      }
      if (result.payloadName) {
        lines.push(formatVerifyPayloadName(result.payloadName));
      }
      if (result.encryptionAlgorithm) {
        lines.push(formatVerifyEncryption(result.encryptionAlgorithm));
      }
      if (result.keyDerivation) {
        lines.push(formatVerifyKeyDerivation(result.keyDerivation));
      }
      if (result.input) {
        lines.push(formatVerifyInput(result.input));
      }
      return lines.join('\n');
    }
    case 'wrong_password': {
      const lines = ['⚠️  Wrong password (cannot decrypt)'];
      if (result.manifest) {
        lines.push(formatVerifyAgent(result.manifest.agentId));
        lines.push(formatVerifyCreated(result.manifest.created));
        lines.push(formatVerifyFormatVersion(result.manifest.formatVersion));
        if (result.manifest.description) {
          lines.push(formatVerifyDescription(result.manifest.description));
        }
      }
      if (result.input) {
        lines.push(formatVerifyInput(result.input));
      }
      return lines.join('\n');
    }
    case 'invalid_format':
      return `❌ Invalid format: ${result.message}`;
    case 'corrupted': {
      const lines = [`❌ File corrupted: ${result.message}`];
      if (result.manifest) {
        lines.push(formatVerifyAgent(result.manifest.agentId));
        lines.push(formatVerifyCreated(result.manifest.created));
        lines.push(formatVerifyFormatVersion(result.manifest.formatVersion));
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
