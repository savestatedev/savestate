import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../api/lib/db.js', () => ({
  initDb: vi.fn(async () => undefined),
  getAccountByApiKey: vi.fn(async (key: string) => {
    if (key === 'ss_live_GOOD') {
      return {
        id: 'acct_1',
        email: 'agent@example.com',
        tier: 'pro',
        stripe_status: 'active',
      };
    }
    return null;
  }),
}));

import handler from '../../api/mcp.js';

function mockReq(partial: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'GET',
    headers: { host: 'savestate.dev' },
    body: {},
    query: {},
    ...partial,
  } as VercelRequest;
}

function mockRes(): VercelResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
} {
  const out = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(payload: unknown) {
      out.body = payload;
      return out;
    },
    end() {
      return out;
    },
  };
  return out as unknown as VercelResponse & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

describe('hosted MCP /api/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET is discovery and names the registry + claim path', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as {
      name: string;
      keys: string;
      agents: string;
      llms: string;
      stdio: string;
      docs: string;
      transport: string;
    };
    expect(body.name).toBe('dev.savestate/memory');
    expect(body.keys).toBe('https://savestate.dev/v1/keys');
    expect(body.agents).toBe('https://savestate.dev/agents.md');
    expect(body.llms).toBe('https://savestate.dev/llms.txt');
    expect(body.stdio).toBe('npx -y @savestate/cli mcp');
    expect(body.docs).toBe('https://savestate.dev/mcp');
    expect(body.transport).toBe('streamable-http');
  });

  it('GET with SSE-only Accept is 405 (no long-lived stream on Vercel)', async () => {
    const res = mockRes();
    await handler(
      mockReq({ method: 'GET', headers: { host: 'savestate.dev', accept: 'text/event-stream' } }),
      res,
    );
    expect(res.statusCode).toBe(405);
  });

  it('DELETE is 405 because the remote is stateless', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('POST without a key is 401, not a minted Free key', async () => {
    const res = mockRes();
    await handler(mockReq({ method: 'POST', body: { method: 'initialize' } }), res);
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).toContain('/v1/keys');
  });

  it('POST with a bad key is 401', async () => {
    const res = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { authorization: 'Bearer ss_live_BAD' },
        body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
      }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it('POST initialize with a valid key returns the memory server', async () => {
    const res = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { authorization: 'Bearer ss_live_GOOD' },
        body: { jsonrpc: '2.0', id: 1, method: 'initialize' },
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { result: { serverInfo: { name: string } } };
    expect(body.result.serverInfo.name).toBe('dev.savestate/memory');
    expect(res.headers['Mcp-Session-Id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('POST notifications/initialized is 202 with no body', async () => {
    const res = mockRes();
    await handler(
      mockReq({
        method: 'POST',
        headers: { authorization: 'Bearer ss_live_GOOD' },
        body: { jsonrpc: '2.0', method: 'notifications/initialized' },
      }),
      res,
    );
    expect(res.statusCode).toBe(202);
  });
});
