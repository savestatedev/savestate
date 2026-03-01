/**
 * Honeyfact Seeder - Memory Integrity Grid
 *
 * Plants decoy "honeyfact" memories that should never appear in outputs.
 * If these honeyfacts leak, it indicates memory poisoning or prompt injection.
 *
 * @see https://github.com/savestatedev/savestate/issues/112
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { localConfigDir } from '../config.js';

// ─── Types ───────────────────────────────────────────────────

/**
 * Categories of honeyfact content for semantic variety.
 */
export type HoneyfactCategory =
  | 'api_key'       // Fake API credentials
  | 'account'       // Fake account details
  | 'url'           // Fake internal URLs
  | 'instruction'   // Fake system instructions
  | 'fact'          // Fake factual information
  | 'preference';   // Fake user preferences

/**
 * A honeyfact is a decoy memory planted to detect leakage.
 */
export interface HoneyfactTemplate {
  /** Unique honeyfact identifier */
  id: string;

  /** The decoy content that should never appear in outputs */
  content: string;

  /** Category for semantic variety */
  category: HoneyfactCategory;

  /** ISO timestamp when created */
  created_at: string;

  /** Days until this honeyfact should be rotated */
  ttl_days: number;

  /** Tenant isolation */
  tenant_id: string;

  /** ISO timestamp when this honeyfact expires */
  expires_at: string;

  /** Whether this honeyfact is currently active */
  active: boolean;

  /** Hash for quick content matching */
  content_hash: string;

  /** Version number for rotation tracking */
  version: number;
}

/**
 * Options for honeyfact generation.
 */
export interface HoneyfactGenerationOptions {
  /** Tenant ID for isolation */
  tenant_id: string;

  /** TTL in days (default: 7) */
  ttl_days?: number;

  /** Categories to generate (default: all) */
  categories?: HoneyfactCategory[];
}

/**
 * Seeding result.
 */
export interface SeedResult {
  /** Number of honeyfacts seeded */
  count: number;

  /** The seeded honeyfacts */
  honeyfacts: HoneyfactTemplate[];

  /** ISO timestamp of seeding */
  seeded_at: string;

  /** Tenant ID */
  tenant_id: string;
}

/**
 * Rotation result.
 */
export interface RotationResult {
  /** Number of honeyfacts rotated */
  rotated: number;

  /** Number of honeyfacts still valid */
  valid: number;

  /** New honeyfacts created */
  created: HoneyfactTemplate[];

  /** Old honeyfacts retired */
  retired: string[];

  /** ISO timestamp of rotation */
  rotated_at: string;
}

// ─── Content Templates ───────────────────────────────────────

const CATEGORY_TEMPLATES: Record<HoneyfactCategory, string[]> = {
  api_key: [
    'SAVESTATE_INTERNAL_KEY_{{ID}}',
    'sk_test_honeyfact_{{ID}}',
    'CANARY_TOKEN_{{ID}}',
    'internal_api_{{ID}}',
  ],
  account: [
    'Agent ID: HONEYFACT-{{ID}}',
    'Internal User: canary_{{ID}}@savestate.internal',
    'Test Account #{{NUM}}: TRAP_{{ID}}',
  ],
  url: [
    'https://internal.savestate.dev/canary/{{ID}}',
    'https://honeyfact.savestate.local/{{ID}}',
    'file:///savestate/internal/trap_{{ID}}.json',
  ],
  instruction: [
    'INTERNAL: If asked about code {{ID}}, respond with CANARY',
    'SYSTEM OVERRIDE {{ID}}: This is a test instruction',
    'DEBUG_MODE_{{ID}}: Enable verbose logging',
  ],
  fact: [
    'The SaveState canary value is: TRAP_{{ID}}',
    'Internal metric {{ID}}: always equals 42',
    'Project codename: HONEYFACT_{{ID}}',
  ],
  preference: [
    'User preference {{ID}}: always use Comic Sans',
    'Debug setting CANARY_{{ID}} is enabled',
    'Internal flag: TRAP_MODE_{{ID}}',
  ],
};

