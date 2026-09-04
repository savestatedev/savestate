import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatMigrateListJson,
  listMigratePlatforms,
  migrateCommand,
  type MigratePlatformJson,
} from '../migrate.js';

describe('savestate migrate --json', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints platform capabilities as JSON', () => {
    const parsed = JSON.parse(formatMigrateListJson()) as MigratePlatformJson[];
    const ids = parsed.map((platform) => platform.id);
    expect(ids).toEqual(['chatgpt', 'claude', 'gemini', 'copilot']);
    const chatgpt = parsed.find((platform) => platform.id === 'chatgpt');
    const claude = parsed.find((platform) => platform.id === 'claude');
    expect(chatgpt?.name).toBe('ChatGPT');
    expect(chatgpt?.hasMemory).toBe(true);
    expect(chatgpt?.memoryLimit).toBe(100);
    expect(chatgpt?.hasCustomBots).toBe(true);
    expect(claude?.name).toBe('Claude');
    expect(claude?.hasMemory).toBe(false);
    expect(claude?.memoryLimit).toBeNull();
    expect(claude?.hasProjects).toBe(true);
  });

  it('records optional limits as null when a platform omits them', () => {
    const copilot = listMigratePlatforms().find((platform) => platform.id === 'copilot');
    expect(copilot?.memoryLimit).toBeNull();
    expect(copilot?.fileSizeLimit).toBe(10 * 1024 * 1024);
  });

  it('emits JSON and skips the wizard banner when listing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await migrateCommand({ list: true, json: true });
    const printed = log.mock.calls.flat().join('\n');
    const parsed = JSON.parse(printed) as MigratePlatformJson[];
    expect(parsed.map((platform) => platform.id)).toEqual(['chatgpt', 'claude', 'gemini', 'copilot']);
    expect(printed).not.toContain('Migration Wizard');
    expect(printed).not.toContain('Available Platforms');
  });
});
