/**
 * Agent discovery surfaces must be real JSON/text, not homepage HTML,
 * and must name the live Pro Payment Link plus the claim flow.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRO = 'https://buy.stripe.com/aFa00j5E4ees8hf3kp2ZO00';
const TEAM = 'https://buy.stripe.com/8x27sLc2s4DSapn4ot2ZO01';

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function parseJson(rel: string): Record<string, unknown> {
  const raw = read(rel);
  expect(raw.trimStart().startsWith('<')).toBe(false);
  expect(raw).not.toMatch(/<!DOCTYPE html>/i);
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('agent discovery files', () => {
  it('serves a real MCP server card at /.well-known/mcp.json', () => {
    const card = parseJson('site/.well-known/mcp.json');
    expect(card.name).toBe('dev.savestate/mcp');
    expect(card.pay_url).toBe(PRO);
    expect(JSON.stringify(card)).toContain('npx');
    expect(JSON.stringify(card)).toContain('@savestate/cli');
    expect(JSON.stringify(card)).toContain('/v1/keys');
    expect(card).not.toHaveProperty('glama');
  });

  it('serves the same card at /mcp.json', () => {
    const wellKnown = parseJson('site/.well-known/mcp.json');
    const mcp = parseJson('site/mcp.json');
    expect(mcp.pay_url).toBe(PRO);
    expect(mcp.name).toBe(wellKnown.name);
  });

  it('OpenAPI requires pay_url and claim_url on 402 and uses apiKey security', () => {
    const spec = parseJson('site/openapi.json');
    expect(spec.openapi).toMatch(/^3\./);
    const components = spec.components as {
      securitySchemes: { apiKey: { type: string; name: string } };
      schemas: { PaymentRequired: { required: string[] } };
    };
    expect(components.securitySchemes.apiKey.type).toBe('apiKey');
    expect(components.securitySchemes.apiKey.name).toBe('Authorization');
    expect(components.schemas.PaymentRequired.required).toEqual(
      expect.arrayContaining(['pay_url', 'claim_url']),
    );
    const paths = spec.paths as Record<string, { post?: { responses: Record<string, unknown> } }>;
    expect(paths['/v1/keys'].post?.responses['402']).toBeDefined();
  });

  it('lists MCP tools from the in-repo server', () => {
    const tools = parseJson('site/mcp/tools.json');
    const names = (tools.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('savestate_search_snapshots');
    expect(names).toContain('savestate_snapshot');
    expect(names).toContain('add_memories');
    const server = read('src/mcp/server.ts');
    for (const name of names) {
      expect(server).toContain(`name: '${name}'`);
    }
  });

  it('tightens llms.txt to capability, install, MCP, auth, pay, claim', () => {
    const llms = read('site/llms.txt');
    expect(llms.trimStart().startsWith('#')).toBe(true);
    expect(llms).not.toMatch(/<!DOCTYPE html>/i);
    expect(llms).toMatch(/Capability/i);
    expect(llms).toContain('npm install -g @savestate/cli');
    expect(llms).toContain('https://savestate.dev/.well-known/mcp.json');
    expect(llms).toContain('npx -y @savestate/cli mcp');
    expect(llms).toMatch(/Auth/i);
    expect(llms).toContain('POST https://savestate.dev/v1/keys');
    expect(llms).toContain(PRO);
    expect(llms).toContain(TEAM);
    expect(llms).toContain('claim_url');
    expect(llms).toContain('401');
    expect(llms).toContain('402');
    expect(llms).toContain('https://savestate.dev/mcp');
    expect(llms).toContain('https://savestate.dev/agent-memory');
    expect(llms).toContain('https://savestate.dev/codex');
    expect(llms).toContain('https://savestate.dev/gemini');
    expect(llms).toContain('https://savestate.dev/chatgpt');
    expect(llms).toContain('https://savestate.dev/openai');
    expect(llms).toContain('https://savestate.dev/claude\n');
    expect(llms).toContain('https://savestate.dev/windsurf\n');
  });

  it('ships /agents.md as the pay-and-claim playbook', () => {
    const agents = read('site/agents.md');
    expect(agents).toContain('POST https://savestate.dev/v1/keys');
    expect(agents).toContain('pay_url');
    expect(agents).toContain('claim_url');
    expect(agents).toContain(PRO);
    expect(agents).toContain('npx -y @savestate/cli mcp');
    expect(agents).not.toMatch(/<!DOCTYPE html>/i);
  });

  it('makes /mcp HTML a well-linked agent card with command + Payment Link', () => {
    const html = read('site/mcp.html');
    expect(html).toContain('npx -y @savestate/cli mcp');
    expect(html).toContain(PRO);
    expect(html).toContain('/.well-known/mcp.json');
    expect(html).toContain('POST https://savestate.dev/v1/keys');
    expect(html).toContain('href="https://www.npmjs.com/package/@savestate/cli"');
  });

  it('rewrites /v1/keys off the API handlers', () => {
    const vercel = read('vercel.json');
    expect(vercel).toContain('"/v1/keys"');
    expect(vercel).toContain('"/api/v1/keys"');
    expect(vercel).toContain('"/v1/keys/claims/:id"');
    expect(vercel).toContain('"/mcp"');
    expect(vercel).toContain('"/mcp.html"');
  });

  it('does not invent Glama scores, waitlists, or ignoreBuildErrors', () => {
    const files = [
      'site/.well-known/mcp.json',
      'site/openapi.json',
      'site/llms.txt',
      'site/agents.md',
      'api/v1/keys.ts',
    ];
    for (const file of files) {
      const text = read(file);
      expect(text).not.toMatch(/Glama-score|glamaScore|PromptFrenzy/i);
      expect(text).not.toMatch(/ignoreBuildErrors/);
    }
  });
});
