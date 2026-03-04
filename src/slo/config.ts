/**
 * SLO Configuration Management
 *
 * Handles loading, saving, and merging SLO configuration.
 * Implements Issue #108.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';
import {
  SLOConfig,
  DEFAULT_SLO_CONFIG,
  FreshnessSLO,
  DEFAULT_FRESHNESS_SLO,
} from './types.js';

/** SLO config filename */
const SLO_CONFIG_FILE = 'slo.json';

/**
 * Load SLO configuration from disk.
 * Returns defaults if no config exists.
 */
export async function loadSLOConfig(cwd?: string): Promise<SLOConfig> {
  const configPath = join(localConfigDir(cwd), SLO_CONFIG_FILE);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_SLO_CONFIG };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as Partial<SLOConfig>;
    return mergeSLOConfig(config);
  } catch {
    return { ...DEFAULT_SLO_CONFIG };
  }
}

/**
 * Save SLO configuration to disk.
 */
export async function saveSLOConfig(config: SLOConfig, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, SLO_CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Merge partial config with defaults.
 */
export function mergeSLOConfig(partial: Partial<SLOConfig>): SLOConfig {
  return {
    freshness: mergeFreshnessSLO(partial.freshness),
    enabled: partial.enabled ?? DEFAULT_SLO_CONFIG.enabled,
    alert_threshold_percent: partial.alert_threshold_percent ?? DEFAULT_SLO_CONFIG.alert_threshold_percent,
    evaluation_interval_minutes: partial.evaluation_interval_minutes ?? DEFAULT_SLO_CONFIG.evaluation_interval_minutes,
  };
}

/**
 * Merge partial freshness SLO with defaults.
 */
export function mergeFreshnessSLO(partial?: Partial<FreshnessSLO>): FreshnessSLO {
  if (!partial) return { ...DEFAULT_FRESHNESS_SLO };

  return {
    max_age_hours: partial.max_age_hours ?? DEFAULT_FRESHNESS_SLO.max_age_hours,
    relevance_threshold: partial.relevance_threshold ?? DEFAULT_FRESHNESS_SLO.relevance_threshold,
    recall_target_percent: partial.recall_target_percent ?? DEFAULT_FRESHNESS_SLO.recall_target_percent,
  };
}

/**
 * Validate SLO configuration values.
 */
export function validateSLOConfig(config: SLOConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Freshness validation
  if (config.freshness.max_age_hours <= 0) {
    errors.push('freshness.max_age_hours must be positive');
  }
  if (config.freshness.relevance_threshold < 0 || config.freshness.relevance_threshold > 1) {
    errors.push('freshness.relevance_threshold must be between 0 and 1');
  }
  if (config.freshness.recall_target_percent < 0 || config.freshness.recall_target_percent > 100) {
    errors.push('freshness.recall_target_percent must be between 0 and 100');
  }

  // Alert threshold validation
  if (config.alert_threshold_percent < 0 || config.alert_threshold_percent > 100) {
    errors.push('alert_threshold_percent must be between 0 and 100');
  }

  // Evaluation interval validation
  if (config.evaluation_interval_minutes <= 0) {
    errors.push('evaluation_interval_minutes must be positive');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get SLO config value by path (for CLI).
 * Supports dot notation: "freshness.max_age_hours"
 */
export function getSLOConfigValue(config: SLOConfig, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set SLO config value by path (for CLI).
 * Returns a new config object.
 */
export function setSLOConfigValue(
  config: SLOConfig,
  path: string,
  value: unknown,
): SLOConfig {
  const result = JSON.parse(JSON.stringify(config)) as SLOConfig;
  const parts = path.split('.');
  let current: Record<string, unknown> = result as unknown as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;

  return result;
}

/**
 * Convert hours to a human-readable duration string.
 */
export function formatDuration(hours: number): string {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

/**
 * Parse a duration string to hours.
 * Supports: "24h", "7d", "30d", "1w"
 */
export function parseDuration(duration: string): number | null {
  const match = duration.trim().match(/^(\d+(?:\.\d+)?)\s*(h|d|w)$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'h':
      return value;
    case 'd':
      return value * 24;
    case 'w':
      return value * 24 * 7;
    default:
      return null;
  }
}
