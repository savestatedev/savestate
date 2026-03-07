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
  manifest?: {
    agentId: string;
    created: string;
    formatVersion: number;
  };
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

  // Validate manifest structure
  if (!manifest.formatVersion || !manifest.agentId || !manifest.payloads) {
    return {
      status: 'corrupted',
      message: 'Invalid manifest structure',
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
  try {
    JSON.parse(decryptedState.toString());
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
    manifest: {
      agentId: manifest.agentId,
      created: manifest.created,
      formatVersion: manifest.formatVersion,
    },
  };
}

/**
 * CLI handler for verify command
 */
export async function verifyCommand(
  filePath: string,
  options: { passphrase?: string; keyfile?: string }
): Promise<void> {
  // Validate key source
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

  switch (result.status) {
    case 'valid':
      console.log('✅ State file is valid');
      if (result.manifest) {
        console.log(`   Agent: ${result.manifest.agentId}`);
        console.log(`   Created: ${result.manifest.created}`);
        console.log(`   Format: v${result.manifest.formatVersion}`);
      }
      process.exit(0);
      break;

    case 'wrong_password':
      console.log('⚠️  Wrong password (cannot decrypt)');
      if (result.manifest) {
        console.log(`   Agent: ${result.manifest.agentId}`);
        console.log(`   Created: ${result.manifest.created}`);
      }
      process.exit(2);
      break;

    case 'invalid_format':
      console.error(`❌ Invalid format: ${result.message}`);
      process.exit(1);
      break;

    case 'corrupted':
      console.error(`❌ File corrupted: ${result.message}`);
      if (result.manifest) {
        console.log(`   Agent: ${result.manifest.agentId}`);
      }
      process.exit(1);
      break;
  }
}
