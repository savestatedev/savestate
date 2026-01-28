/**
 * SaveState Account Database
 *
 * Uses Neon (serverless Postgres) via Vercel integration.
 * Stores accounts, API keys, and subscription status.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable is required');
    }
    _sql = neon(url);
  }
  return _sql;
}

/**
 * Initialize the database schema.
 */
export async function initDb(): Promise<void> {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      api_key TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      stripe_status TEXT DEFAULT 'inactive',
      storage_used_bytes BIGINT DEFAULT 0,
      storage_limit_bytes BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounts_api_key ON accounts(api_key)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id)
  `;
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
  const sql = getDb();
  const apiKey = generateApiKey();
  const storageLimit = TIER_LIMITS[params.tier] || 0;

  // Check if account already exists (upgrade case)
  const existing = await sql`
    SELECT * FROM accounts WHERE email = ${params.email}
  `;

  if (existing.length > 0) {
    // Upgrade existing account
    const updated = await sql`
      UPDATE accounts SET 
        tier = ${params.tier}, 
        stripe_customer_id = ${params.stripeCustomerId}, 
        stripe_subscription_id = ${params.stripeSubscriptionId},
        stripe_status = 'active',
        storage_limit_bytes = ${storageLimit},
        updated_at = NOW()
      WHERE email = ${params.email}
      RETURNING *
    `;
    return updated[0] as unknown as Account;
  }

  // Create new account
  const result = await sql`
    INSERT INTO accounts (email, name, api_key, tier, stripe_customer_id, stripe_subscription_id, stripe_status, storage_limit_bytes)
    VALUES (${params.email}, ${params.name || null}, ${apiKey}, ${params.tier}, ${params.stripeCustomerId}, ${params.stripeSubscriptionId}, 'active', ${storageLimit})
    RETURNING *
  `;
  return result[0] as unknown as Account;
}

/**
 * Look up an account by API key.
 */
export async function getAccountByApiKey(apiKey: string): Promise<Account | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM accounts WHERE api_key = ${apiKey}
  `;
  return result.length > 0 ? (result[0] as unknown as Account) : null;
}

/**
 * Look up an account by Stripe customer ID.
 */
export async function getAccountByStripeCustomer(customerId: string): Promise<Account | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM accounts WHERE stripe_customer_id = ${customerId}
  `;
  return result.length > 0 ? (result[0] as unknown as Account) : null;
}

/**
 * Update subscription status (from webhook events).
 */
export async function updateSubscriptionStatus(
  stripeCustomerId: string,
  status: string,
  tier?: string,
): Promise<void> {
  const sql = getDb();

  if (status === 'canceled' || status === 'unpaid') {
    // Downgrade to free on cancellation
    await sql`
      UPDATE accounts SET 
        stripe_status = ${status},
        tier = 'free',
        storage_limit_bytes = 0,
        updated_at = NOW()
      WHERE stripe_customer_id = ${stripeCustomerId}
    `;
  } else if (tier) {
    const storageLimit = TIER_LIMITS[tier] || 0;
    await sql`
      UPDATE accounts SET 
        stripe_status = ${status},
        tier = ${tier},
        storage_limit_bytes = ${storageLimit},
        updated_at = NOW()
      WHERE stripe_customer_id = ${stripeCustomerId}
    `;
  } else {
    await sql`
      UPDATE accounts SET 
        stripe_status = ${status},
        updated_at = NOW()
      WHERE stripe_customer_id = ${stripeCustomerId}
    `;
  }
}

/**
 * Update storage usage for an account (by API key).
 */
export async function updateStorageUsage(apiKey: string, bytesUsed: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE accounts SET 
      storage_used_bytes = ${bytesUsed}, 
      updated_at = NOW() 
    WHERE api_key = ${apiKey}
  `;
}

/**
 * Update storage usage for an account (by account ID).
 */
export async function updateStorageUsageById(accountId: string, bytesUsed: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE accounts SET 
      storage_used_bytes = ${bytesUsed}, 
      updated_at = NOW() 
    WHERE id = ${accountId}::uuid
  `;
}
