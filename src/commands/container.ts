import { Command } from 'commander';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { encrypt, decrypt, KeySource } from '../container/crypto.js';
import { getPassphrase } from '../passphrase.js';

const TARGET_STATE_FILE = 'agent_state.json';

async function writeTargetState(targetDir: string, state: string): Promise<string> {
  const resolved = resolve(targetDir);
  await fs.mkdir(resolved, { recursive: true });
  const outFile = join(resolved, TARGET_STATE_FILE);
  await fs.writeFile(outFile, state);
  return outFile;
}

export const INCLUDE_PATHS = ['personality', 'memory', 'tools', 'preferences'] as const;

export type IncludePath = (typeof INCLUDE_PATHS)[number];

export interface ComponentSelection {
  personality: boolean;
  memory: boolean;
  tools: boolean;
  preferences: boolean;
}

export function parseIncludePaths(raw?: string): { components: ComponentSelection } | { error: string } {
  if (raw === undefined) {
    return {
      components: {
        personality: true,
        memory: true,
        tools: true,
        preferences: true,
      },
    };
  }

  const parts = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { error: 'Error: --include requires at least one path.' };
  }

  const unknown = parts.filter((part) => !INCLUDE_PATHS.includes(part as IncludePath));
  if (unknown.length > 0) {
    return {
      error: `Error: Unknown include path: ${unknown[0]}. Allowed: ${INCLUDE_PATHS.join(', ')}.`,
    };
  }

  const selected = new Set(parts);
  return {
    components: {
      personality: selected.has('personality'),
      memory: selected.has('memory'),
      tools: selected.has('tools'),
      preferences: selected.has('preferences'),
    },
  };
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
  include?: string;
  includePersonality?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includePreferences?: boolean;
  force?: boolean;
  description?: string;
}

export interface ExportResult {
  written: boolean;
  out: string;
  overwritten: boolean;
}

async function resolveKeySource(
  passphrase?: string,
  keyfile?: string,
  options?: { confirm?: boolean },
): Promise<KeySource> {
  if (passphrase && keyfile) {
    throw new Error('Cannot use both --passphrase and --keyfile. Choose one.');
  }
  if (keyfile) {
    return { keyfile };
  }
  if (passphrase) {
    return { passphrase };
  }
  return { passphrase: await getPassphrase({ confirm: options?.confirm }) };
}

export function reportContainerProgress(phase: string, bytes?: number): string {
  const message = bytes === undefined ? phase : `${phase} (${bytes} bytes)`;
  console.log(message);
  return message;
}

