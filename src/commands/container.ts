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

export const INCLUDE_PATHS = ['personality', 'memory', 'tools', 'preferences', 'conversation_history'] as const;

export type IncludePath = (typeof INCLUDE_PATHS)[number];

export interface ComponentSelection {
  personality: boolean;
  memory: boolean;
  tools: boolean;
  preferences: boolean;
  conversation_history: boolean;
}

export function validateIncludedComponents(
  value: unknown,
): { components: IncludePath[] } | { error: string } {
  if (!Array.isArray(value)) {
    return { error: 'Error: components must be an array of known state paths.' };
  }
  if (value.length === 0) {
    return { error: 'Error: components must include at least one path.' };
  }

  const seen = new Set<string>();
  const components: IncludePath[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !INCLUDE_PATHS.includes(entry as IncludePath)) {
      const label = typeof entry === 'string' ? entry : JSON.stringify(entry);
      return {
        error: `Error: Unknown component: ${label}. Allowed: ${INCLUDE_PATHS.join(', ')}.`,
      };
    }
    if (seen.has(entry)) {
      return { error: `Error: Duplicate component: ${entry}.` };
    }
    seen.add(entry);
    components.push(entry);
  }
  return { components };
}

export function missingPackedComponent(
  listed: readonly string[],
  packed: readonly string[],
): string | undefined {
  return listed.find((path) => !packed.includes(path));
}

export function validateExcludedComponents(
  value: unknown,
): { excluded: IncludePath[] } | { error: string } {
  if (!Array.isArray(value)) {
    return { error: 'Error: excluded must be an array of known state paths.' };
  }
  if (value.length === 0) {
    return { error: 'Error: excluded must include at least one path.' };
  }

  const seen = new Set<string>();
  const excluded: IncludePath[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !INCLUDE_PATHS.includes(entry as IncludePath)) {
      const label = typeof entry === 'string' ? entry : JSON.stringify(entry);
      return {
        error: `Error: Unknown excluded path: ${label}. Allowed: ${INCLUDE_PATHS.join(', ')}.`,
      };
    }
    if (seen.has(entry)) {
      return { error: `Error: Duplicate excluded path: ${entry}.` };
    }
    seen.add(entry);
    excluded.push(entry);
  }
  return { excluded };
}

export function parseIncludePaths(raw?: string): { components: ComponentSelection } | { error: string } {
  if (raw === undefined) {
    return {
      components: {
        personality: true,
        memory: true,
        tools: true,
        preferences: true,
        conversation_history: true,
      },
    };
  }

  const tokens = raw.split(',').map((part) => part.trim().toLowerCase());
  const parts = tokens.filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { error: 'Error: --include requires at least one path.' };
  }

  if (parts.length !== tokens.length) {
    return { error: 'Error: --include path must not be empty.' };
  }

  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part)) {
      return { error: `Error: Duplicate include path: ${part}.` };
    }
    seen.add(part);
  }

  const unknown = parts.filter((part) => !INCLUDE_PATHS.includes(part as IncludePath));
  if (unknown.length > 0) {
    return {
      error: `Error: Unknown include path: ${unknown[0]}. Allowed: ${INCLUDE_PATHS.join(', ')}.`,
    };
  }

  const selected = seen;
  return {
    components: {
      personality: selected.has('personality'),
      memory: selected.has('memory'),
      tools: selected.has('tools'),
      preferences: selected.has('preferences'),
      conversation_history: selected.has('conversation_history'),
    },
  };
}

export function applyExcludePaths(
  components: ComponentSelection,
  raw?: string,
): { components: ComponentSelection } | { error: string } {
  if (raw === undefined) {
    return { components };
  }

  const tokens = raw.split(',').map((part) => part.trim().toLowerCase());
  const parts = tokens.filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { error: 'Error: --exclude requires at least one path.' };
  }

  if (parts.length !== tokens.length) {
    return { error: 'Error: --exclude path must not be empty.' };
  }

  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part)) {
      return { error: `Error: Duplicate exclude path: ${part}.` };
    }
    seen.add(part);
  }

  const unknown = parts.filter((part) => !INCLUDE_PATHS.includes(part as IncludePath));
  if (unknown.length > 0) {
    return {
      error: `Error: Unknown exclude path: ${unknown[0]}. Allowed: ${INCLUDE_PATHS.join(', ')}.`,
    };
  }

  const next: ComponentSelection = { ...components };
  for (const part of parts) {
    if (!components[part as IncludePath]) {
      return { error: `Error: Exclude path not selected: ${part}.` };
    }
    next[part as IncludePath] = false;
  }

  if (!INCLUDE_PATHS.some((path) => next[path])) {
    return { error: 'Error: --exclude cannot remove every component.' };
  }

  return { components: next };
}

