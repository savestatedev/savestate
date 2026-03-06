import { Command } from 'commander';
import { promises as fs } from 'fs';
import { encrypt, decrypt, KeySource } from '../container/crypto.js';
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

export type RestoreMode = 'replace' | 'merge';

// Placeholder for actual agent state restoration
async function restoreAgentState(
  agentId: string, 
  state: string, 
  mode: RestoreMode = 'replace'
): Promise<void> {
  const parsedState = JSON.parse(state);
  
  if (mode === 'merge') {
    console.log(`Merging state into existing agent: ${agentId}`);
    // In a real implementation, this would merge with existing state
    console.log('  - Keeping existing data, adding new entries');
  } else {
    console.log(`Replacing state for agent: ${agentId}`);
    // In a real implementation, this would replace existing state
    console.log('  - Overwriting all existing data');
  }
  
  console.log(`Restored state version: ${parsedState.version}`);
  console.log(`Components restored: ${Object.keys(parsedState).filter(k => k !== 'agentId' && k !== 'version' && k !== 'exportedAt').join(', ')}`);
}

export interface ExportOptions {
  agent: string;
  out: string;
  passphrase?: string;
  keyfile?: string;
  includePersonality?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includePreferences?: boolean;
}

async function exportState(options: ExportOptions) {
  try {
    const { agent, out, passphrase, keyfile } = options;
    
    // Validate key source
    if (!passphrase && !keyfile) {
      console.error(
        'Error: Either --passphrase or --keyfile is required for encryption.',
      );
      process.exit(1);
    }
    if (passphrase && keyfile) {
      console.error(
        'Error: Cannot use both --passphrase and --keyfile. Choose one.',
      );
      process.exit(1);
    }

    const keySource: KeySource = keyfile ? { keyfile } : { passphrase };

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
    const encryptedState = await encrypt(plaintext, keySource);

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

export interface RestoreOptions {
  in: string;
  passphrase?: string;
  keyfile?: string;
  merge?: boolean;
  replace?: boolean;
}

async function importState(options: RestoreOptions) {
  try {
    const { in: inFile, passphrase, keyfile } = options;
    
    // Validate key source
    if (!passphrase && !keyfile) {
      console.error(
        'Error: Either --passphrase or --keyfile is required for decryption.',
      );
      process.exit(1);
    }
    if (passphrase && keyfile) {
      console.error(
        'Error: Cannot use both --passphrase and --keyfile. Choose one.',
      );
      process.exit(1);
    }

    const keySource: KeySource = keyfile ? { keyfile } : { passphrase };

    // Determine restore mode
    const mode: RestoreMode = options.merge ? 'merge' : 'replace';

    // Check file exists
    try {
      await fs.access(inFile);
    } catch {
      console.error(`Error: File not found: ${inFile}`);
      process.exit(1);
    }

    const fileBuffer = await fs.readFile(inFile);

    // 1. Read header and manifest
    const magic = fileBuffer.subarray(0, 8).toString();
    const version = fileBuffer.readUInt8(8);
    if (magic !== 'SAVESTATE') {
      console.error('Error: Invalid file format. This does not appear to be a SaveState file.');
      process.exit(1);
    }
    if (version !== 1) {
      console.error(`Error: Unsupported container version (${version}). This version of SaveState supports version 1.`);
      process.exit(1);
    }

    const manifestLength = fileBuffer.readUInt32LE(16);
    const manifestEnd = 20 + manifestLength;
    const manifestBuffer = fileBuffer.subarray(20, manifestEnd);
    const manifest = JSON.parse(manifestBuffer.toString());

    // 2. Decrypt and verify
    const encryptedState = fileBuffer.subarray(manifestEnd);
    let decryptedState: Buffer;
    try {
      decryptedState = await decrypt(encryptedState, keySource);
    } catch {
      console.error('Error: Decryption failed. The passphrase or keyfile may be incorrect.');
      process.exit(1);
    }
    
    const payload = manifest.payloads.find((p: any) => p.name === 'agent_state');
    if (!payload) {
      console.error('Error: Invalid container - no agent state found.');
      process.exit(1);
    }

    const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
    if (calculatedHash !== payload.sha256) {
      console.error('Error: Integrity check failed. The file may be corrupted or tampered with.');
      process.exit(1);
    }
    
    // 3. Restore state
    await restoreAgentState(manifest.agentId, decryptedState.toString(), mode);

    console.log(`\n✓ Successfully restored agent '${manifest.agentId}' from ${inFile}`);
    console.log(`  Mode: ${mode}`);
    console.log(`  Original export: ${manifest.created}`);
  } catch (error: any) {
    console.error('Restore failed:', error.message);
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
    .option('-k, --keyfile <path>', 'Keyfile for encryption (alternative to passphrase)')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .action((opts) => exportState({
      agent: opts.agent,
      out: opts.output,
      passphrase: opts.passphrase,
      keyfile: opts.keyfile,
      includePersonality: opts.includePersonality,
      includeMemory: opts.includeMemory,
      includeTools: opts.includeTools,
      includePreferences: opts.includePreferences,
    }));

  // Top-level restore command (Issue #153)
  program
    .command('restore <file>')
    .description('Restore agent state from an encrypted .savestate file')
    .option('-p, --passphrase <pass>', 'Passphrase for decryption')
    .option('-k, --keyfile <path>', 'Keyfile for decryption (alternative to passphrase)')
    .option('--merge', 'Merge with existing state (default: replace)')
    .option('--replace', 'Replace existing state completely')
    .action((file, opts) => importState({
      in: file,
      passphrase: opts.passphrase,
      keyfile: opts.keyfile,
      merge: opts.merge,
      replace: opts.replace,
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
    .option('-k, --keyfile <path>', 'Keyfile for encryption')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .action((opts) => exportState({
      agent: opts.agent,
      out: opts.out,
      passphrase: opts.passphrase,
      keyfile: opts.keyfile,
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
    .option('-k, --keyfile <path>', 'Keyfile for decryption')
    .option('--merge', 'Merge with existing state')
    .option('--replace', 'Replace existing state (default)')
    .action((opts) => importState({
      in: opts.in,
      passphrase: opts.passphrase,
      keyfile: opts.keyfile,
      merge: opts.merge,
      replace: opts.replace,
    }));
}
