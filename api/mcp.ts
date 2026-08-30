/**
 * Hosted MCP — https://savestate.dev/api/mcp
 *
 * GET is discovery (no checkout). POST is a small JSON-RPC surface.
 * Missing/bad Bearer → 401. Token issuance is POST /v1/keys (402 + claim),
 * not an OAuth authorize URL and not MPP.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccountByApiKey, initDb } from './lib/db.js';
import { parseJsonBody, setCors } from './lib/http.js';

const SERVER_NAME = 'dev.savestate/memory';
const PROTOCOL_VERSION = '2025-03-26';

const TOOLS = [
  {
    name: 'savestate_status',
    description: 'Check SaveState cloud account status for the Bearer key.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'savestate_search_snapshots',
    description:
      'Full-text search across encrypted snapshots. Local stdio MCP required for decrypt-on-the-fly.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'GET, POST, OPTIONS');
  res.setHeader(
    'WWW-Authenticate',
    'Bearer realm="savestate", resource_metadata="https://savestate.dev/.well-known/oauth-protected-resource"',
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      name: SERVER_NAME,
      title: 'SaveState Memory',
      transport: 'streamable-http',
      agents: 'https://savestate.dev/agents.md',
      server_json: 'https://savestate.dev/server.json',
      keys: 'https://savestate.dev/v1/keys',
      auth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        scheme: 'Bearer',
        unauthorized: 401,
        payment_required: 402,
        issuance: 'POST /v1/keys then GET claim_url',
      },
      tools: TOOLS.map((t) => t.name),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'missing_api_key',
      hint: 'POST https://savestate.dev/v1/keys then poll claim_url. Read https://savestate.dev/agents.md',
    });
  }

  const apiKey = auth.slice(7);
  if (!apiKey.startsWith('ss_live_')) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  try {
    await initDb();
  } catch (err) {
    console.error('hosted MCP initDb failed:', err instanceof Error ? err.message : err);
    return res.status(503).json({ error: 'Account store unavailable' });
  }

  const account = await getAccountByApiKey(apiKey);
  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const body = parseJsonBody(req);
  const method = typeof body.method === 'string' ? body.method : '';
  const id = body.id ?? null;

  if (method === 'initialize') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: '0.9.0' },
        instructions: 'Read https://savestate.dev/agents.md. Local snapshot/restore uses npx -y @savestate/cli mcp.',
      },
    });
  }

  if (method === 'tools/list' || method === 'tools.list') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    });
  }

  if (method === 'ping') {
    return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
  }

  if (method === 'tools/call' || method === 'tools.call') {
    const params = (body.params ?? {}) as { name?: string };
    if (params.name === 'savestate_status') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                email: account.email,
                tier: account.tier,
                status: account.stripe_status,
              }),
            },
          ],
        },
      });
    }
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: 'Use local stdio MCP (npx -y @savestate/cli mcp) for snapshot, restore, and decrypt-on-the-fly search.',
          },
        ],
      },
    });
  }

  if (method === 'notifications/initialized') {
    return res.status(202).end();
  }

  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method || '(none)'}` },
  });
}
