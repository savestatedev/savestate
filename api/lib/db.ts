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

  // ─── Team-tier tables ──────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      owner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
      invited_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_team_members_account ON team_members(account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      actor_account_id UUID,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_log_team_created
      ON audit_log(team_id, created_at DESC)
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

// ─── Team Operations ──────────────────────────────────────────

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  owner_account_id: string;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  account_id: string | null;
  email: string;
  role: TeamRole;
  invited_at: string;
  accepted_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  team_id: string;
  actor_account_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Look up an account by email.
 */
export async function getAccountByEmail(email: string): Promise<Account | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM accounts WHERE email = ${email}
  `;
  return result.length > 0 ? (result[0] as unknown as Account) : null;
}

/**
 * Create a new team and seat the calling owner as the first member.
 */
export async function createTeam(params: {
  name: string;
  ownerAccountId: string;
  ownerEmail: string;
  stripeSubscriptionId?: string | null;
}): Promise<Team> {
  const sql = getDb();
  const inserted = await sql`
    INSERT INTO teams (name, owner_account_id, stripe_subscription_id)
    VALUES (${params.name}, ${params.ownerAccountId}::uuid, ${params.stripeSubscriptionId ?? null})
    RETURNING *
  `;
  const team = inserted[0] as unknown as Team;

  // Seat the owner as a member with accepted_at = now
  await sql`
    INSERT INTO team_members (team_id, account_id, email, role, accepted_at)
    VALUES (${team.id}::uuid, ${params.ownerAccountId}::uuid, ${params.ownerEmail}, 'owner', NOW())
  `;

  return team;
}

/**
 * Find the team that an account owns or is a member of.
 * Returns the first match (an account is expected to belong to at most one team for this iteration).
 */
export async function getTeamForAccount(accountId: string): Promise<Team | null> {
  const sql = getDb();
  const result = await sql`
    SELECT t.* FROM teams t
    LEFT JOIN team_members m ON m.team_id = t.id
    WHERE t.owner_account_id = ${accountId}::uuid
       OR m.account_id = ${accountId}::uuid
    LIMIT 1
  `;
  return result.length > 0 ? (result[0] as unknown as Team) : null;
}

/**
 * Look up a team by id.
 */
export async function getTeamById(teamId: string): Promise<Team | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM teams WHERE id = ${teamId}::uuid
  `;
  return result.length > 0 ? (result[0] as unknown as Team) : null;
}

/**
 * Add a member (or pending invite) to a team.
 * If an account with that email already exists, link account_id; otherwise leave null until they sign up.
 */
export async function addTeamMember(params: {
  teamId: string;
  email: string;
  role: TeamRole;
}): Promise<TeamMember> {
  const sql = getDb();
  const account = await getAccountByEmail(params.email);

  const inserted = account
    ? await sql`
        INSERT INTO team_members (team_id, account_id, email, role)
        VALUES (${params.teamId}::uuid, ${account.id}::uuid, ${params.email}, ${params.role})
        RETURNING *
      `
    : await sql`
        INSERT INTO team_members (team_id, account_id, email, role)
        VALUES (${params.teamId}::uuid, NULL, ${params.email}, ${params.role})
        RETURNING *
      `;
  return inserted[0] as unknown as TeamMember;
}

/**
 * List all members of a team.
 */
export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM team_members
    WHERE team_id = ${teamId}::uuid
    ORDER BY invited_at ASC
  `;
  return result as unknown as TeamMember[];
}

/**
 * Look up a single team member by account id within a team.
 */
export async function getTeamMember(teamId: string, accountId: string): Promise<TeamMember | null> {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM team_members
    WHERE team_id = ${teamId}::uuid AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  return result.length > 0 ? (result[0] as unknown as TeamMember) : null;
}

/**
 * Remove a member from a team by account_id.
 */
export async function removeTeamMember(teamId: string, accountId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM team_members
    WHERE team_id = ${teamId}::uuid AND account_id = ${accountId}::uuid
    RETURNING id
  `;
  return result.length > 0;
}

/**
 * Append an audit-log row.
 */
export async function appendAuditLog(params: {
  teamId: string;
  actorAccountId: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const sql = getDb();
  const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null;

  if (params.actorAccountId) {
    await sql`
      INSERT INTO audit_log (team_id, actor_account_id, action, resource_type, resource_id, metadata)
      VALUES (
        ${params.teamId}::uuid,
        ${params.actorAccountId}::uuid,
        ${params.action},
        ${params.resourceType ?? null},
        ${params.resourceId ?? null},
        ${metadataJson}::jsonb
      )
    `;
  } else {
    await sql`
      INSERT INTO audit_log (team_id, actor_account_id, action, resource_type, resource_id, metadata)
      VALUES (
        ${params.teamId}::uuid,
        NULL,
        ${params.action},
        ${params.resourceType ?? null},
        ${params.resourceId ?? null},
        ${metadataJson}::jsonb
      )
    `;
  }
}

/**
 * Query the audit log for a team. Caller is responsible for authorization.
 *
 * Pagination: results are ordered by created_at DESC (id DESC tiebreak). Pass a
 * `cursor` from a prior page (the last row's id, ISO timestamp tuple) to get
 * the next slice. Returns at most `limit` rows.
 */
export async function queryAuditLog(params: {
  teamId: string;
  since?: Date | null;
  until?: Date | null;
  limit: number;
  cursorCreatedAt?: Date | null;
  cursorId?: string | null;
}): Promise<AuditLogEntry[]> {
  const sql = getDb();
  const since = params.since ? params.since.toISOString() : null;
  const until = params.until ? params.until.toISOString() : null;
  const cursorCreatedAt = params.cursorCreatedAt ? params.cursorCreatedAt.toISOString() : null;
  const cursorId = params.cursorId ?? null;

  const result = await sql`
    SELECT * FROM audit_log
    WHERE team_id = ${params.teamId}::uuid
      AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
      AND (${until}::timestamptz IS NULL OR created_at <= ${until}::timestamptz)
      AND (
        ${cursorCreatedAt}::timestamptz IS NULL
        OR (created_at, id) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT ${params.limit}
  `;
  return result as unknown as AuditLogEntry[];
}
