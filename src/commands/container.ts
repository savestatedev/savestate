import { Command } from 'commander';
import { promises as fs } from 'fs';
import { encrypt, decrypt } from '../container/crypto.js';
import { createHash } from 'node:crypto';

// Placeholder for actual agent state loading
async function getAgentState(agentId: string): Promise<string> {
  console.log(`(Placeholder) Loading state for agent: ${agentId}`);
  const state = {
    agentId,
    personality: 'A helpful assistant.',
    memory: {
      lastInteraction: new Date().toISOString(),
    },
    version: 1,
  };
  return JSON.stringify(state, null, 2);
}

// Placeholder for actual agent state restoration
async function restoreAgentState(agentId: string, state: string): Promise<void> {
  console.log(`(Placeholder) Restoring state for agent: ${agentId}`);
  const parsedState = JSON.parse(state);
  console.log('Restored state version:', parsedState.version);
  // In a real implementation, this would save the state to disk/db
}

async function exportState(options: {
  agent: string;
  out: string;
  passphrase?: string;
}) {
  try {
    const { agent, out, passphrase } = options;
    if (!passphrase) {
      console.error(
        'Error: A passphrase is required for encryption. Please provide one with --passphrase.',
      );
      process.exit(1);
    }

    const agentState = await getAgentState(agent);
    const plaintext = Buffer.from(agentState);

    const manifest = {
      formatVersion: 1,
      created: new Date().toISOString(),
      agentId: agent,
      payloads: [
        {
          name: 'agent_state',
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: createHash('sha256').update(plaintext).digest('hex'),
        },
      ],
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const encryptedState = await encrypt(plaintext, passphrase);

    const magicHeader = Buffer.from('SAVESTATE\x01\x00\x00\x00\x00\x00\x00\x00');
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);

    const finalBuffer = Buffer.concat([
      magicHeader,
      manifestLength,
      manifestBuffer,
      encryptedState,
    ]);

    await fs.writeFile(out, finalBuffer);
    console.log(`Successfully exported agent '${agent}' to ${out}`);
  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  }
}

async function importState(options: { in: string; passphrase?: string }) {
  try {
    const { in: inFile, passphrase } = options;
    if (!passphrase) {
      console.error(
        'Error: A passphrase is required for decryption. Please provide one with --passphrase.',
      );
      process.exit(1);
    }

    const fileBuffer = await fs.readFile(inFile);

    // 1. Read header and manifest
    const magic = fileBuffer.subarray(0, 8).toString();
    const version = fileBuffer.readUInt8(8);
    if (magic !== 'SAVESTATE' || version !== 1) {
      throw new Error('Invalid or unsupported container format.');
    }

    const manifestLength = fileBuffer.readUInt32LE(16);
    const manifestEnd = 20 + manifestLength;
    const manifestBuffer = fileBuffer.subarray(20, manifestEnd);
    const manifest = JSON.parse(manifestBuffer.toString());

    // 2. Decrypt and verify
    const encryptedState = fileBuffer.subarray(manifestEnd);
    const decryptedState = await decrypt(encryptedState, passphrase);
    
    const payload = manifest.payloads.find(p => p.name === 'agent_state');
    if (!payload) {
      throw new Error('Agent state payload not found in manifest.');
    }

    const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
    if (calculatedHash !== payload.sha256) {
      throw new Error('Integrity check failed: Hashes do not match. The file may be corrupt.');
    }
    
    // 3. Restore state
    await restoreAgentState(manifest.agentId, decryptedState.toString());

    console.log(
      `Successfully imported and restored agent '${manifest.agentId}' from ${inFile}`,
    );
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
}

export function registerContainerCommands(program: Command) {
  const container = program
    .command('container')
    .description('Manage encrypted agent state containers.');

  container
    .command('export')
    .description('Export agent state to an encrypted file.')
    .requiredOption('-a, --agent <id>', 'ID of the agent to export')
    .requiredOption('-o, --out <file>', 'Output file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for encryption')
    .action(exportState);

  container
    .command('import')
    .description('Import agent state from an encrypted file.')
    .requiredOption('-i, --in <file>', 'Input file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for decryption')
    .action(importState);
}
