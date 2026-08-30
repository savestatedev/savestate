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
  it('publishes server.json for official registry stdio package + streamable-http remote', () => {
    const packet = parseJson('site/server.json');
    const rootPacket = parseJson('server.json');
    expect(packet).toEqual(rootPacket);
    expect(packet.$schema).toBe(
      'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    );
    expect(packet.name).toBe('dev.savestate/memory');
    expect((packet.description as string).length).toBeLessThanOrEqual(100);
    expect(packet.websiteUrl).toBe('https://savestate.dev/llms.txt');
    const pkg = (
      packet.packages as Array<{
        identifier: string;
        transport: { type: string };
        packageArguments: Array<{ value: string }>;
        runtimeHint: string;
      }>
    )[0];
    expect(pkg.identifier).toBe('@savestate/cli');
    expect(pkg.transport.type).toBe('stdio');
    expect(pkg.runtimeHint).toBe('npx');
    expect(pkg.packageArguments.map((a) => a.value)).toContain('mcp');
    const remotes = packet.remotes as Array<{
      type: string;
      url: string;
      headers: Array<{ name: string; isRequired: boolean }>;
    }>;
    expect(remotes[0].type).toBe('streamable-http');
    expect(remotes[0].url).toBe('https://savestate.dev/api/mcp');
    expect(remotes[0].headers[0].name).toBe('Authorization');
    expect(remotes[0].headers[0].isRequired).toBe(true);
    const meta = packet._meta as {
      'io.modelcontextprotocol.registry/publisher-provided': { llms: string; stdio: string };
    };
    expect(meta['io.modelcontextprotocol.registry/publisher-provided'].llms).toBe(
      'https://savestate.dev/llms.txt',
    );
    expect(meta['io.modelcontextprotocol.registry/publisher-provided'].stdio).toBe(
      'npx -y @savestate/cli mcp',
    );
    const npm = parseJson('package.json');
    expect(npm.mcpName).toBe('io.github.savestatedev/cli');
    expect(npm.version).toBe('0.9.1');
  });

  it('keeps the leftover well-known card renamed to memory, not as the primary', () => {
    const card = parseJson('site/.well-known/mcp.json');
    expect(card.name).toBe('dev.savestate/memory');
    expect(card.pay_url).toBe(PRO);
    expect(card.websiteUrl).toBe('https://savestate.dev/agents.md');
    expect(card).not.toHaveProperty('glama');
  });

  it('serves the same leftover card at /mcp.json', () => {
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

  it('keeps llms.txt as the required floor: capability, install, MCP, auth, pay, 402+claim', () => {
    const llms = read('site/llms.txt');
    expect(llms.trimStart().startsWith('#')).toBe(true);
    expect(llms).not.toMatch(/<!DOCTYPE html>/i);
    expect(llms).toMatch(/required floor/i);
    expect(llms).not.toMatch(/^\*\*Start here:\*\* https:\/\/savestate\.dev\/agents\.md/m);
    expect(llms).toMatch(/Capability/i);
    expect(llms).toContain('npm install -g @savestate/cli');
    expect(llms).toContain('https://savestate.dev/agents.md');
    expect(llms).toContain('https://savestate.dev/api/mcp');
    expect(llms).toContain('dev.savestate/memory');
    expect(llms).toContain('npx -y @savestate/cli mcp');
    expect(llms).toMatch(/Auth/i);
    expect(llms).toContain('POST https://savestate.dev/v1/keys');
    expect(llms).toContain(PRO);
    expect(llms).toContain(TEAM);
    expect(llms).toContain('pay_url');
    expect(llms).toContain('claim_url');
    expect(llms).toContain('401');
    expect(llms).toContain('402');
    expect(llms).toContain('202');
    expect(llms).toContain('409');
    expect(llms).toContain('410');
    expect(llms).toContain('https://savestate.dev/mcp');
    expect(llms).toContain('https://savestate.dev/agent-memory');
    expect(llms).toContain('https://savestate.dev/codex');
    expect(llms).toContain('https://savestate.dev/gemini');
    expect(llms).toContain('https://savestate.dev/chatgpt');
    expect(llms).toContain('https://savestate.dev/openai');
    expect(llms).toContain('https://savestate.dev/claude\n');
    expect(llms).toContain('https://savestate.dev/windsurf\n');
    const sitemap = read('site/sitemap.xml');
    expect(sitemap).toContain('<loc>https://savestate.dev/llms.txt</loc>');
    const robots = read('site/robots.txt');
    expect(robots).toMatch(/\/llms\.txt — required floor/);
    expect(robots).toContain('SOM-Endpoint: https://savestate.dev/llms.txt');
  });

  it('ships /agents.md as the longer playbook and names llms.txt as the required floor', () => {
    const agents = read('site/agents.md');
    expect(agents).toContain('https://savestate.dev/llms.txt');
    expect(agents).toMatch(/required floor/i);
    expect(agents).toContain('POST https://savestate.dev/v1/keys');
    expect(agents).toContain('pay_url');
    expect(agents).toContain('claim_url');
    expect(agents).toContain(PRO);
    expect(agents).toContain('https://savestate.dev/api/mcp');
    expect(agents).toContain('dev.savestate/memory');
    expect(agents).toContain('npx -y @savestate/cli mcp');
    expect(agents).toMatch(/OAuth authorization-code is not shipped|not an OAuth authorize/i);
    expect(agents).toMatch(/MPP/);
    expect(agents).not.toMatch(/cursor\.com\/marketplace|glama\.ai\/mcp|pulsemcp\.com/i);
    expect(agents).not.toMatch(/<!DOCTYPE html>/i);
  });

  it('preps Cursor / Claude / ChatGPT plugin packets without a fake listing URL', () => {
    const cursor = parseJson('plugins/savestate-memory/.cursor-plugin/plugin.json');
    const claude = parseJson('plugins/savestate-memory/.claude-plugin/plugin.json');
    const chatgpt = parseJson('plugins/savestate-memory/.codex-plugin/plugin.json');
    const portable = parseJson('plugins/savestate-memory/plugin.json');
    expect(cursor.name).toBe('savestate-memory');
    expect(claude.name).toBe('savestate-memory');
    expect(chatgpt.name).toBe('savestate-memory');
    expect(portable.name).toBe('savestate-memory');
    const readme = read('plugins/savestate-memory/README.md');
    expect(readme).toMatch(/David Hurley/);
    expect(readme).toMatch(/listing URL/i);
    expect(readme).not.toMatch(/https:\/\/cursor\.com\/marketplace/);
    expect(readme).not.toMatch(/https:\/\/glama\.ai/);
    expect(readme).not.toMatch(/pulsemcp/i);
  });

  it('includes Smithery listing metadata and skips Glama/PulseMCP packets', () => {
    const smithery = read('smithery.yaml');
    expect(smithery).toContain('@savestate/cli');
    expect(smithery).toContain('stdio');
    expect(smithery).not.toMatch(/pulsemcp|Glama-score/i);
  });

  it('makes /mcp HTML a well-linked agent card with command + Payment Link', () => {
    const html = read('site/mcp.html');
    expect(html).toContain('npx -y @savestate/cli mcp');
    expect(html).toContain('HTML docs only');
    expect(html).toContain('/llms.txt');
    expect(html).toContain(PRO);
    expect(html).toContain('/agents.md');
    expect(html).toContain('/api/mcp');
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
      'site/server.json',
      'site/openapi.json',
      'site/llms.txt',
      'site/agents.md',
      'api/v1/keys.ts',
      'api/mcp.ts',
      'smithery.yaml',
      'plugins/savestate-memory/README.md',
    ];
    for (const file of files) {
      const text = read(file);
      expect(text).not.toMatch(/Glama-score|glamaScore|PromptFrenzy/i);
      expect(text).not.toMatch(/ignoreBuildErrors/);
    }
  });
});
