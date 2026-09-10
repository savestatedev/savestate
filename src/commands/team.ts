/**
 * savestate team — Team management commands (Team tier)
 *
 * Subcommands:
 *   savestate team status                     Show your team membership
 *   savestate team members                    List team members
 *   savestate team invite <email> [--role R]  Invite a member by email
 *   savestate team audit [--since] [--format] [--json] Stream the audit log
 */

import chalk from 'chalk';
import { loadConfig } from '../config.js';

const API_BASE = process.env.SAVESTATE_API_URL || 'https://savestate.dev/api';

export interface TeamCommandOptions {
  role?: string;
  name?: string;
  since?: string;
  until?: string;
  format?: string;
  json?: boolean;
}

export interface TeamStatusJson {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export function formatTeamStatusJson(status: TeamStatusJson): string {
  return JSON.stringify(
    {
      id: status.id,
      name: status.name,
      role: status.role,
      createdAt: status.createdAt,
    },
    null,
    2,
  );
}

export interface TeamMemberJson {
  email: string;
  role: string;
  acceptedAt: string | null;
  invitedAt: string;
}

export interface TeamMembersJson {
  name: string;
  members: TeamMemberJson[];
}

export function formatTeamMembersJson(result: TeamMembersJson): string {
  return JSON.stringify(
    {
      name: result.name,
      members: result.members.map((member) => ({
        email: member.email,
        role: member.role,
        acceptedAt: member.acceptedAt,
        invitedAt: member.invitedAt,
      })),
    },
    null,
    2,
  );
}

export interface TeamInviteJson {
  email: string;
  role: string;
  acceptedAt: string | null;
  invitedAt: string;
}

export function formatTeamInviteJson(invite: TeamInviteJson): string {
  return JSON.stringify(
    {
      email: invite.email,
      role: invite.role,
      acceptedAt: invite.acceptedAt,
      invitedAt: invite.invitedAt,
    },
    null,
    2,
  );
}

export interface TeamInviteMissingJson {
  found: false;
  email: null;
  role: null;
}

export function formatTeamInviteMissingJson(): string {
  return JSON.stringify(
    {
      found: false,
      email: null,
      role: null,
    },
    null,
    2,
  );
}

export interface TeamAuditEntryJson {
  id: string;
  action: string;
  actorAccountId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
}

export interface TeamAuditJson {
  teamId: string;
  count: number;
  nextCursor: string | null;
  entries: TeamAuditEntryJson[];
}

export function formatTeamAuditJson(result: TeamAuditJson): string {
  return JSON.stringify(
    {
      teamId: result.teamId,
      count: result.count,
      nextCursor: result.nextCursor,
      entries: result.entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        actorAccountId: entry.actorAccountId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        createdAt: entry.createdAt,
      })),
    },
    null,
    2,
  );
}

interface CallResult {
  ok: boolean;
  status: number;
  body: unknown;
  text?: string;
}

/**
 * Read the saved API key from the local config. Returns null if the user
 * hasn't run `savestate login`.
 */
export async function getApiKey(): Promise<string | null> {
  const config = await loadConfig();
  const ext = config as unknown as Record<string, unknown>;
  const key = ext.apiKey;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/**
 * Make an authenticated request against the SaveState API. Exposed for testing.
 */
export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  acceptText = false,
): Promise<CallResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      body: { error: 'Not logged in. Run `savestate login` first.' },
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (acceptText) {
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: null, text };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

// ─── Subcommands ─────────────────────────────────────────────

export async function teamStatusCommand(options: TeamCommandOptions = {}): Promise<void> {
  const result = await apiRequest('GET', '/team');
  if (!result.ok) return printError(result, 'Could not fetch team status');

  const data = result.body as { team: { id: string; name: string; createdAt: string }; role: string };
  if (options.json) {
    console.log(
      formatTeamStatusJson({
        id: data.team.id,
        name: data.team.name,
        role: data.role,
        createdAt: data.team.createdAt,
      }),
    );
    return;
  }

  console.log();
  console.log(chalk.bold('Team:    '), data.team.name);
  console.log(chalk.dim('  ID:      '), data.team.id);
  console.log(chalk.dim('  Role:    '), chalk.cyan(data.role));
  console.log(chalk.dim('  Created: '), new Date(data.team.createdAt).toLocaleString());
  console.log();
}

export async function teamMembersCommand(options: TeamCommandOptions = {}): Promise<void> {
  const result = await apiRequest('GET', '/team/members');
  if (!result.ok) return printError(result, 'Could not fetch members');

  const data = result.body as {
    team: { name: string };
    members: Array<{ email: string; role: string; acceptedAt: string | null; invitedAt: string }>;
  };

  if (options.json) {
    console.log(
      formatTeamMembersJson({
        name: data.team.name,
        members: data.members.map((member) => ({
          email: member.email,
          role: member.role,
          acceptedAt: member.acceptedAt,
          invitedAt: member.invitedAt,
        })),
      }),
    );
    return;
  }

  console.log();
  console.log(chalk.bold(`Members of ${data.team.name}:`));
  console.log();
  console.log(chalk.dim('  EMAIL                          ROLE     STATUS'));
  console.log(chalk.dim('  ─────                          ────     ──────'));
  for (const m of data.members) {
    const status = m.acceptedAt ? chalk.green('active') : chalk.yellow('pending');
    console.log(`  ${pad(m.email, 30)} ${pad(m.role, 8)} ${status}`);
  }
  console.log();
}

