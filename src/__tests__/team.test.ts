/**
 * Tests for the `savestate team` CLI command surface.
 *
 * We don't spin up the API in unit tests; instead we mock fetch and assert that
 * each subcommand makes the right HTTP request shape (method, path, body).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  teamStatusCommand,
  teamMembersCommand,
  teamInviteCommand,
  teamAuditCommand,
  apiRequest,
} from '../commands/team.js';

// Stub the config loader so apiRequest can resolve an API key without disk I/O.
vi.mock('../config.js', () => ({
  loadConfig: vi.fn(async () => ({ apiKey: 'ss_live_TEST_KEY' })),
}));

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function makeFetchMock(handler: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler({ url, init });
  });
  return { fn, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/csv' } });
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('attaches the saved API key as a Bearer token', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({ ok: true }));
    global.fetch = fn as unknown as typeof fetch;

    const result = await apiRequest('GET', '/team');
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ss_live_TEST_KEY');
  });

  it('serializes JSON bodies and sets content-type', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({ ok: true }));
    global.fetch = fn as unknown as typeof fetch;

    await apiRequest('POST', '/team/members', { email: 'a@b.co', role: 'member' });
    const init = calls[0].init!;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co', role: 'member' });
  });

  it('returns text body when acceptText is true', async () => {
    const { fn } = makeFetchMock(() => textResponse('id,action\n1,test'));
    global.fetch = fn as unknown as typeof fetch;

    const result = await apiRequest('GET', '/audit-export', undefined, true);
    expect(result.text).toBe('id,action\n1,test');
  });
});

describe('savestate team status', () => {
  it('GETs /team and prints team info', async () => {
    const { fn, calls } = makeFetchMock(() =>
      jsonResponse({
        team: { id: 't-1', name: 'Acme', createdAt: '2026-04-01T00:00:00Z' },
        role: 'owner',
      }),
    );
    global.fetch = fn as unknown as typeof fetch;

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await teamStatusCommand({});
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/team');
    expect(calls[0].init?.method).toBe('GET');
    expect(log).toHaveBeenCalled();
  });

  it('emits JSON when --json is set', async () => {
    const { fn } = makeFetchMock(() =>
      jsonResponse({
        team: { id: 't-1', name: 'Acme', createdAt: '2026-04-01T00:00:00Z' },
        role: 'admin',
      }),
    );
    global.fetch = fn as unknown as typeof fetch;

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await teamStatusCommand({ json: true });
    const out = log.mock.calls.map((c) => c[0]).join('\n');
    expect(JSON.parse(out)).toMatchObject({ role: 'admin' });
  });
});

describe('savestate team members', () => {
  it('GETs /team/members and renders a table', async () => {
    const { fn, calls } = makeFetchMock(() =>
      jsonResponse({
        team: { name: 'Acme' },
        members: [
          { email: 'a@b.co', role: 'owner', acceptedAt: '2026-04-01T00:00:00Z', invitedAt: '2026-04-01T00:00:00Z' },
          { email: 'c@d.co', role: 'admin', acceptedAt: null, invitedAt: '2026-04-02T00:00:00Z' },
        ],
      }),
    );
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await teamMembersCommand({});
    expect(calls[0].url).toContain('/team/members');
  });
});

describe('savestate team invite', () => {
  it('POSTs the email and role to /team/members', async () => {
    const { fn, calls } = makeFetchMock(() =>
      jsonResponse(
        { member: { email: 'new@b.co', role: 'admin' } },
        201,
      ),
    );
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await teamInviteCommand('new@b.co', { role: 'admin' });

    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      email: 'new@b.co',
      role: 'admin',
    });
  });

  it('rejects invalid roles before calling the API', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({}));
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('exit');
    }) as never);

    await expect(teamInviteCommand('a@b.co', { role: 'bogus' })).rejects.toThrow('exit');
    expect(calls).toHaveLength(0);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('rejects malformed emails before calling the API', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({}));
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('exit');
    }) as never);

    await expect(teamInviteCommand('not-an-email', {})).rejects.toThrow('exit');
    expect(calls).toHaveLength(0);
  });

  it('defaults role to "member" when not provided', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({ member: { email: 'x@y.co' } }, 201));
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    await teamInviteCommand('x@y.co', {});

    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      email: 'x@y.co',
      role: 'member',
    });
  });
});

describe('savestate team audit', () => {
  it('first resolves team id then GETs /audit-export with format=json', async () => {
    let callIndex = 0;
    const { fn, calls } = makeFetchMock(() => {
      if (callIndex++ === 0) {
        return jsonResponse({
          team: { id: 't-7', name: 'Acme', createdAt: '2026-04-01T00:00:00Z' },
          role: 'owner',
        });
      }
      return jsonResponse({ team_id: 't-7', count: 0, next_cursor: null, entries: [] });
    });
    global.fetch = fn as unknown as typeof fetch;

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await teamAuditCommand({ format: 'json', since: '2026-04-01' });

    expect(calls[0].url).toContain('/team');
    expect(calls[1].url).toContain('/audit-export');
    expect(calls[1].url).toContain('team_id=t-7');
    expect(calls[1].url).toContain('format=json');
    expect(calls[1].url).toContain('since=2026-04-01');
    expect(writeSpy).toHaveBeenCalled();
  });

  it('streams CSV body to stdout when --format=csv', async () => {
    let callIndex = 0;
    const { fn } = makeFetchMock(() => {
      if (callIndex++ === 0) {
        return jsonResponse({
          team: { id: 't-9', name: 'Acme', createdAt: '2026-04-01T00:00:00Z' },
          role: 'admin',
        });
      }
      return textResponse('id,action\nrow-1,team.created');
    });
    global.fetch = fn as unknown as typeof fetch;

    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
      chunks.push(typeof c === 'string' ? c : String(c));
      return true;
    });
    await teamAuditCommand({ format: 'csv' });
    expect(chunks.join('')).toContain('row-1,team.created');
  });

  it('rejects invalid format before any API call', async () => {
    const { fn, calls } = makeFetchMock(() => jsonResponse({}));
    global.fetch = fn as unknown as typeof fetch;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('exit');
    }) as never);

    await expect(teamAuditCommand({ format: 'xml' })).rejects.toThrow('exit');
    expect(calls).toHaveLength(0);
  });
});