export async function exportState(options: ExportOptions): Promise<ExportResult> {
  try {
    const { agent, out, passphrase, keyfile, description } = options;

    if (typeof agent !== 'string' || agent.trim() === '') {
      console.error('Error: Agent id must not be empty.');
      return { written: false, out, overwritten: false };
    }

    if (typeof out !== 'string' || out.trim() === '') {
      console.error(`Error: Output path must not be empty: ${JSON.stringify(out)}.`);
      return { written: false, out, overwritten: false };
    }

    if (passphrase !== undefined) {
      if (typeof passphrase !== 'string' || passphrase.trim() === '') {
        console.error(`Error: Passphrase must not be empty: ${JSON.stringify(passphrase)}.`);
        return { written: false, out, overwritten: false };
      }
    }

    if (keyfile !== undefined) {
      if (typeof keyfile !== 'string' || keyfile.trim() === '') {
        console.error(`Error: Keyfile must not be empty: ${JSON.stringify(keyfile)}.`);
        return { written: false, out, overwritten: false };
      }
      try {
        const keyfileStats = await fs.stat(keyfile);
        if (keyfileStats.isDirectory()) {
          console.error(`Error: Keyfile is a directory: ${keyfile}`);
          return { written: false, out, overwritten: false };
        }
      } catch {
        console.error(`Error: Keyfile not found: ${keyfile}`);
        return { written: false, out, overwritten: false };
      }
    }

    let existed = false;
    try {
      const outStats = await fs.stat(out);
      existed = true;
      if (outStats.isDirectory()) {
        console.error(`Error: Output path is a directory: ${out}`);
        return { written: false, out, overwritten: false };
      }
    } catch {
      existed = false;
      try {
        await fs.stat(dirname(out));
      } catch {
        console.error(`Error: Output directory not found: ${dirname(out)}`);
        return { written: false, out, overwritten: false };
      }
    }
    if (existed && !options.force) {
      console.error(
        `Error: Output file already exists: ${out}. Use --force to overwrite.`,
      );
      return { written: false, out, overwritten: false };
    }

    const keySource = await resolveKeySource(passphrase, keyfile, { confirm: true });

    let components: ComponentSelection;
    if (options.include !== undefined) {
      const parsed = parseIncludePaths(options.include);
      if ('error' in parsed) {
        console.error(parsed.error);
        process.exit(1);
      }
      components = parsed.components;
      const included = INCLUDE_PATHS.filter((path) => components[path]);
      console.log(`Including paths: ${included.join(', ')}`);
    } else {
      const includeAll = !options.includePersonality && !options.includeMemory && 
                         !options.includeTools && !options.includePreferences;
      components = {
        personality: includeAll || !!options.includePersonality,
        memory: includeAll || !!options.includeMemory,
        tools: includeAll || !!options.includeTools,
        preferences: includeAll || !!options.includePreferences,
      };
    }

    reportContainerProgress(`Loading state for agent ${agent}`);
    const agentState = await getAgentState(agent, components);
    const plaintext = Buffer.from(agentState);

    const trimmedDescription = description?.trim();
    const manifest = {
      formatVersion: 1,
      created: new Date().toISOString(),
      agentId: agent,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'Argon2id',
      },
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
    reportContainerProgress('Encrypting agent state', plaintext.length);
    const encryptedState = await encrypt(plaintext, keySource);

    // Magic header: 8 bytes "SAVESTAT" + 1 byte version + 7 bytes reserved = 16 bytes
    const magicHeader = Buffer.alloc(16);
    magicHeader.write('SAVESTAT', 0, 'ascii');  // 8 bytes
    magicHeader.writeUInt8(1, 8);               // version at byte 8
    const manifestLength = Buffer.alloc(4);
    manifestLength.writeUInt32LE(manifestBuffer.length, 0);

    const finalBuffer = Buffer.concat([
      magicHeader,
      manifestLength,
      manifestBuffer,
      encryptedState,
    ]);

    reportContainerProgress(`Writing ${out}`, finalBuffer.length);
    await fs.writeFile(out, finalBuffer);
    console.log(`Successfully exported agent '${agent}' to ${out}`);
    return { written: true, out, overwritten: existed };
  } catch (error: any) {
    console.error('Export failed:', error.message);
    process.exit(1);
    throw error;
  }
}

export interface RestoreOptions {
  in: string;
  passphrase?: string;
  keyfile?: string;
  merge?: boolean;
  replace?: boolean;
  dryRun?: boolean;
  target?: string;
}

export interface ImportResult {
  dryRun: boolean;
  restored: boolean;
  agentId: string;
  mode: RestoreMode;
  created: string;
  components: string[];
  target?: string;
}

function listRestoredComponents(parsedState: Record<string, unknown>): string[] {
  return Object.keys(parsedState).filter(
    (key) => key !== 'agentId' && key !== 'version' && key !== 'exportedAt',
  );
}