export async function teamInviteCommand(email: string, options: TeamCommandOptions = {}): Promise<void> {
  if (!email || !email.includes('@')) {
    console.log(chalk.red('✗ Provide a valid email: savestate team invite user@example.com'));
    process.exit(1);
  }
  const role = options.role || 'member';
  if (!['admin', 'member', 'viewer'].includes(role)) {
    console.log(chalk.red('✗ --role must be one of: admin, member, viewer'));
    process.exit(1);
  }

  const result = await apiRequest('POST', '/team/members', { email, role });
  if (!result.ok) {
    if (options.json) {
      console.log(formatTeamInviteMissingJson());
      return;
    }
    return printError(result, 'Invite failed');
  }

  if (options.json) {
    const data = result.body as {
      member?: { email?: string; role?: string; acceptedAt?: string | null; invitedAt?: string };
    };
    console.log(
      formatTeamInviteJson({
        email: data.member?.email || email,
        role: data.member?.role || role,
        acceptedAt: data.member?.acceptedAt ?? null,
        invitedAt: data.member?.invitedAt || '',
      }),
    );
    return;
  }

  console.log();
  console.log(chalk.green(`✓ Invited ${email} as ${role}`));
  console.log(chalk.dim('  An email has been sent. Status stays "pending" until they sign up.'));
  console.log();
}

export async function teamAuditCommand(options: TeamCommandOptions = {}): Promise<void> {
  const format = (options.json ? 'json' : (options.format || 'json')).toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    console.log(chalk.red("✗ --format must be 'csv' or 'json'"));
    process.exit(1);
  }

  const teamRes = await apiRequest('GET', '/team');
  if (!teamRes.ok) return printError(teamRes, 'Could not resolve team');
  const teamId = (teamRes.body as { team: { id: string } }).team.id;

  const params = new URLSearchParams({ team_id: teamId, format });
  if (options.since) params.set('since', options.since);
  if (options.until) params.set('until', options.until);

  const result = await apiRequest('GET', `/audit-export?${params.toString()}`, undefined, format === 'csv');
  if (!result.ok) return printError(result, 'Audit export failed');

  if (format === 'csv') {
    process.stdout.write(result.text || '');
  } else {
    const body = (result.body ?? {}) as {
      team_id?: string;
      count?: number;
      next_cursor?: string | null;
      entries?: Array<{
        id?: string;
        actor_account_id?: string | null;
        action?: string;
        resource_type?: string | null;
        resource_id?: string | null;
        created_at?: string;
        metadata?: unknown;
      }>;
    };
    const entries = Array.isArray(body.entries) ? body.entries : [];
    process.stdout.write(
      formatTeamAuditJson({
        teamId: typeof body.team_id === 'string' ? body.team_id : teamId,
        count: typeof body.count === 'number' ? body.count : entries.length,
        nextCursor: body.next_cursor ?? null,
        entries: entries.map((entry) => ({
          id: entry.id ?? '',
          action: entry.action ?? '',
          actorAccountId: entry.actor_account_id ?? null,
          resourceType: entry.resource_type ?? null,
          resourceId: entry.resource_id ?? null,
          createdAt: entry.created_at ?? '',
        })),
      }),
    );
    process.stdout.write('\n');
  }
}

/**
 * Top-level dispatcher used by cli.ts so we keep one entry point per command tree.
 */
export async function teamCommand(subcommand: string, arg: string | undefined, options: TeamCommandOptions): Promise<void> {
  switch (subcommand) {
    case 'status':
      return teamStatusCommand(options);
    case 'members':
      return teamMembersCommand(options);
    case 'invite':
      return teamInviteCommand(arg || '', options);
    case 'audit':
      return teamAuditCommand(options);
    default:
      console.log(chalk.red(`Unknown team subcommand: ${subcommand}`));
      console.log();
      console.log('Usage:');
      console.log('  savestate team status');
      console.log('  savestate team members');
      console.log('  savestate team invite <email> [--role admin|member|viewer]');
      console.log('  savestate team audit [--since DATE] [--format csv|json] [--json]');
      process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function printError(result: CallResult, fallback: string): void {
  const body = result.body as { error?: string } | null;
  const msg = body?.error || result.text || fallback;
  console.log(chalk.red(`✗ ${msg}`));
  if (result.status === 402) {
    console.log(chalk.dim('  Upgrade at https://savestate.dev/#pricing'));
  }
  process.exit(1);
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}
