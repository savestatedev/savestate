import { Command } from 'commander';
import { promises as fs } from 'fs';
import { encrypt, decrypt } from '../container/crypto.js';
import { createHash } from 'node:crypto';

interface ComponentSelection {
  personality: boolean;
  memory: boolean;
  tools: boolean;
  preferences: boolean;
}

// Placeholder for actual agent state loading
async function getAgentState(agentId: string, components: ComponentSelection): Promise<string> {
  console.log(`Loading state for agent: ${agentId}`);
  const enabledComponents = Object.entries(components).filter(([,v]) => v).map(([k]) => k);
  console.log(`Components: ${enabledComponents.join(', ') || 'all'}`);
  
  const state: Record<string, any> = {
    agentId,
    version: 1,
    exportedAt: new Date().toISOString(),
  };
  
  if (components.personality) {
    state.personality = {
      name: agentId,
      description: 'A helpful assistant.',
      traits: ['helpful', 'friendly', 'knowledgeable'],
    };
  }
  
  if (components.memory) {
    state.memory = {
      lastInteraction: new Date().toISOString(),
      facts: [],
      conversations: [],
    };
  }
  
  if (components.tools) {
    state.tools = {
      enabled: [],
      configurations: {},
    };
  }
  
  if (components.preferences) {
    state.preferences = {
      language: 'en',
      timezone: 'UTC',
      formatting: {},
    };
  }
  
  return JSON.stringify(state, null, 2);
}

// Placeholder for actual agent state restoration
async function restoreAgentState(agentId: string, state: string): Promise<void> {
  console.log(`(Placeholder) Restoring state for agent: ${agentId}`);
  const parsedState = JSON.parse(state);
  console.log('Restored state version:', parsedState.version);
  // In a real implementation, this would save the state to disk/db
}

export interface ExportOptions {
  agent: string;
  out: string;
  passphrase?: string;
  includePersonality?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includePreferences?: boolean;
}

async function exportState(options: ExportOptions) {
  try {
    const { agent, out, passphrase } = options;
    if (!passphrase) {
      console.error(
        'Error: A passphrase is required for encryption. Please provide one with --passphrase.',
      );
      process.exit(1);
    }

    // Determine which components to include (default: all)
    const includeAll = !options.includePersonality && !options.includeMemory && 
                       !options.includeTools && !options.includePreferences;
    const components: ComponentSelection = {
      personality: includeAll || !!options.includePersonality,
      memory: includeAll || !!options.includeMemory,
      tools: includeAll || !!options.includeTools,
      preferences: includeAll || !!options.includePreferences,
    };

    const agentState = await getAgentState(agent, components);
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
  } catch (error: any) {
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
    
    const payload = manifest.payloads.find((p: any) => p.name === 'agent_state');
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
  } catch (error: any) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
}

export function registerContainerCommands(program: Command) {
  // Top-level export command (Issue #152)
  program
    .command('export')
    .description('Export agent state to an encrypted .savestate file')
    .requiredOption('-a, --agent <id>', 'ID of the agent to export')
    .option('-o, --output <file>', 'Output file path', 'agent.savestate')
    .option('-p, --passphrase <pass>', 'Passphrase for encryption')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .action((opts) => exportState({
      agent: opts.agent,
      out: opts.output,
      passphrase: opts.passphrase,
      includePersonality: opts.includePersonality,
      includeMemory: opts.includeMemory,
      includeTools: opts.includeTools,
      includePreferences: opts.includePreferences,
    }));

  const container = program
    .command('container')
    .description('Manage encrypted agent state containers.');

  container
    .command('export')
    .description('Export agent state to an encrypted file.')
    .requiredOption('-a, --agent <id>', 'ID of the agent to export')
    .requiredOption('-o, --out <file>', 'Output file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for encryption')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .action((opts) => exportState({
      agent: opts.agent,
      out: opts.out,
      passphrase: opts.passphrase,
      includePersonality: opts.includePersonality,
      includeMemory: opts.includeMemory,
      includeTools: opts.includeTools,
      includePreferences: opts.includePreferences,
    }));

  container
    .command('import')
    .description('Import agent state from an encrypted file.')
    .requiredOption('-i, --in <file>', 'Input file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for decryption')
    .action(importState);
}