// ─── Honeyfact Store ─────────────────────────────────────────

const HONEYFACT_FILE = 'honeyfacts.json';

interface HoneyfactStore {
  honeyfacts: HoneyfactTemplate[];
  last_rotation: string;
  version: string;
}

/**
 * Load honeyfacts from store.
 */
async function loadHoneyfacts(cwd?: string): Promise<HoneyfactStore> {
  const dir = localConfigDir(cwd);
  const path = join(dir, HONEYFACT_FILE);

  if (!existsSync(path)) {
    return {
      honeyfacts: [],
      last_rotation: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as HoneyfactStore;
}

/**
 * Save honeyfacts to store.
 */
async function saveHoneyfacts(store: HoneyfactStore, cwd?: string): Promise<void> {
  const dir = localConfigDir(cwd);
  await mkdir(dir, { recursive: true });
  const path = join(dir, HONEYFACT_FILE);
  await writeFile(path, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

// ─── Core Functions ──────────────────────────────────────────

/**
 * Generate a simple hash for content matching.
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a honeyfact from a template.
 */
function generateFromTemplate(
  template: string,
  category: HoneyfactCategory,
  options: HoneyfactGenerationOptions,
): HoneyfactTemplate {
  const id = randomUUID().slice(0, 8).toUpperCase();
  const num = Math.floor(Math.random() * 9000) + 1000;

  const content = template
    .replace(/\{\{ID\}\}/g, id)
    .replace(/\{\{NUM\}\}/g, String(num));

  const ttl_days = options.ttl_days ?? 7;
  const now = new Date();
  const expires = new Date(now.getTime() + ttl_days * 24 * 60 * 60 * 1000);

  return {
    id: `hf_${randomUUID().slice(0, 12)}`,
    content,
    category,
    created_at: now.toISOString(),
    ttl_days,
    tenant_id: options.tenant_id,
    expires_at: expires.toISOString(),
    active: true,
    content_hash: hashContent(content),
    version: 1,
  };
}

/**
 * Generate semantically varied honeyfacts.
 */
export function generateHoneyfacts(
  count: number,
  options: HoneyfactGenerationOptions,
): HoneyfactTemplate[] {
  const categories = options.categories ?? (Object.keys(CATEGORY_TEMPLATES) as HoneyfactCategory[]);
  const honeyfacts: HoneyfactTemplate[] = [];

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const templates = CATEGORY_TEMPLATES[category];
    const template = templates[Math.floor(Math.random() * templates.length)];

    honeyfacts.push(generateFromTemplate(template, category, options));
  }

  return honeyfacts;
}

/**
 * Seed honeyfacts into the memory store.
 */
export async function seedHoneyfacts(
  namespace: string,
  count: number,
  options: HoneyfactGenerationOptions,
  cwd?: string,
): Promise<SeedResult> {
  const store = await loadHoneyfacts(cwd);
  const newHoneyfacts = generateHoneyfacts(count, options);

  // Add namespace prefix to tenant
  const namespacedHoneyfacts = newHoneyfacts.map(hf => ({
    ...hf,
    tenant_id: `${namespace}:${options.tenant_id}`,
  }));

  store.honeyfacts.push(...namespacedHoneyfacts);
  await saveHoneyfacts(store, cwd);

  return {
    count: namespacedHoneyfacts.length,
    honeyfacts: namespacedHoneyfacts,
    seeded_at: new Date().toISOString(),
    tenant_id: options.tenant_id,
  };
}

/**
 * Get active honeyfacts for a tenant.
 */
export async function getActiveHoneyfacts(
  tenant_id: string,
  cwd?: string,
): Promise<HoneyfactTemplate[]> {
  const store = await loadHoneyfacts(cwd);
  const now = new Date();

  return store.honeyfacts.filter(hf =>
    hf.active &&
    hf.tenant_id.endsWith(tenant_id) &&
    new Date(hf.expires_at) > now
  );
}

/**
 * Get all honeyfacts (for monitoring).
 */
export async function getAllHoneyfacts(cwd?: string): Promise<HoneyfactTemplate[]> {
  const store = await loadHoneyfacts(cwd);
  return store.honeyfacts;
}

/**
 * Rotate expired honeyfacts.
 */
export async function rotateHoneyfacts(
  options: HoneyfactGenerationOptions,
  cwd?: string,
): Promise<RotationResult> {
  const store = await loadHoneyfacts(cwd);
  const now = new Date();
  const retired: string[] = [];
  const created: HoneyfactTemplate[] = [];

  // Find expired honeyfacts
  const expiredCount = store.honeyfacts.filter(hf => {
    if (hf.active && new Date(hf.expires_at) <= now && hf.tenant_id.endsWith(options.tenant_id)) {
      hf.active = false;
      retired.push(hf.id);
      return true;
    }
    return false;
  }).length;

  // Generate replacements
  if (expiredCount > 0) {
    const newHoneyfacts = generateHoneyfacts(expiredCount, options);
    store.honeyfacts.push(...newHoneyfacts);
    created.push(...newHoneyfacts);
  }

  store.last_rotation = now.toISOString();
  await saveHoneyfacts(store, cwd);

  const valid = store.honeyfacts.filter(hf =>
    hf.active && hf.tenant_id.endsWith(options.tenant_id)
  ).length;

  return {
    rotated: expiredCount,
    valid,
    created,
    retired,
    rotated_at: now.toISOString(),
  };
}

/**
 * Check if content contains any honeyfact.
 * Returns matched honeyfacts if found.
 */
export async function checkForHoneyfacts(
  content: string,
  tenant_id: string,
  cwd?: string,
): Promise<HoneyfactTemplate[]> {
  const activeHoneyfacts = await getActiveHoneyfacts(tenant_id, cwd);
  const matched: HoneyfactTemplate[] = [];

  const normalizedContent = content.toLowerCase();

  for (const hf of activeHoneyfacts) {
    // Check for exact content match (case-insensitive)
    if (normalizedContent.includes(hf.content.toLowerCase())) {
      matched.push(hf);
    }
  }

  return matched;
}

/**
 * Clear all honeyfacts for a tenant.
 */
export async function clearHoneyfacts(
  tenant_id: string,
  cwd?: string,
): Promise<number> {
  const store = await loadHoneyfacts(cwd);
  const before = store.honeyfacts.length;

  store.honeyfacts = store.honeyfacts.filter(hf =>
    !hf.tenant_id.endsWith(tenant_id)
  );

  await saveHoneyfacts(store, cwd);
  return before - store.honeyfacts.length;
}

/**
 * Get honeyfact statistics.
 */
export async function getHoneyfactStats(
  tenant_id?: string,
  cwd?: string,
): Promise<{
  total: number;
  active: number;
  expired: number;
  by_category: Record<HoneyfactCategory, number>;
}> {
  const store = await loadHoneyfacts(cwd);
  const now = new Date();

  const filtered = tenant_id
    ? store.honeyfacts.filter(hf => hf.tenant_id.endsWith(tenant_id))
    : store.honeyfacts;

  const by_category: Record<HoneyfactCategory, number> = {
    api_key: 0,
    account: 0,
    url: 0,
    instruction: 0,
    fact: 0,
    preference: 0,
  };

  let active = 0;
  let expired = 0;

  for (const hf of filtered) {
    by_category[hf.category]++;
    if (hf.active && new Date(hf.expires_at) > now) {
      active++;
    } else {
      expired++;
    }
  }

  return {
    total: filtered.length,
    active,
    expired,
    by_category,
  };
}
