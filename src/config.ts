/**
 * SaveState Configuration
 *
 * Manages .savestate/config.json in the current project directory.
 * Also supports global config at ~/.savestate/config.json.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { SaveStateConfig } from './types.js';

/** Directory name for local SaveState config */
export const SAVESTATE_DIR = '.savestate';

/** Config filename */
export const CONFIG_FILE = 'config.json';

/** Global SaveState home directory */
export const GLOBAL_SAVESTATE_DIR = join(homedir(), '.savestate');

/**
 * Default configuration for new projects.
 */
export function defaultConfig(): SaveStateConfig {
  return {
    version: '0.1.0',
    storage: {
      type: 'local',
      options: {
        path: GLOBAL_SAVESTATE_DIR,
      },
    },
    adapters: [],
    memory: {
      approvalMode: 'threshold',
      confidenceThreshold: 0.7,
      // Issue #110: TTL policy defaults
      ttl: {
        enabled: false,
        defaultDays: null,
        decayEnabled: false,
      },
    },
    // Issue #107: MCP server defaults
    mcp: {
      enabled: false,
      port: 3333,
      auth: {
        type: 'none',
      },
    },
  };
}

/**
 * Resolve the local .savestate directory for the current project.
 */
export function localConfigDir(cwd?: string): string {
  return join(resolve(cwd ?? process.cwd()), SAVESTATE_DIR);
}

/**
 * Resolve the path to the local config file.
 */
export function localConfigPath(cwd?: string): string {
  return join(localConfigDir(cwd), CONFIG_FILE);
}

/**
 * Check if SaveState is initialized in the given directory.
 */
export function isInitialized(cwd?: string): boolean {
  return existsSync(localConfigPath(cwd));
}

/**
 * Load the SaveState config from the local .savestate/ directory.
 * Falls back to global config if local doesn't exist.
 */
export async function loadConfig(cwd?: string): Promise<SaveStateConfig> {
  const localPath = localConfigPath(cwd);
  const globalPath = join(GLOBAL_SAVESTATE_DIR, CONFIG_FILE);

  for (const configPath of [localPath, globalPath]) {
    if (existsSync(configPath)) {
      const raw = await readFile(configPath, 'utf-8');
      return JSON.parse(raw) as SaveStateConfig;
    }
  }

  return defaultConfig();
}

/**
 * Save the SaveState config to the local .savestate/ directory.
 */
export async function saveConfig(config: SaveStateConfig, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Initialize SaveState in the given directory.
 * Creates .savestate/ and writes default config.
 */
export async function initializeProject(cwd?: string): Promise<SaveStateConfig> {
  const config = defaultConfig();
  await saveConfig(config, cwd);
  return config;
}