export function listExcludedPaths(raw?: string): string[] {
  if (raw === undefined) {
    return [];
  }

  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

export function formatImportExcluded(excluded: readonly string[]): string {
  return `  Excluded: ${excluded.join(', ')}`;
}

export function formatExportExcluded(excluded: readonly string[]): string {
  return `  Excluded: ${excluded.join(', ')}`;
}

export function formatImportComponents(components: readonly string[]): string {
  return `  Components: ${components.length > 0 ? components.join(', ') : 'none'}`;
}

export function formatImportDescription(description: string): string {
  return `  Description: ${description}`;
}

function optionalImportDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const description = value.trim();
  return description.length > 0 ? description : undefined;
}

export function formatImportEncryption(algorithm: string): string {
  return `  Encryption: ${algorithm}`;
}

function optionalImportEncryption(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const algorithm = (value as { algorithm?: unknown }).algorithm;
  if (typeof algorithm !== 'string') {
    return undefined;
  }
  const named = algorithm.trim();
  return named.length > 0 ? named : undefined;
}

export function formatImportKeyDerivation(kdf: string): string {
  return `  Key derivation: ${kdf}`;
}

export function formatImportChecksum(checksum: string): string {
  return `  Checksum: ${checksum}`;
}

export function formatExportChecksum(checksum: string): string {
  return `  Checksum: ${checksum}`;
}

export function formatExportDescription(description: string): string {
  return `  Description: ${description}`;
}

export function formatExportEncryption(algorithm: string): string {
  return `  Encryption: ${algorithm}`;
}

export function formatExportKeyDerivation(kdf: string): string {
  return `  Key derivation: ${kdf}`;
}

export function formatImportSize(payloadBytes: number): string {
  return `  Size: ${payloadBytes} bytes`;
}

export function formatExportSize(payloadBytes: number): string {
  return `  Size: ${payloadBytes} bytes`;
}

export function formatImportContentType(contentType: string): string {
  return `  Content-Type: ${contentType}`;
}

export function formatExportContentType(contentType: string): string {
  return `  Content-Type: ${contentType}`;
}

export function formatImportFormatVersion(formatVersion: number): string {
  return `  Format: v${formatVersion}`;
}

export function formatExportFormatVersion(formatVersion: number): string {
  return `  Format: v${formatVersion}`;
}

export function formatExportCreated(created: string): string {
  return `  Created: ${created}`;
}

export function formatImportAgent(agentId: string): string {
  return `  Agent: ${agentId}`;
}

export function formatImportCreated(created: string): string {
  return `  Created: ${created}`;
}

export function formatImportMode(mode: RestoreMode): string {
  return `  Mode: ${mode}`;
}

export function formatImportTarget(target: string): string {
  return `  Target: ${target}`;
}

export function formatImportInput(inFile: string): string {
  return `  Input: ${inFile}`;
}

export function formatImportPayloadName(name: string): string {
  return `  Payload: ${name}`;
}

export function formatExportPayloadName(name: string): string {
  return `  Payload: ${name}`;
}

export function formatExportAgent(agentId: string): string {
  return `  Agent: ${agentId}`;
}

export function formatExportOutput(out: string): string {
  return `  Output: ${out}`;
}

export function formatExportComponents(components: readonly string[]): string {
  return `  Components: ${components.length > 0 ? components.join(', ') : 'none'}`;
}

function optionalImportPayloadName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const name = value.trim();
  return name.length > 0 ? name : undefined;
}

function optionalImportKeyDerivation(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const named = (value as { keyDerivation?: unknown }).keyDerivation;
  if (typeof named !== 'string') {
    return undefined;
  }
  const kdf = named.trim();
  return kdf.length > 0 ? kdf : undefined;
}

const IMPORT_METADATA_KEYS = new Set(['agentId', 'version', 'exportedAt']);

