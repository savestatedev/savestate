/**
 * Sales-lock marketing: public blog/FAQ CTAs must resolve to live Payment Links.
 * Prices and URLs come from stripe-config.json — do not invent them.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface StripeProduct {
  amount_cents: number;
  payment_link: string;
}

interface StripeConfig {
  products: {
    pro: StripeProduct;
    team: StripeProduct;
  };
}

function loadStripeConfig(): StripeConfig {
  return JSON.parse(readFileSync(join(root, 'stripe-config.json'), 'utf8')) as StripeConfig;
}

function loadHtml(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function hrefForCta(html: string, cta: string): string {
  const match = html.match(new RegExp(`href="([^"]+)"[^>]*data-cta="${cta}"|data-cta="${cta}"[^>]*href="([^"]+)"`));
  const href = match?.[1] ?? match?.[2];
  if (!href) {
    throw new Error(`Missing data-cta="${cta}"`);
  }
  return href;
}

function hasOg(html: string, property: string): boolean {
  return new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="[^"]+"`, 'i').test(html)
    || new RegExp(`<meta[^>]+content="[^"]+"[^>]+(?:property|name)="${property}"`, 'i').test(html);
}

describe('public marketing checkout CTAs', () => {
  const stripe = loadStripeConfig();
  const post = loadHtml('site/blog/when-the-chat-dies.html');
  const faq = loadHtml('site/faq.html');
  const blogIndex = loadHtml('site/blog/index.html');
  const homepage = loadHtml('site/index.html');
  const sitemap = loadHtml('site/sitemap.xml');
  const cursor = loadHtml('site/cursor.html');
  const claudeCode = loadHtml('site/claude-code.html');
  const clawdbot = loadHtml('site/clawdbot.html');
  const compareChrome = loadHtml('site/compare/vs-chrome-extensions.html');
  const compareExport = loadHtml('site/compare/vs-manual-export.html');
  const docsPricing = loadHtml('site/docs/pricing.html');
  const meet = loadHtml('site/meet/index.html');
  const vmdk = loadHtml('site/blog/you-cannot-restore-production-ai-from-a-vmdk.html');
  const memoryBackup = loadHtml('site/blog/your-agents-memory-is-not-a-backup.html');
  const durable = loadHtml('site/blog/your-agent-is-durable-you-cannot-restore-it.html');
  const aiact = loadHtml('site/blog/your-ai-act-audit-trail-cant-reconstruct-the-agent.html');
  const threat = loadHtml('site/blog/biggest-security-threat-to-your-ai.html');
  const stateSecurity = loadHtml('site/blog/ai-state-management-security.html');
  const blindSpot = loadHtml('site/blog/ai-state-management-cybersecurity-blind-spot.html');
  const githubSecurity = loadHtml('site/blog/github-ai-security-state-management.html');
  const gymHack = loadHtml('site/blog/gym-hack-state-forensics-failure.html');
  const terafab = loadHtml('site/blog/terafab-will-solve-ai-compute-problem-not-its-state.html');
  const vibeSafer = loadHtml('site/blog/cloudflare-made-vibe-coding-safer-not-recoverable.html');
  const v080 = loadHtml('site/blog/savestate-v0.8.0-migration-wizard-here.html');
  const greatMigration = loadHtml('site/blog/great-ai-migration-chatgpt-claude-context-loss.html');
  const architecture = loadHtml('site/blog/savestate-architecture-deep-dive.html');
  const mcpGateway = loadHtml('site/blog/your-mcp-gateway-cant-restore-the-agent.html');
  const v070 = loadHtml('site/blog/savestate-v0.7.0-migration-wizard.html');
  const v060 = loadHtml('site/blog/savestate-v0.6.0-release.html');

  it('uses the configured Pro and Team payment links (no invented prices)', () => {
    expect(stripe.products.pro.amount_cents).toBe(900);
    expect(stripe.products.team.amount_cents).toBe(2900);
    expect(stripe.products.pro.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(stripe.products.team.payment_link).toMatch(/^https:\/\/buy\.stripe\.com\//);
  });

  it('points the buyer post CTAs at the live Payment Links', () => {
    expect(hrefForCta(post, 'blog-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(post, 'blog-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(post, 'blog-footer-team-checkout')).toBe(stripe.products.team.payment_link);
  });

  it('keeps npm as a secondary path on the buyer post, never the primary CTA', () => {
    expect(hrefForCta(post, 'blog-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(post).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(post, 'blog-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points FAQ primary CTAs at the live Payment Links', () => {
    expect(hrefForCta(faq, 'faq-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-inline-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(faq, 'faq-inline-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(faq, 'faq-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(faq, 'faq-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
  });

  it('points blog index primary CTAs at the live Payment Links', () => {
    expect(hrefForCta(blogIndex, 'blog-index-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blogIndex, 'blog-index-sidebar-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blogIndex, 'blog-index-sidebar-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(blogIndex, 'blog-index-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(blogIndex, 'blog-index-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Cursor buyer page CTAs at the live Payment Links', () => {
    expect(hrefForCta(cursor, 'cursor-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cursor, 'cursor-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cursor, 'cursor-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cursor, 'cursor-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cursor, 'cursor-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cursor, 'cursor-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(cursor).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(cursor, 'cursor-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Claude Code buyer page CTAs at the live Payment Links', () => {
    expect(hrefForCta(claudeCode, 'claude-code-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claudeCode, 'claude-code-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claudeCode, 'claude-code-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claudeCode, 'claude-code-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(claudeCode, 'claude-code-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(claudeCode, 'claude-code-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(claudeCode).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(claudeCode, 'claude-code-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Clawdbot buyer page CTAs at the live Payment Links', () => {
    expect(hrefForCta(clawdbot, 'clawdbot-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(clawdbot, 'clawdbot-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(clawdbot, 'clawdbot-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(clawdbot, 'clawdbot-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(clawdbot, 'clawdbot-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(clawdbot, 'clawdbot-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(clawdbot).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(clawdbot, 'clawdbot-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points compare page CTAs at the live Payment Links', () => {
    expect(hrefForCta(compareChrome, 'compare-chrome-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(compareChrome, 'compare-chrome-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(compareChrome, 'compare-chrome-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(compareChrome, 'compare-chrome-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(compareChrome).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(compareExport, 'compare-export-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(compareExport, 'compare-export-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(compareExport, 'compare-export-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(compareExport, 'compare-export-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(compareExport).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the docs pricing CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsPricing, 'docs-pricing-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsPricing, 'docs-pricing-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the meet pitch CTAs at the live Payment Links', () => {
    expect(hrefForCta(meet, 'meet-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(meet, 'meet-hero-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(meet, 'meet-cta-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(meet, 'meet-hero-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(meet, 'meet-cta-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(meet, 'meet-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(meet, 'meet-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the VMDK post CTAs at the live Payment Links', () => {
    expect(hrefForCta(vmdk, 'vmdk-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vmdk, 'vmdk-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vmdk, 'vmdk-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(vmdk, 'vmdk-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(vmdk, 'vmdk-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the memory-is-not-a-backup post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryBackup, 'memory-backup-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryBackup, 'memory-backup-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryBackup, 'memory-backup-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryBackup, 'memory-backup-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryBackup, 'memory-backup-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the durable-agent post CTAs at the live Payment Links', () => {
    expect(hrefForCta(durable, 'durable-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(durable, 'durable-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(durable, 'durable-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(durable, 'durable-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(durable, 'durable-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the AI Act post CTAs at the live Payment Links', () => {
    expect(hrefForCta(aiact, 'aiact-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiact, 'aiact-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiact, 'aiact-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(aiact, 'aiact-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(aiact, 'aiact-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the security-threat post CTAs at the live Payment Links', () => {
    expect(hrefForCta(threat, 'threat-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(threat, 'threat-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(threat, 'threat-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(threat, 'threat-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(threat, 'threat-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the state-management-security post CTAs at the live Payment Links', () => {
    expect(hrefForCta(stateSecurity, 'state-security-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(stateSecurity, 'state-security-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(stateSecurity, 'state-security-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(stateSecurity, 'state-security-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(stateSecurity, 'state-security-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the cybersecurity-blind-spot post CTAs at the live Payment Links', () => {
    expect(hrefForCta(blindSpot, 'blind-spot-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blindSpot, 'blind-spot-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(blindSpot, 'blind-spot-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(blindSpot, 'blind-spot-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(blindSpot, 'blind-spot-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the github-ai-security post CTAs at the live Payment Links', () => {
    expect(hrefForCta(githubSecurity, 'github-security-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubSecurity, 'github-security-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubSecurity, 'github-security-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(githubSecurity, 'github-security-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(githubSecurity, 'github-security-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the gym-hack post CTAs at the live Payment Links', () => {
    expect(hrefForCta(gymHack, 'gym-hack-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(gymHack, 'gym-hack-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(gymHack, 'gym-hack-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(gymHack, 'gym-hack-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(gymHack, 'gym-hack-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the terafab post CTAs at the live Payment Links', () => {
    expect(hrefForCta(terafab, 'terafab-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(terafab, 'terafab-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(terafab, 'terafab-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(terafab, 'terafab-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(terafab, 'terafab-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the vibe-coding-safer post CTAs at the live Payment Links', () => {
    expect(hrefForCta(vibeSafer, 'vibe-safer-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vibeSafer, 'vibe-safer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vibeSafer, 'vibe-safer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(vibeSafer, 'vibe-safer-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(vibeSafer, 'vibe-safer-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the v0.8.0 migration-wizard post CTAs at the live Payment Links', () => {
    expect(hrefForCta(v080, 'v080-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v080, 'v080-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v080, 'v080-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(v080, 'v080-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(v080, 'v080-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the great-ai-migration post CTAs at the live Payment Links', () => {
    expect(hrefForCta(greatMigration, 'great-migration-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(greatMigration, 'great-migration-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(greatMigration, 'great-migration-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(greatMigration, 'great-migration-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(greatMigration, 'great-migration-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the architecture-deep-dive post CTAs at the live Payment Links', () => {
    expect(hrefForCta(architecture, 'architecture-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(architecture, 'architecture-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(architecture, 'architecture-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(architecture, 'architecture-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(architecture, 'architecture-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the MCP gateway post CTAs at the live Payment Links', () => {
    expect(hrefForCta(mcpGateway, 'mcp-gateway-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcpGateway, 'mcp-gateway-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcpGateway, 'mcp-gateway-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(mcpGateway, 'mcp-gateway-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(mcpGateway, 'mcp-gateway-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the v0.7.0 migration-wizard post CTAs at the live Payment Links', () => {
    expect(hrefForCta(v070, 'v070-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v070, 'v070-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v070, 'v070-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(v070, 'v070-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(v070, 'v070-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the v0.6.0 release post CTAs at the live Payment Links', () => {
    expect(hrefForCta(v060, 'v060-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v060, 'v060-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v060, 'v060-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(v060, 'v060-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(v060, 'v060-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('tells a paying stranger how fulfillment works after checkout', () => {
    for (const html of [post, faq, cursor, claudeCode, clawdbot, compareChrome, compareExport, docsPricing, blogIndex, meet, vmdk, memoryBackup, durable, aiact, threat, stateSecurity, blindSpot, githubSecurity, gymHack, terafab, vibeSafer, v080, greatMigration, architecture, mcpGateway, v070, v060]) {
      expect(html).toMatch(/After you pay, your API key is emailed/);
      expect(html).toMatch(/savestate login/);
    }
  });

  it('does not keep a waitlist on the marketing pages', () => {
    for (const html of [post, faq, blogIndex, homepage, cursor, claudeCode, clawdbot, compareChrome, compareExport, docsPricing, meet, vmdk, memoryBackup, durable, aiact, threat, stateSecurity, blindSpot, githubSecurity, gymHack, terafab, vibeSafer, v080, greatMigration, architecture, mcpGateway, v070, v060]) {
      expect(html).not.toMatch(/Join Waitlist/i);
      expect(html).not.toMatch(/waitlist for Pro features/i);
      expect(html).not.toMatch(/id="lead-form"/);
    }
  });

  it('ships SEO, Open Graph, and Twitter meta on the public surfaces', () => {
    for (const html of [post, faq, blogIndex, homepage, cursor, claudeCode, clawdbot, meet]) {
      expect(hasOg(html, 'og:title')).toBe(true);
      expect(hasOg(html, 'og:description')).toBe(true);
      expect(hasOg(html, 'og:image')).toBe(true);
      expect(hasOg(html, 'twitter:card')).toBe(true);
      expect(hasOg(html, 'twitter:title')).toBe(true);
    }
    expect(homepage).toMatch(/When the chat dies, your agent still knows/);
    expect(post).toMatch(/Claude Code/);
    expect(post).toMatch(/Cursor/);
    expect(post).toMatch(/Clawdbot/);
  });

  it('lists the buyer post on the live URL path after merge', () => {
    expect(sitemap).toContain('https://savestate.dev/blog/when-the-chat-dies');
    expect(blogIndex).toContain('/blog/when-the-chat-dies');
    expect(blogIndex).toContain('When the Chat Dies, Your Agent Still Knows');
  });

  it('lists the three buyer pages on live URL paths', () => {
    expect(sitemap).toContain('https://savestate.dev/cursor');
    expect(sitemap).toContain('https://savestate.dev/claude-code');
    expect(sitemap).toContain('https://savestate.dev/clawdbot');
    expect(homepage).toContain('href="/cursor"');
    expect(homepage).toContain('href="/claude-code"');
    expect(homepage).toContain('href="/clawdbot"');
  });
});
