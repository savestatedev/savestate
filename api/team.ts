/**
 * Team API
 *
 * Endpoints (all routed off /api/team):
 *   POST   /api/team                       Create a team (Team-tier only).
 *   GET    /api/team                       Get the team for the calling account.
 *   GET    /api/team/members               List members.
 *   POST   /api/team/members               Invite a member by email.
 *   DELETE /api/team/members/:accountId    Remove a member (owner/admin only).
 *
 * Auth: Bearer ss_live_*. Roles: owner > admin > member > viewer.
 *
 * NOTE: Role-scoped decryption is intentionally out of scope for this iteration.
 * Snapshots remain encrypted with the user's passphrase only; this endpoint
 * just plumbs the team account model and audit trail. See CONCEPT.md Phase 6.1.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  initDb,
  getAccountByApiKey,
  createTeam,
  getTeamForAccount,
  getTeamMember,
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
  appendAuditLog,
  type TeamRole,
  type Team,
  type Account,
} from './lib/db.js';
import { sendEmail } from './lib/email.js';

const VALID_ROLES: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Authenticate
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith('ss_live_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  await initDb();

  const account = await getAccountByApiKey(apiKey);
  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Parse path: /api/team, /api/team/members, /api/team/members/:accountId
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname.replace(/^\/api\/team/, '') || '/';
  // path is one of: '/', '/members', '/members/<accountId>'

  try {
    if (path === '/' || path === '') {
      if (req.method === 'GET') return await handleGetTeam(account, res);
      if (req.method === 'POST') return await handleCreateTeam(account, req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (path === '/members' || path === '/members/') {
      if (req.method === 'GET') return await handleListMembers(account, res);
      if (req.method === 'POST') return await handleInviteMember(account, req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const memberMatch = path.match(/^\/members\/([0-9a-fA-F-]+)$/);
    if (memberMatch && req.method === 'DELETE') {
      return await handleRemoveMember(account, memberMatch[1], res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Team API error:', err);
    return res.status(500).json({ error: 'Team operation failed' });
  }
}

// ─── Handlers ────────────────────────────────────────────────

async function handleCreateTeam(account: Account, req: VercelRequest, res: VercelResponse) {
  if (account.tier !== 'team') {
    return res.status(402).json({
      error: 'Team tier required',
      hint: 'Upgrade at https://savestate.dev/#pricing',
    });
  }

  const existing = await getTeamForAccount(account.id);
  if (existing) {
    return res.status(409).json({ error: 'Account already belongs to a team', team: serializeTeam(existing) });
  }

  const body = readJsonBody(req);
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `${account.email}'s Team`;

  const team = await createTeam({
    name,
    ownerAccountId: account.id,
    ownerEmail: account.email,
    stripeSubscriptionId: account.stripe_subscription_id,
  });

  await appendAuditLog({
    teamId: team.id,
    actorAccountId: account.id,
    action: 'team.created',
    resourceType: 'team',
    resourceId: team.id,
    metadata: { name: team.name },
  });

  return res.status(201).json({ team: serializeTeam(team) });
}

async function handleGetTeam(account: Account, res: VercelResponse) {
  const team = await getTeamForAccount(account.id);
  if (!team) {
    return res.status(404).json({ error: 'No team found for this account' });
  }
  const role = await resolveRole(team, account.id);
  return res.status(200).json({ team: serializeTeam(team), role });
}

async function handleListMembers(account: Account, res: VercelResponse) {
  const team = await getTeamForAccount(account.id);
  if (!team) {
    return res.status(404).json({ error: 'No team found for this account' });
  }
  const members = await listTeamMembers(team.id);
  return res.status(200).json({
    team: serializeTeam(team),
    members: members.map(serializeMember),
  });
}

async function handleInviteMember(account: Account, req: VercelRequest, res: VercelResponse) {
  const team = await getTeamForAccount(account.id);
  if (!team) {
    return res.status(404).json({ error: 'No team found for this account' });
  }

  const callerRole = await resolveRole(team, account.id);
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Only owner or admin can invite members' });
  }

  const body = readJsonBody(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = (typeof body.role === 'string' ? body.role : 'member') as TeamRole;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!VALID_ROLES.includes(role) || role === 'owner') {
    return res.status(400).json({ error: 'role must be one of: admin, member, viewer' });
  }

  const member = await addTeamMember({ teamId: team.id, email, role });

  await appendAuditLog({
    teamId: team.id,
    actorAccountId: account.id,
    action: 'team.member.invited',
    resourceType: 'team_member',
    resourceId: member.id,
    metadata: { email, role },
  });

  // Fire-and-forget invite email; do not fail the request if SMTP is down.
  try {
    await sendEmail({
      to: email,
      subject: `You've been invited to join ${team.name} on SaveState`,
      html: inviteEmailHtml({ teamName: team.name, inviterEmail: account.email, role }),
    });
  } catch (err) {
    console.error(`Failed to send invite email to ${email}:`, err);
  }

  return res.status(201).json({ member: serializeMember(member) });
}

async function handleRemoveMember(account: Account, targetAccountId: string, res: VercelResponse) {
  const team = await getTeamForAccount(account.id);
  if (!team) {
    return res.status(404).json({ error: 'No team found for this account' });
  }

  const callerRole = await resolveRole(team, account.id);
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Only owner or admin can remove members' });
  }

  // Prevent removing the owner.
  if (targetAccountId === team.owner_account_id) {
    return res.status(400).json({ error: 'Cannot remove the team owner' });
  }

  const removed = await removeTeamMember(team.id, targetAccountId);
  if (!removed) {
    return res.status(404).json({ error: 'Member not found' });
  }

  await appendAuditLog({
    teamId: team.id,
    actorAccountId: account.id,
    action: 'team.member.removed',
    resourceType: 'team_member',
    resourceId: targetAccountId,
    metadata: null,
  });

  return res.status(200).json({ removed: true });
}

// ─── Helpers ─────────────────────────────────────────────────

async function resolveRole(team: Team, accountId: string): Promise<TeamRole | null> {
  if (team.owner_account_id === accountId) return 'owner';
  const member = await getTeamMember(team.id, accountId);
  return member?.role ?? null;
}

function serializeTeam(team: Team) {
  return {
    id: team.id,
    name: team.name,
    ownerAccountId: team.owner_account_id,
    stripeSubscriptionId: team.stripe_subscription_id,
    createdAt: team.created_at,
  };
}

function serializeMember(member: {
  id: string;
  team_id: string;
  account_id: string | null;
  email: string;
  role: TeamRole;
  invited_at: string;
  accepted_at: string | null;
}) {
  return {
    id: member.id,
    teamId: member.team_id,
    accountId: member.account_id,
    email: member.email,
    role: member.role,
    invitedAt: member.invited_at,
    acceptedAt: member.accepted_at,
  };
}

/**
 * Vercel auto-parses JSON bodies; this normalizes the result.
 */
function readJsonBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body as Record<string, unknown>;
  return {};
}

function inviteEmailHtml(params: { teamName: string; inviterEmail: string; role: TeamRole }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #03C1DF; margin-bottom: 30px; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 30px; margin: 20px 0; }
    h1 { color: #fff; font-size: 22px; margin-top: 0; }
    code { background: #0d1117; padding: 2px 8px; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #9BCDE4; }
    a { color: #03C1DF; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⏸ SaveState</div>
    <div class="card">
      <h1>You've been invited to join ${escapeHtml(params.teamName)}</h1>
      <p>${escapeHtml(params.inviterEmail)} invited you to join their SaveState team as <strong>${escapeHtml(params.role)}</strong>.</p>
      <p>To accept, sign up at <a href="https://savestate.dev/#pricing">savestate.dev</a> with this email address. Once you have an API key, run:</p>
      <p><code>savestate team status</code></p>
      <p style="color: #999; font-size: 13px;">Note: snapshots remain encrypted with each user's own passphrase. Role-scoped decryption is coming in a future release.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