export function applyImportInclude(
  state: Record<string, unknown>,
  raw?: string,
): { state: Record<string, unknown>; components: string[] } | { error: string } {
  if (raw === undefined) {
    return {
      state,
      components: Object.keys(state).filter((key) => !IMPORT_METADATA_KEYS.has(key)),
    };
  }

  const parsed = parseIncludePaths(raw);
  if ('error' in parsed) {
    return parsed;
  }

  const selected = INCLUDE_PATHS.filter((path) => parsed.components[path]);
  const next: Record<string, unknown> = {};
  for (const key of IMPORT_METADATA_KEYS) {
    if (key in state) {
      next[key] = state[key];
    }
  }

  const components: string[] = [];
  for (const path of selected) {
    if (!(path in state)) {
      return { error: `Error: Include path not in archive: ${path}.` };
    }
    next[path] = state[path];
    components.push(path);
  }

  return { state: next, components };
}

export function applyImportExclude(
  state: Record<string, unknown>,
  raw?: string,
): { state: Record<string, unknown>; components: string[] } | { error: string } {
  if (raw === undefined) {
    return {
      state,
      components: Object.keys(state).filter((key) => !IMPORT_METADATA_KEYS.has(key)),
    };
  }

  const parsed = applyExcludePaths(
    {
      personality: true,
      memory: true,
      tools: true,
      preferences: true,
      conversation_history: true,
    },
    raw,
  );
  if ('error' in parsed) {
    return parsed;
  }

  const next: Record<string, unknown> = {};
  for (const key of IMPORT_METADATA_KEYS) {
    if (key in state) {
      next[key] = state[key];
    }
  }

  const components: string[] = [];
  for (const path of INCLUDE_PATHS) {
    if (!parsed.components[path] && !(path in state)) {
      return { error: `Error: Exclude path not in archive: ${path}.` };
    }
    if (parsed.components[path] && path in state) {
      next[path] = state[path];
      components.push(path);
    }
  }

  if (components.length === 0) {
    return { error: 'Error: --exclude matched no remaining components in this archive.' };
  }

  return { state: next, components };
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

  if (components.conversation_history) {
    state.conversation_history = {
      threads: [],
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
  exclude?: string;
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
    try {
      const parentStats = await fs.stat(dirname(out));
      if (!parentStats.isDirectory()) {
        console.error(`Error: Output directory is a file: ${dirname(out)}`);
        return { written: false, out, overwritten: false };
      }
    } catch {
      // Missing parent is reported by writeFile as ENOENT.
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
    } else {
      const includeAll = !options.includePersonality && !options.includeMemory && 
                         !options.includeTools && !options.includePreferences;
      components = {
        personality: includeAll || !!options.includePersonality,
        memory: includeAll || !!options.includeMemory,
        tools: includeAll || !!options.includeTools,
        preferences: includeAll || !!options.includePreferences,
        conversation_history: includeAll,
      };
    }

    const excluded = applyExcludePaths(components, options.exclude);
    if ('error' in excluded) {
      console.error(excluded.error);
      return { written: false, out, overwritten: false };
    }
    components = excluded.components;

    const includedComponents = INCLUDE_PATHS.filter((path) => components[path]);
    const validatedComponents = validateIncludedComponents(includedComponents);
    if ('error' in validatedComponents) {
      console.error(validatedComponents.error);
      return { written: false, out, overwritten: false };
    }
    if (options.include !== undefined || options.exclude !== undefined) {
      console.log(`Including paths: ${validatedComponents.components.join(', ')}`);
    }
    const excludedPaths = listExcludedPaths(options.exclude);
    if (excludedPaths.length > 0) {
      console.log(`Excluding paths: ${excludedPaths.join(', ')}`);
    }

    reportContainerProgress(`Loading state for agent ${agent}`);
    const agentState = await getAgentState(agent, components);
    const plaintext = Buffer.from(agentState);

    const trimmedDescription = description?.trim();
    const formatVersion = 1;
    const created = new Date().toISOString();
    const payloadName = 'agent_state';
    const payloadChecksum = createHash('sha256').update(plaintext).digest('hex');
    const encryptionAlgorithm = 'AES-256-GCM';
    const keyDerivation = 'Argon2id';
    const manifest = {
      formatVersion,
      created,
      agentId: agent,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      encryption: {
        algorithm: encryptionAlgorithm,
        keyDerivation,
      },
      components: validatedComponents.components,
      ...(options.exclude !== undefined
        ? {
            excluded: options.exclude
              .split(',')
              .map((part) => part.trim().toLowerCase())
              .filter((part) => part.length > 0),
          }
        : {}),
      payloads: [
        {
          name: payloadName,
          contentType: 'application/json',
          byteLength: plaintext.length,
          sha256: payloadChecksum,
        },
      ],
    };
    const contentType = manifest.payloads[0].contentType;

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
    console.log(formatExportAgent(agent));
    console.log(formatExportFormatVersion(formatVersion));
    console.log(formatExportCreated(created));
    console.log(formatExportChecksum(payloadChecksum));
    console.log(formatExportSize(plaintext.length));
    console.log(formatExportPayloadName(payloadName));
    console.log(formatExportContentType(contentType));
    if (trimmedDescription) {
      console.log(formatExportDescription(trimmedDescription));
    }
    console.log(formatExportComponents(validatedComponents.components));
    console.log(formatExportEncryption(encryptionAlgorithm));
    console.log(formatExportKeyDerivation(keyDerivation));
    if (excludedPaths.length > 0) {
      console.log(formatExportExcluded(excludedPaths));
    }
    console.log(formatExportOutput(out));
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
  include?: string;
  exclude?: string;
}

export interface ImportResult {
  dryRun: boolean;
  restored: boolean;
  agentId: string;
  mode: RestoreMode;
  created: string;
  components: string[];
  excluded?: string[];
  description?: string;
  encryptionAlgorithm?: string;
  keyDerivation?: string;
  checksum?: string;
  payloadBytes?: number;
  contentType?: string;
  formatVersion?: number;
  payloadName?: string;
  target?: string;
}

export async function importState(options: RestoreOptions): Promise<ImportResult | undefined> {
  try {
    const { in: inFile, passphrase, keyfile } = options;

    if (typeof inFile !== 'string' || inFile.trim() === '') {
      console.error(`Error: Input path must not be empty: ${JSON.stringify(inFile)}.`);
      return undefined;
    }

    const included = parseIncludePaths(options.include);
    if ('error' in included) {
      console.error(included.error);
      return undefined;
    }

    let excluded = included.components;
    if (options.exclude !== undefined) {
      const parsed = applyExcludePaths(included.components, options.exclude);
      if ('error' in parsed) {
        console.error(parsed.error);
        return undefined;
      }
      excluded = parsed.components;
    }

    if (options.target !== undefined) {
      if (typeof options.target !== 'string' || options.target.trim() === '') {
        console.error(`Error: Target path must not be empty: ${JSON.stringify(options.target)}.`);
        return undefined;
      }
      try {
        const targetStats = await fs.stat(options.target);
        if (targetStats.isFile()) {
          console.error(`Error: Target path is a file: ${options.target}`);
          return undefined;
        }
      } catch {
        try {
          const parentStats = await fs.stat(dirname(options.target));
          if (!parentStats.isDirectory()) {
            console.error(`Error: Target directory is a file: ${dirname(options.target)}`);
            return undefined;
          }
        } catch {
        }
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
      console.error(`Error: Input path not found: ${inFile}`);
      return undefined;
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

    let listedComponents: IncludePath[] | undefined;
    if (manifest && typeof manifest === 'object' && 'components' in manifest) {
      const validated = validateIncludedComponents(manifest.components);
      if ('error' in validated) {
        console.error(validated.error);
        return undefined;
      }
      listedComponents = validated.components;
      if (options.include !== undefined) {
        for (const path of INCLUDE_PATHS) {
          if (included.components[path] && !validated.components.includes(path)) {
            console.error(`Error: Include path not in archive: ${path}.`);
            return undefined;
          }
        }
      }
      if (options.exclude !== undefined) {
        for (const path of INCLUDE_PATHS) {
          if (!excluded[path] && !validated.components.includes(path)) {
            console.error(`Error: Exclude path not in archive: ${path}.`);
            return undefined;
          }
        }
      }
    }

    let excludedComponents: IncludePath[] | undefined;
    if (manifest && typeof manifest === 'object' && 'excluded' in manifest) {
      const validatedExcluded = validateExcludedComponents(manifest.excluded);
      if ('error' in validatedExcluded) {
        console.error(validatedExcluded.error);
        return undefined;
      }
      excludedComponents = validatedExcluded.excluded;
      if (listedComponents) {
        const listed = listedComponents;
        const overlap = validatedExcluded.excluded.find((path) => listed.includes(path));
        if (overlap) {
          console.error(`Error: excluded path is listed: ${overlap}`);
          return undefined;
        }
      }
    }

    // 2. Decrypt and verify
    const encryptedState = fileBuffer.subarray(manifestEnd);
    reportContainerProgress('Decrypting agent state', encryptedState.length);
    let decryptedState: Buffer;
    try {
      decryptedState = await decrypt(encryptedState, keySource);
    } catch {
      console.error('Error: Decryption failed. The passphrase or keyfile may be incorrect.');
      const agentId = typeof manifest.agentId === 'string' ? manifest.agentId.trim() : '';
      if (agentId) {
        console.error(formatImportAgent(agentId));
      }
      const formatVersion =
        typeof manifest.formatVersion === 'number' && Number.isFinite(manifest.formatVersion)
          ? manifest.formatVersion
          : undefined;
      if (formatVersion !== undefined) {
        console.error(formatImportFormatVersion(formatVersion));
      }
      const created = typeof manifest.created === 'string' ? manifest.created.trim() : '';
      if (created) {
        console.error(formatImportCreated(created));
      }
      return undefined;
    }
    
    const payload = manifest.payloads.find((p: any) => p.name === 'agent_state');
    if (!payload) {
      console.error('Error: Invalid container - no agent state found.');
      process.exit(1);
    }
    const contentType =
      typeof payload.contentType === 'string' && payload.contentType.trim() !== ''
        ? payload.contentType.trim()
        : undefined;

    reportContainerProgress('Verifying integrity', decryptedState.length);
    const calculatedHash = createHash('sha256').update(decryptedState).digest('hex');
    if (calculatedHash !== payload.sha256) {
      console.error('Error: Integrity check failed. The file may be corrupted or tampered with.');
      const agentId = typeof manifest.agentId === 'string' ? manifest.agentId.trim() : '';
      if (agentId) {
        console.error(formatImportAgent(agentId));
      }
      const formatVersion =
        typeof manifest.formatVersion === 'number' && Number.isFinite(manifest.formatVersion)
          ? manifest.formatVersion
          : undefined;
      if (formatVersion !== undefined) {
        console.error(formatImportFormatVersion(formatVersion));
      }
      const created = typeof manifest.created === 'string' ? manifest.created.trim() : '';
      if (created) {
        console.error(formatImportCreated(created));
      }
      process.exit(1);
    }
    
    let stateText = decryptedState.toString();
    let parsedState = JSON.parse(stateText) as Record<string, unknown>;
    if (listedComponents) {
      const packed = Object.keys(parsedState).filter((key) => !IMPORT_METADATA_KEYS.has(key));
      const missing = missingPackedComponent(listedComponents, packed);
      if (missing) {
        console.error(`Error: component not packed: ${missing}`);
        return undefined;
      }
      const extra = packed.find((path) => !listedComponents.includes(path as IncludePath));
      if (extra) {
        console.error(`Error: packed path not listed: ${extra}`);
        return undefined;
      }
    }
    if (excludedComponents) {
      const packedExclusion = excludedComponents.find((path) =>
        Object.prototype.hasOwnProperty.call(parsedState, path),
      );
      if (packedExclusion) {
        console.error(`Error: excluded path is packed: ${packedExclusion}`);
        return undefined;
      }
    }
    const imported = applyImportInclude(parsedState, options.include);
    if ('error' in imported) {
      console.error(imported.error);
      return undefined;
    }
    const selected = applyImportExclude(imported.state, options.exclude);
    if ('error' in selected) {
      console.error(selected.error);
      return undefined;
    }
    if (options.include !== undefined || options.exclude !== undefined) {
      parsedState = selected.state;
      stateText = JSON.stringify(parsedState, null, 2);
      console.log(`Including paths: ${selected.components.join(', ')}`);
    }
    const excludedPaths = listExcludedPaths(options.exclude);
    if (excludedPaths.length > 0) {
      console.log(`Excluding paths: ${excludedPaths.join(', ')}`);
    }
    const components = selected.components;
    const description = optionalImportDescription(manifest.description);
    const encryptionAlgorithm = optionalImportEncryption(manifest.encryption);
    const keyDerivation = optionalImportKeyDerivation(manifest.encryption);
    const formatVersion =
      typeof manifest.formatVersion === 'number' && Number.isFinite(manifest.formatVersion)
        ? manifest.formatVersion
        : undefined;
    const payloadName = optionalImportPayloadName(payload.name);
    const result: ImportResult = {
      dryRun: !!options.dryRun,
      restored: !options.dryRun,
      agentId: manifest.agentId,
      mode,
      created: manifest.created,
      components,
      ...(excludedComponents ? { excluded: excludedComponents } : {}),
      ...(description ? { description } : {}),
      ...(encryptionAlgorithm ? { encryptionAlgorithm } : {}),
      ...(keyDerivation ? { keyDerivation } : {}),
      checksum: calculatedHash,
      payloadBytes: decryptedState.length,
      ...(contentType ? { contentType } : {}),
      ...(formatVersion !== undefined ? { formatVersion } : {}),
      ...(payloadName ? { payloadName } : {}),
    };

    if (options.dryRun) {
      console.log(`\nDRY RUN — no changes will be made`);
      console.log(formatImportAgent(manifest.agentId));
      console.log(formatImportMode(mode));
      console.log(formatImportCreated(manifest.created));
      if (formatVersion !== undefined) {
        console.log(formatImportFormatVersion(formatVersion));
      }
      if (description) {
        console.log(formatImportDescription(description));
      }
      console.log(formatImportComponents(components));
      if (encryptionAlgorithm) {
        console.log(formatImportEncryption(encryptionAlgorithm));
      }
      if (keyDerivation) {
        console.log(formatImportKeyDerivation(keyDerivation));
      }
      if (excludedComponents && excludedComponents.length > 0) {
        console.log(formatImportExcluded(excludedComponents));
      }
      if (contentType) {
        console.log(formatImportContentType(contentType));
      }
      console.log(formatImportChecksum(calculatedHash));
      console.log(formatImportSize(decryptedState.length));
      if (payloadName) {
        console.log(formatImportPayloadName(payloadName));
      }
      console.log(formatImportInput(inFile));
      if (options.target) {
        const previewTarget = join(resolve(options.target), TARGET_STATE_FILE);
        result.target = previewTarget;
        console.log(formatImportTarget(previewTarget));
      }
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
    console.log(formatImportAgent(manifest.agentId));
    console.log(formatImportMode(mode));
    console.log(formatImportCreated(manifest.created));
    if (formatVersion !== undefined) {
      console.log(formatImportFormatVersion(formatVersion));
    }
    if (description) {
      console.log(formatImportDescription(description));
    }
    console.log(formatImportComponents(components));
    if (encryptionAlgorithm) {
      console.log(formatImportEncryption(encryptionAlgorithm));
    }
    if (keyDerivation) {
      console.log(formatImportKeyDerivation(keyDerivation));
    }
    if (excludedComponents && excludedComponents.length > 0) {
      console.log(formatImportExcluded(excludedComponents));
    }
    if (contentType) {
      console.log(formatImportContentType(contentType));
    }
    console.log(formatImportChecksum(calculatedHash));
    console.log(formatImportSize(decryptedState.length));
    if (payloadName) {
      console.log(formatImportPayloadName(payloadName));
    }
    console.log(formatImportInput(inFile));
    if (targetPath) {
      console.log(formatImportTarget(targetPath));
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
    .option('--include <paths>', 'Comma-separated state paths to include (personality,memory,tools,preferences,conversation_history)')
    .option('--exclude <paths>', 'Comma-separated state paths to exclude (personality,memory,tools,preferences,conversation_history)')
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
        exclude: opts.exclude,
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
    .option('--include <paths>', 'Comma-separated state paths to restore (personality,memory,tools,preferences,conversation_history)')
    .option('--exclude <paths>', 'Comma-separated state paths to skip (personality,memory,tools,preferences,conversation_history)')
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
        include: opts.include,
        exclude: opts.exclude,
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
    .option('--include <paths>', 'Comma-separated state paths to include (personality,memory,tools,preferences,conversation_history)')
    .option('--exclude <paths>', 'Comma-separated state paths to exclude (personality,memory,tools,preferences,conversation_history)')
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
        exclude: opts.exclude,
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
    .option('--include <paths>', 'Comma-separated state paths to restore (personality,memory,tools,preferences,conversation_history)')
    .option('--exclude <paths>', 'Comma-separated state paths to skip (personality,memory,tools,preferences,conversation_history)')
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
        include: opts.include,
        exclude: opts.exclude,
      });
      if (!result) {
        process.exit(1);
      }
    });
}
