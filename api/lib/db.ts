/**
 * SaveState Account Database
 *
 * Uses Turso (libSQL) for edge-distributed SQLite.
 * Stores accounts, API keys, and subscription status.
 */

import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

/**
 * Initialize the database schema.
 */
export async function initDb(): Promise<void> {
  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      api_key TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_status TEXT DEFAULT 'inactive',
      storage_used_bytes INTEGER DEFAULT 0,
      storage_limit_bytes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_accounts_api_key ON accounts(api_key)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id)
  `);
}

// ─── Account Operations ──────────────────────────────────────

export interface Account {
  id: string;
  email: string;
  name: string | null;
  api_key: string;
  tier: 'free' | 'pro' | 'team';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a secure API key.
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'ss_live_';
  let key = '';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    key += chars[b % chars.length];
  }
  return prefix + key;
}

/**
 * Storage limits by tier.
 */
export const TIER_LIMITS: Record<string, number> = {
  free: 0,                          // No cloud storage
  pro: 10 * 1024 * 1024 * 1024,    // 10 GB
  team: 50 * 1024 * 1024 * 1024,   // 50 GB
};

/**
 * Create a new account from a Stripe checkout.
 */
export async function createAccount(params: {
  email: string;
  name?: string;
  tier: 'pro' | 'team';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<Account> {
  const db = getDb();
  const apiKey = generateApiKey();
  const storageLimit = TIER_LIMITS[params.tier] || 0;

  // Check if account already exists (upgrade case)
  const existing = await db.execute({
    sql: 'SELECT * FROM accounts WHERE email = ?',
    args: [params.email],
  });

  if (existing.rows.length > 0) {
    // Upgrade existing account
    await db.execute({
      sql: `UPDATE accounts SET 
        tier = ?, 
        stripe_customer_id = ?, 
        stripe_subscription_id = ?,
        stripe_status = 'active',
        storage_limit_bytes = ?,
        updated_at = datetime('now')
      WHERE email = ?`,
      args: [params.tier, params.stripeCustomerId, params.stripeSubscriptionId, storageLimit, params.email],
    });

    const updated = await db.execute({
      sql: 'SELECT * FROM accounts WHERE email = ?',
      args: [params.email],
    });
    return updated.rows[0] as unknown as Account;
  }

  // Create new account
  await db.execute({
    sql: `INSERT INTO accounts (email, name, api_key, tier, stripe_customer_id, stripe_subscription_id, stripe_status, storage_limit_bytes)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [params.email, params.name || null, apiKey, params.tier, params.stripeCustomerId, params.stripeSubscriptionId, storageLimit],
  });

  const result = await db.execute({
    sql: 'SELECT * FROM accounts WHERE email = ?',
    args: [params.email],
  });
  return result.rows[0] as unknown as Account;
}

/**
 * Look up an account by API key.
 */
export async function getAccountByApiKey(apiKey: string): Promise<Account | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM accounts WHERE api_key = ?',
    args: [apiKey],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Account) : null;
}

/**
 * Look up an account by Stripe customer ID.
 */
export async function getAccountByStripeCustomer(customerId: string): Promise<Account | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM accounts WHERE stripe_customer_id = ?',
    args: [customerId],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Account) : null;
}

/**
 * Update subscription status (from webhook events).
 */
export async function updateSubscriptionStatus(
  stripeCustomerId: string,
  status: string,
  tier?: string,
): Promise<void> {
  const db = getDb();

  const updates = [`stripe_status = ?`, `updated_at = datetime('now')`];
  const args: (string | number)[] = [status];

  if (tier) {
    updates.push('tier = ?');
    updates.push('storage_limit_bytes = ?');
    args.push(tier);
    args.push(TIER_LIMITS[tier] || 0);
  }

  // Handle cancellation: downgrade to free
  if (status === 'canceled' || status === 'unpaid') {
    updates.push("tier = 'free'");
    updates.push('storage_limit_bytes = 0');
  }

  args.push(stripeCustomerId);

  await db.execute({
    sql: `UPDATE accounts SET ${updates.join(', ')} WHERE stripe_customer_id = ?`,
    args,
  });
}

/**
 * Update storage usage for an account.
 */
export async function updateStorageUsage(apiKey: string, bytesUsed: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `UPDATE accounts SET storage_used_bytes = ?, updated_at = datetime('now') WHERE api_key = ?`,
    args: [bytesUsed, apiKey],
  });
}