export async function importState(options: RestoreOptions): Promise<ImportResult | undefined> {
  try {
    const { in: inFile, passphrase, keyfile } = options;

    if (typeof inFile !== 'string' || inFile.trim() === '') {
      console.error(`Error: Input path must not be empty: ${JSON.stringify(inFile)}.`);
      return undefined;
    }

    if (options.target !== undefined) {
      if (typeof options.target !== 'string' || options.target.trim() === '') {
        console.error(`Error: Target path must not be empty: ${JSON.stringify(options.target)}.`);
        return undefined;
      }
    }

    if (passphrase !== undefined) {
      if (typeof passphrase !== 'string' || passphrase.trim() === '') {
        console.error(`Error: Passphrase must not be empty: ${JSON.stringify(passphrase)}.`);
        return undefined;
      }
    }

    if (keyfile !== undefined) {
      if (typeof keyfile !== 'string' || keyfile.trim() === '') {
        console.error(`Error: Keyfile must not be empty: ${JSON.stringify(keyfile)}.`);
        return undefined;
      }
      try {
        const keyfileStats = await fs.stat(keyfile);
        if (keyfileStats.isDirectory()) {
          console.error(`Error: Keyfile is a directory: ${keyfile}`);
          return undefined;
        }
      } catch {
        console.error(`Error: Keyfile not found: ${keyfile}`);
        return undefined;
      }
    }

    try {
      const inStats = await fs.stat(inFile);
      if (inStats.isDirectory()) {
        console.error(`Error: Input path is a directory: ${inFile}`);
        return undefined;
      }
    } catch {
    }

    const keySource = await resolveKeySource(passphrase, keyfile);

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
    reportContainerProgress(`Reading ${inFile}`, fileBuffer.length);

    // 1. Read header and manifest
    const magic = fileBuffer.subarray(0, 8).toString('ascii');
    const version = fileBuffer.readUInt8(8);
    if (magic !== 'SAVESTAT') {
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
    reportContainerProgress('Decrypting agent state', encryptedState.length);
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

    reportContainerProgress('Verifying integrity', decryptedState.length);
    const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
    if (calculatedHash !== payload.sha256) {
      console.error('Error: Integrity check failed. The file may be corrupted or tampered with.');
      process.exit(1);
    }
    
    const stateText = decryptedState.toString();
    const parsedState = JSON.parse(stateText) as Record<string, unknown>;
    const components = listRestoredComponents(parsedState);
    const result: ImportResult = {
      dryRun: !!options.dryRun,
      restored: !options.dryRun,
      agentId: manifest.agentId,
      mode,
      created: manifest.created,
      components,
    };

    if (options.dryRun) {
      console.log(`\nDRY RUN — no changes will be made`);
      console.log(`  Agent: ${manifest.agentId}`);
      console.log(`  Mode: ${mode}`);
      console.log(`  Original export: ${manifest.created}`);
      console.log(`  Components: ${components.join(', ') || 'none'}`);
      console.log(`  This was a dry run. No agent state was restored.`);
      return result;
    }

    let targetPath: string | undefined;
    if (options.target) {
      targetPath = await writeTargetState(options.target, stateText);
      result.target = targetPath;
      console.log(`Wrote agent state to ${targetPath}`);
    }

    reportContainerProgress(`Restoring agent ${manifest.agentId}`);
    await restoreAgentState(manifest.agentId, stateText, mode);

    console.log(`\n✓ Successfully restored agent '${manifest.agentId}' from ${inFile}`);
    console.log(`  Mode: ${mode}`);
    console.log(`  Original export: ${manifest.created}`);
    if (targetPath) {
      console.log(`  Target: ${targetPath}`);
    }
    return result;
  } catch (error: any) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
}

export function registerContainerCommands(program: Command) {
  // Top-level export command (Issue #152)
  program
    .command('export')
    .description('Export agent state to an encrypted .savestate file with optional path selection. Prints byte-size progress.')
    .requiredOption('-a, --agent <id>', 'ID of the agent to export')
    .option('-o, --output <file>', 'Output file path', 'agent.savestate')
    .option('-p, --passphrase <pass>', 'Passphrase for encryption (or SAVESTATE_PASSPHRASE / prompt)')
    .option('-k, --keyfile <path>', 'Keyfile for encryption (alternative to passphrase)')
    .option('--include <paths>', 'Comma-separated state paths to include (personality,memory,tools,preferences)')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .option('--force', 'Overwrite an existing output file')
    .option('--description <text>', 'Optional human-readable description for the export')
    .action(async (opts) => {
      const result = await exportState({
        agent: opts.agent,
        out: opts.output,
        passphrase: opts.passphrase,
        keyfile: opts.keyfile,
        include: opts.include,
        includePersonality: opts.includePersonality,
        includeMemory: opts.includeMemory,
        includeTools: opts.includeTools,
        includePreferences: opts.includePreferences,
        force: opts.force,
        description: opts.description,
      });
      if (!result.written) {
        process.exit(1);
      }
    });

  // Top-level import command (Issue #153)
  // Note: 'restore' is already used for snapshot restoration in cli.ts
  program
    .command('import <file>')
    .description('Import agent state from an encrypted .savestate file. Prints byte-size progress.')
    .option('-p, --passphrase <pass>', 'Passphrase for decryption (or SAVESTATE_PASSPHRASE / prompt)')
    .option('-k, --keyfile <path>', 'Keyfile for decryption (alternative to passphrase)')
    .option('--merge', 'Merge with existing state (default: replace)')
    .option('--replace', 'Replace existing state completely')
    .option('--dry-run', 'Show what would be imported without restoring')
    .option('--target <dir>', 'Write restored agent state to this directory')
    .action(async (file, opts) => {
      const result = await importState({
        in: file,
        passphrase: opts.passphrase,
        keyfile: opts.keyfile,
        merge: opts.merge,
        replace: opts.replace,
        dryRun: opts.dryRun,
        target: opts.target,
      });
      if (!result) {
        process.exit(1);
      }
    });

  const container = program
    .command('container')
    .description('Manage encrypted agent state containers.');

  container
    .command('export')
    .description('Export agent state to an encrypted file with optional path selection. Prints byte-size progress.')
    .requiredOption('-a, --agent <id>', 'ID of the agent to export')
    .requiredOption('-o, --out <file>', 'Output file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for encryption (or SAVESTATE_PASSPHRASE / prompt)')
    .option('-k, --keyfile <path>', 'Keyfile for encryption')
    .option('--include <paths>', 'Comma-separated state paths to include (personality,memory,tools,preferences)')
    .option('--include-personality', 'Include personality data')
    .option('--include-memory', 'Include memory data')
    .option('--include-tools', 'Include tool configurations')
    .option('--include-preferences', 'Include user preferences')
    .option('--force', 'Overwrite an existing output file')
    .option('--description <text>', 'Optional human-readable description for the export')
    .action(async (opts) => {
      const result = await exportState({
        agent: opts.agent,
        out: opts.out,
        passphrase: opts.passphrase,
        keyfile: opts.keyfile,
        include: opts.include,
        includePersonality: opts.includePersonality,
        includeMemory: opts.includeMemory,
        includeTools: opts.includeTools,
        includePreferences: opts.includePreferences,
        force: opts.force,
        description: opts.description,
      });
      if (!result.written) {
        process.exit(1);
      }
    });

  container
    .command('import')
    .description('Import agent state from an encrypted file. Prints byte-size progress.')
    .requiredOption('-i, --in <file>', 'Input file path (.savestate)')
    .option('-p, --passphrase <pass>', 'Passphrase for decryption (or SAVESTATE_PASSPHRASE / prompt)')
    .option('-k, --keyfile <path>', 'Keyfile for decryption')
    .option('--merge', 'Merge with existing state')
    .option('--replace', 'Replace existing state (default)')
    .option('--dry-run', 'Show what would be imported without restoring')
    .option('--target <dir>', 'Write restored agent state to this directory')
    .action(async (opts) => {
      const result = await importState({
        in: opts.in,
        passphrase: opts.passphrase,
        keyfile: opts.keyfile,
        merge: opts.merge,
        replace: opts.replace,
        dryRun: opts.dryRun,
        target: opts.target,
      });
      if (!result) {
        process.exit(1);
      }
    });
}
