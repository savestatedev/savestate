/**
 * Hosted Streamable HTTP MCP — https://savestate.dev/api/mcp
 *
 * /mcp is HTML docs. The live full-capability path is stdio:
 *   npx -y @savestate/cli mcp
 *
 * This endpoint is the registry remotes[] Streamable HTTP target.
 * POST JSON-RPC (application/json). GET SSE is not offered (405).
 * Missing/bad Bearer → 401. Token issuance is POST /v1/keys (402 + claim).
 */

import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccountByApiKey, initDb } from './lib/db.js';
import { parseJsonBody, setCors } from './lib/http.js';

const SERVER_NAME = 'dev.savestate/memory';
const PROTOCOL_VERSION = '2025-03-26';
const STDIO = 'npx -y @savestate/cli mcp';

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

function acceptHeader(req: VercelRequest): string {
  return String(req.headers.accept ?? '');
}

function wantsGetSse(req: VercelRequest): boolean {
  const accept = acceptHeader(req);
  return (
    accept.includes('text/event-stream') &&
    !accept.includes('application/json') &&
    !accept.includes('*/*')
  );
}

function isJsonRpcNotification(body: Record<string, unknown>): boolean {
  const method = typeof body.method === 'string' ? body.method : '';
  if (!method) return false;
  if (method.startsWith('notifications/')) return true;
  return body.id === undefined || body.id === null;
}

function applyStreamableHeaders(res: VercelResponse, sessionId?: string): void {
  res.setHeader('MCP-Protocol-Version', PROTOCOL_VERSION);
  if (sessionId) {
    res.setHeader('Mcp-Session-Id', sessionId);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
  res.setHeader(
    'WWW-Authenticate',
    'Bearer realm="savestate", resource_metadata="https://savestate.dev/.well-known/oauth-protected-resource"',
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    applyStreamableHeaders(res);
    return res.status(405).json({
      error: 'session_not_stateful',
      hint: 'This remote is stateless. Local stdio: ' + STDIO,
    });
  }

  if (req.method === 'GET') {
    if (wantsGetSse(req)) {
      applyStreamableHeaders(res);
      res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
      return res.status(405).json({
        error: 'sse_not_offered',
        hint: 'POST JSON-RPC with Accept: application/json. Local stdio: ' + STDIO,
      });
    }
    return res.status(200).json({
      name: SERVER_NAME,
      title: 'SaveState Memory',
      transport: 'streamable-http',
      stdio: STDIO,
      docs: 'https://savestate.dev/mcp',
      agents: 'https://savestate.dev/agents.md',
      llms: 'https://savestate.dev/llms.txt',
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
      hint: 'POST https://savestate.dev/v1/keys then poll claim_url. Floor: https://savestate.dev/llms.txt',
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

  if (isJsonRpcNotification(body)) {
    applyStreamableHeaders(res);
    return res.status(202).end();
  }

  if (method === 'initialize') {
    const sessionId = randomUUID();
    applyStreamableHeaders(res, sessionId);
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: '0.9.0' },
        instructions:
          'Required floor: https://savestate.dev/llms.txt. Live local path: ' +
          STDIO +
          '. /mcp is HTML docs.',
      },
    });
  }

  if (method === 'tools/list' || method === 'tools.list') {
    applyStreamableHeaders(res);
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    });
  }

  if (method === 'ping') {
    applyStreamableHeaders(res);
    return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
  }

  if (method === 'tools/call' || method === 'tools.call') {
    applyStreamableHeaders(res);
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
            text: 'Use local stdio MCP (' + STDIO + ') for snapshot, restore, and decrypt-on-the-fly search.',
          },
        ],
      },
    });
  }

  applyStreamableHeaders(res);
  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method || '(none)'}` },
  });
}
