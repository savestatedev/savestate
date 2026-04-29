/**
 * Audit Log Export API
 *
 * GET /api/audit-export?team_id=<uuid>&format=csv|json&since=&until=&cursor=
 *
 * Streams the audit log for a team. Caller must be owner or admin.
 *
 * Pagination: returns at most 10,000 rows. JSON output includes a
 * `next_cursor` field (an opaque string encoding `created_at|id`) when
 * more rows exist. Pass that value back as `cursor=` to fetch the next
 * page. CSV output is single-shot — for >10k rows over time, page via JSON
 * and stitch.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  initDb,
  getAccountByApiKey,
  getTeamById,
  getTeamMember,
  queryAuditLog,
  type AuditLogEntry,
  type Team,
  type TeamRole,
} from './lib/db.js';

const MAX_LIMIT = 10000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const teamId = (req.query.team_id as string | undefined) ?? '';
  const format = ((req.query.format as string | undefined) ?? 'json').toLowerCase();
  const since = parseDate(req.query.since as string | undefined);
  const until = parseDate(req.query.until as string | undefined);
  const cursor = decodeCursor(req.query.cursor as string | undefined);

  if (!teamId) {
    return res.status(400).json({ error: 'team_id required' });
  }
  if (format !== 'json' && format !== 'csv') {
    return res.status(400).json({ error: "format must be 'csv' or 'json'" });
  }

  const team = await getTeamById(teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const role = await resolveRole(team, account.id);
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Audit export requires owner or admin role' });
  }

  let rows: AuditLogEntry[];
  try {
    rows = await queryAuditLog({
      teamId: team.id,
      since,
      until,
      limit: MAX_LIMIT,
      cursorCreatedAt: cursor?.createdAt ?? null,
      cursorId: cursor?.id ?? null,
    });
  } catch (err) {
    console.error('queryAuditLog failed:', err);
    return res.status(500).json({ error: 'Failed to query audit log' });
  }

  const nextCursor = rows.length === MAX_LIMIT
    ? encodeCursor(rows[rows.length - 1].created_at, rows[rows.length - 1].id)
    : null;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${team.id}-${Date.now()}.csv"`,
    );
    return res.status(200).send(rowsToCsv(rows));
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    team_id: team.id,
    count: rows.length,
    next_cursor: nextCursor,
    entries: rows.map((r) => ({
      id: r.id,
      team_id: r.team_id,
      actor_account_id: r.actor_account_id,
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      metadata: r.metadata,
      created_at: r.created_at,
    })),
  });
}

// ─── Helpers ─────────────────────────────────────────────────

async function resolveRole(team: Team, accountId: string): Promise<TeamRole | null> {
  if (team.owner_account_id === accountId) return 'owner';
  const member = await getTeamMember(team.id, accountId);
  return member?.role ?? null;
}

function parseDate(input: string | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

interface Cursor {
  createdAt: Date;
  id: string;
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(input: string | undefined): Cursor | null {
  if (!input) return null;
  try {
    const decoded = Buffer.from(input, 'base64url').toString('utf8');
    const [createdAt, id] = decoded.split('|');
    if (!createdAt || !id) return null;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}

function rowsToCsv(rows: AuditLogEntry[]): string {
  const header = 'id,team_id,actor_account_id,action,resource_type,resource_id,metadata,created_at';
  const lines = rows.map((r) =>
    [
      r.id,
      r.team_id,
      r.actor_account_id ?? '',
      r.action,
      r.resource_type ?? '',
      r.resource_id ?? '',
      r.metadata ? JSON.stringify(r.metadata) : '',
      r.created_at,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

