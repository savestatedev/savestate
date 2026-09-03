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
  const vibeFast = loadHtml('site/blog/cloudflare-vibe-coding-fast-recovery-slow.html');
  const claudeMcp = loadHtml('site/blog/claude-code-mcp-integration.html');
  const v090 = loadHtml('site/blog/savestate-v0.9.0-memory-that-heals-itself.html');
  const governance = loadHtml('site/blog/v0.9.0-memory-governance.html');
  const threadDies = loadHtml('site/when-the-thread-dies.html');
  const mcp = loadHtml('site/mcp.html');
  const agentMemory = loadHtml('site/agent-memory.html');
  const codex = loadHtml('site/codex.html');
  const gemini = loadHtml('site/gemini.html');
  const chatgpt = loadHtml('site/chatgpt.html');
  const openai = loadHtml('site/openai.html');
  const claude = loadHtml('site/claude.html');
  const windsurf = loadHtml('site/windsurf.html');
  const howItWorks = loadHtml('site/blog/how-savestate-works.html');
  const migrate = loadHtml('site/blog/migrate-chatgpt-to-claude.html');
  const memoryMoat = loadHtml('site/blog/memory-is-the-new-moat.html');
  const backupPlan = loadHtml('site/blog/why-ai-needs-backup.html');
  const durableFinePrint = loadHtml('site/blog/durable-agents-arent-durable-read-the-fine-print.html');
  const docsMcp = loadHtml('site/docs/mcp.html');
  const docsCli = loadHtml('site/docs/cli.html');
  const docsIndex = loadHtml('site/docs/index.html');
  const docsAdapters = loadHtml('site/docs/adapters.html');
  const docsStorage = loadHtml('site/docs/storage.html');
  const docsEncryption = loadHtml('site/docs/encryption.html');
  const docsTrustKernel = loadHtml('site/docs/trust-kernel.html');
  const docsFormat = loadHtml('site/docs/format.html');
  const docsIncremental = loadHtml('site/docs/incremental.html');
  const knowsEverything = loadHtml('site/blog/your-ai-knows-everything.html');
  const contextRot = loadHtml('site/blog/context-rot-killing-your-ai-agent.html');
  const agenticWorkflows = loadHtml('site/blog/agentic-workflows-need-backups.html');
  const memoryCrisis = loadHtml('site/blog/the-great-ai-memory-crisis.html');
  const hiddenCrisis = loadHtml('site/blog/hidden-crisis-agentic-coding.html');
  const observationalMemory = loadHtml('site/blog/observational-memory-ai-agents.html');
  const wrongProblem = loadHtml('site/blog/cloudflares-agent-memory-solves-the-wrong-problem.html');
  const unitis = loadHtml('site/blog/unitis-12m-raise-needs-a-state-layer.html');
  const context200k = loadHtml('site/blog/200k-context-windows-creating-200k-ways-to-fail.html');
  const missingLayer = loadHtml('site/blog/memory-governance-the-missing-layer.html');
  const autoMode = loadHtml('site/blog/claude-code-auto-mode-changes-what-teams-must-back-up.html');
  const spof = loadHtml('site/blog/your-ai-infrastructure-has-a-single-point-of-failure-youre-not-monitoring.html');
  const oneClick = loadHtml('site/blog/one-click-two-years-gone.html');
  const poisoning = loadHtml('site/blog/memory-poisoning-87-percent.html');
  const mcpServers = loadHtml('site/blog/mcp-memory-servers-ai-context-infrastructure.html');
  const githubMisses = loadHtml('site/blog/github-ai-security-misses-agent-state-risk.html');
  const amnesia = loadHtml('site/blog/cloudflare-vibe-coding-recovery-operational-amnesia.html');
  const wakeUp = loadHtml('site/blog/agent-security-wake-up-call.html');
  const dilemma = loadHtml('site/blog/ai-memory-management-dilemma.html');
  const needBackups = loadHtml('site/blog/why-ai-agents-need-memory-backups-now.html');
  const customAdapters = loadHtml('site/blog/building-custom-adapters.html');
  const backupImperative = loadHtml('site/blog/why-backup-strategies-are-the-new-ai-imperative.html');
  const rollback = loadHtml('site/blog/your-ai-rollback-strategy-is-more-broken-than-you-think.html');
  const governanceRisk = loadHtml('site/blog/ai-governance-is-missing-the-biggest-risk-of-all.html');
  const clawhub = loadHtml('site/blog/savestate-now-on-clawhub.html');
  const backupStrategies = loadHtml('site/blog/ai-backup-strategies.html');
  const poisoningRisk = loadHtml('site/blog/memory-poisoning-ai-agent-security-risk.html');
  const outages = loadHtml('site/blog/ai-backup-strategies-lessons-recent-outages.html');
  const robustMemory = loadHtml('site/blog/robust-memory-management-ai-agents.html');
  const hrGap = loadHtml('site/blog/ai-agents-as-employees-hr-gap.html');
  const memoryRollbacks = loadHtml('site/blog/ai-memory-management-lessons-from-recent-rollbacks.html');
  const agentBackup = loadHtml('site/blog/ai-agent-memory-backup-strategy.html');
  const monitoringStack = loadHtml('site/blog/monitoring-stack-cant-handle-non-deterministic-ai.html');
  const memoryEngineering = loadHtml('site/blog/memory-engineering-disaster-recovery.html');
  const cloudSolutions = loadHtml('site/blog/why-your-ai-needs-more-than-just-cloud-solutions.html');
  const databaseProblem = loadHtml('site/blog/cloudflare-agent-memory-database-problem.html');
  const openaiMemoryBackup = loadHtml('site/blog/ai-memory-backup-strategies.html');
  const heroesStability = loadHtml('site/blog/ai-agent-backups-heroes-of-stability.html');
  const storageNotState = loadHtml('site/blog/cloudflare-agent-memory-solves-storage-not-state-management.html');
  const operationsProblem = loadHtml('site/blog/cloudflares-agent-memory-creates-operations-problem.html');
  const governanceReliability = loadHtml('site/blog/memory-governance-ai-reliability.html');
  const qaProcess = loadHtml('site/blog/testing-ai-agents-is-breaking-your-qa-process.html');
  const memoryComplexity = loadHtml('site/blog/ai-agent-memory-management-complexity.html');
  const techDebt = loadHtml('site/blog/ai-dev-tools-creating-invisible-technical-debt.html');
  const cicdPipeline = loadHtml('site/blog/your-cicd-pipeline-wasnt-built-for-ai-generated-code.html');
  const visualBuilders = loadHtml('site/blog/visual-ai-agent-builders-creating-operational-debt.html');
  const productionBreak = loadHtml('site/blog/your-ai-agents-will-break-in-production.html');
  const incidentResponse = loadHtml('site/blog/your-ai-incident-response-plan-is-already-obsolete.html');
  const cicdSecrets = loadHtml('site/blog/cicd-pipeline-wasnt-built-for-ai-secrets.html');
  const deploymentPipeline = loadHtml('site/blog/ai-deployment-pipeline-new-attack-vector.html');
  const deploymentRisks = loadHtml('site/blog/ai-deployment-risks-lessons.html');
  const openaiApiChanges = loadHtml('site/blog/openai-api-changes-impact-ai-agents.html');
  const openaiMemoryChanges = loadHtml('site/blog/openai-memory-changes-impact-developers.html');
  const openaiApiMemory = loadHtml('site/blog/openai-api-changes-memory-management.html');
  const openaiSecurity = loadHtml('site/blog/openai-security-features-ai-state-management.html');
  const googleSecurity = loadHtml('site/blog/google-ai-security-features-state-management-risks.html');
  const wakeUpOutages = loadHtml('site/blog/ai-memory-management-wake-up-call-outages.html');
  const securityFeaturesRisks = loadHtml('site/blog/ai-security-features-state-management-risks.html');
  const openaiSafety = loadHtml('site/blog/openai-safety-features-state-management-gap.html');
  const securityHiddenRisks = loadHtml('site/blog/ai-security-features-hidden-risks.html');
  const cybersecurityWeakLink = loadHtml('site/blog/ai-state-management-cybersecurity-weak-link.html');
  const transparency = loadHtml('site/blog/ai-state-management-transparency.html');
  const stateRisk = loadHtml('site/blog/ai-state-management-risk.html');
  const hiddenVulnerabilities = loadHtml('site/blog/hidden-vulnerabilities-ai-state-management.html');
  const costOfNeglecting = loadHtml('site/blog/cost-of-neglecting-ai-memory-backups.html');
  const costOfIgnoring = loadHtml('site/blog/cost-of-ignoring-ai-state-management.html');
  const ignoringBackups = loadHtml('site/blog/why-ignoring-ai-state-backups-could-cost-you-in-cybersecurity.html');
  const hiddenRisks = loadHtml('site/blog/hidden-risks-managed-ai-memory-solutions.html');
  const impactOfMemory = loadHtml('site/blog/impact-of-memory-on-ai-performance.html');
  const savestatePivot = loadHtml('site/blog/from-backup-tool-to-memory-layer-the-savestate-pivot.html');
  const pipelineSecurity = loadHtml('site/blog/ai-development-pipeline-security-problem.html');
  const recentUpsets = loadHtml('site/blog/recent-upsets-ai-state-management.html');
  const cisaGuidelines = loadHtml('site/blog/cisa-guidelines-ai-state-management.html');
  const defenseRegulations = loadHtml('site/blog/state-management-ai-defense-regulations.html');
  const safetyRegulations = loadHtml('site/blog/ai-state-management-safety-regulations.html');
  const nistFramework = loadHtml('site/blog/nist-new-framework-ai-state-management.html');
  const cisaNewGuidelines = loadHtml('site/blog/cisa-new-guidelines-ai-state-management.html');
  const cisaElevating = loadHtml('site/blog/cisa-guidelines-elevating-ai-state-management.html');
  const aiRegulations = loadHtml('site/blog/state-management-ai-regulations.html');
  const beyondSafety = loadHtml('site/blog/beyond-safety-state-management-ai.html');
  const regulatoryCompliance = loadHtml('site/blog/regulatory-compliance-ai-state-management.html');
  const alignCisa = loadHtml('site/blog/align-ai-state-management-cisa-guidelines.html');
  const aiCisaGuidelines = loadHtml('site/blog/ai-state-management-cisa-guidelines.html');
  const githubActionsUpdate = loadHtml('site/blog/github-actions-update-ai-state-management.html');
  const hardwareRenaissance = loadHtml('site/blog/hardware-renaissance-ai-state-management.html');
  const risingHardware = loadHtml('site/blog/rising-hardware-prices-ai-state-management.html');
  const hardwareInvestments = loadHtml('site/blog/hardware-investments-ai-state-management.html');
  const ciCd = loadHtml('site/blog/ai-state-management-ci-cd.html');
  const azureUpgrade = loadHtml('site/blog/microsoft-azure-ai-upgrade-state-management.html');
  const funding2026 = loadHtml('site/blog/ai-state-management-funding-2026.html');
  const evolve = loadHtml('site/blog/ai-state-management-evolve.html');
  const continuousDeployment = loadHtml('site/blog/ai-memory-continuous-deployment.html');
  const evolvingStrategy = loadHtml('site/blog/evolving-your-state-management-strategy-for-ai-agents.html');
  const couchbase = loadHtml('site/blog/optimizing-ai-state-management-couchbase-data-plane.html');
  const newStandard = loadHtml('site/blog/the-new-standard-in-ai-memory.html');
  const agentMemoryCrisis = loadHtml('site/blog/agent-memory-crisis-2026.html');
  const aiAmnesia = loadHtml('site/blog/ai-amnesia-agent-memory.html');
  const persistentMemory = loadHtml('site/blog/persistent-memory-ai-strategy.html');

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
    expect(hrefForCta(docsPricing, 'docs-pricing-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsPricing, 'docs-pricing-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsPricing, 'docs-pricing-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
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

  it('points the vibe-coding-fast post CTAs at the live Payment Links', () => {
    expect(hrefForCta(vibeFast, 'vibe-fast-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vibeFast, 'vibe-fast-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(vibeFast, 'vibe-fast-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(vibeFast, 'vibe-fast-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(vibeFast, 'vibe-fast-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Claude Code MCP integration post CTAs at the live Payment Links', () => {
    expect(hrefForCta(claudeMcp, 'claude-mcp-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claudeMcp, 'claude-mcp-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claudeMcp, 'claude-mcp-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(claudeMcp, 'claude-mcp-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(claudeMcp, 'claude-mcp-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the v0.9.0 memory-that-heals-itself post CTAs at the live Payment Links', () => {
    expect(hrefForCta(v090, 'v090-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v090, 'v090-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(v090, 'v090-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(v090, 'v090-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(v090, 'v090-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the v0.9.0 memory-governance post CTAs at the live Payment Links', () => {
    expect(hrefForCta(governance, 'governance-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governance, 'governance-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governance, 'governance-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(governance, 'governance-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(governance, 'governance-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the when-the-thread-dies buyer page CTAs at the live Payment Links', () => {
    expect(hrefForCta(threadDies, 'thread-dies-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(threadDies, 'thread-dies-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(threadDies, 'thread-dies-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(threadDies, 'thread-dies-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(threadDies, 'thread-dies-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(threadDies, 'thread-dies-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(threadDies).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(threadDies, 'thread-dies-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the MCP listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(mcp, 'mcp-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcp, 'mcp-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcp, 'mcp-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcp, 'mcp-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(mcp, 'mcp-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(mcp, 'mcp-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(mcp).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(mcp, 'mcp-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the agent-memory listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(agentMemory, 'agent-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentMemory, 'agent-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentMemory, 'agent-memory-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentMemory, 'agent-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(agentMemory, 'agent-memory-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(agentMemory, 'agent-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(agentMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(agentMemory, 'agent-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Codex listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(codex, 'codex-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(codex, 'codex-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(codex, 'codex-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(codex, 'codex-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(codex, 'codex-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(codex, 'codex-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(codex).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(codex, 'codex-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Gemini listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(gemini, 'gemini-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(gemini, 'gemini-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(gemini, 'gemini-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(gemini, 'gemini-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(gemini, 'gemini-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(gemini, 'gemini-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(gemini).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(gemini, 'gemini-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the ChatGPT listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(chatgpt, 'chatgpt-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(chatgpt, 'chatgpt-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(chatgpt, 'chatgpt-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(chatgpt, 'chatgpt-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(chatgpt, 'chatgpt-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(chatgpt, 'chatgpt-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(chatgpt).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(chatgpt, 'chatgpt-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the OpenAI listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(openai, 'openai-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openai, 'openai-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openai, 'openai-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openai, 'openai-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openai, 'openai-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openai, 'openai-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(openai).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(openai, 'openai-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Claude listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(claude, 'claude-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claude, 'claude-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claude, 'claude-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(claude, 'claude-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(claude, 'claude-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(claude, 'claude-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(claude).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(claude, 'claude-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Windsurf listing page CTAs at the live Payment Links', () => {
    expect(hrefForCta(windsurf, 'windsurf-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(windsurf, 'windsurf-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(windsurf, 'windsurf-footer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(windsurf, 'windsurf-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(windsurf, 'windsurf-footer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(windsurf, 'windsurf-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(windsurf).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
    expect(hrefForCta(windsurf, 'windsurf-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('tells a paying stranger how fulfillment works after checkout', () => {
    for (const html of [post, faq, cursor, claudeCode, clawdbot, compareChrome, compareExport, docsPricing, blogIndex, meet, vmdk, memoryBackup, durable, aiact, threat, stateSecurity, blindSpot, githubSecurity, gymHack, terafab, vibeSafer, v080, greatMigration, architecture, mcpGateway, v070, v060, vibeFast, claudeMcp, v090, governance, threadDies, mcp, agentMemory, codex, gemini, chatgpt, openai, claude, windsurf]) {
      expect(html).toMatch(/After you pay, your API key is emailed/);
      expect(html).toMatch(/savestate login/);
    }
  });

  it('does not keep a waitlist on the marketing pages', () => {
    for (const html of [post, faq, blogIndex, homepage, cursor, claudeCode, clawdbot, compareChrome, compareExport, docsPricing, meet, vmdk, memoryBackup, durable, aiact, threat, stateSecurity, blindSpot, githubSecurity, gymHack, terafab, vibeSafer, v080, greatMigration, architecture, mcpGateway, v070, v060, vibeFast, claudeMcp, v090, governance, threadDies, mcp, agentMemory, codex, gemini, chatgpt, openai, claude, windsurf]) {
      expect(html).not.toMatch(/Join Waitlist/i);
      expect(html).not.toMatch(/waitlist for Pro features/i);
      expect(html).not.toMatch(/id="lead-form"/);
    }
  });

  it('ships SEO, Open Graph, and Twitter meta on the public surfaces', () => {
    for (const html of [post, faq, blogIndex, homepage, cursor, claudeCode, clawdbot, meet, threadDies, mcp, agentMemory, codex, gemini, chatgpt, openai, claude, windsurf]) {
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

  it('lists the when-the-thread-dies buyer page on the live URL path', () => {
    expect(sitemap).toContain('https://savestate.dev/when-the-thread-dies');
    expect(homepage).toContain('href="/when-the-thread-dies"');
    expect(post).toContain('href="/when-the-thread-dies"');
    expect(threadDies).toMatch(/Claude Code/);
    expect(threadDies).toMatch(/Cursor/);
    expect(threadDies).toMatch(/Clawdbot/);
  });

  it('lists the MCP and agent-memory pages on live URL paths', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('https://savestate.dev/mcp');
    expect(sitemap).toContain('https://savestate.dev/agent-memory');
    expect(homepage).toContain('href="/mcp"');
    expect(homepage).toContain('href="/agent-memory"');
    expect(llms).toContain('https://savestate.dev/mcp');
    expect(llms).toContain('https://savestate.dev/agent-memory');
    expect(vercel).toContain('"/mcp"');
    expect(vercel).toContain('"/mcp.html"');
    expect(vercel).toContain('"/agent-memory"');
    expect(vercel).toContain('"/agent-memory.html"');
    expect(mcp).toContain('SaveState');
    expect(mcp).toContain('savestate.dev');
    expect(mcp).toContain(stripe.products.pro.payment_link);
    expect(mcp).toContain('SaveState MCP — encrypted portable memory for agents');
    expect(agentMemory).toContain('SaveState');
    expect(agentMemory).toContain('savestate.dev');
    expect(agentMemory).toContain(stripe.products.pro.payment_link);
    expect(agentMemory).toContain('SaveState — agent memory that survives the chat');
  });

  it('lists the Codex listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('https://savestate.dev/codex');
    expect(homepage).toContain('href="/codex"');
    expect(llms).toContain('https://savestate.dev/codex');
    expect(vercel).toContain('"/codex"');
    expect(vercel).toContain('"/codex.html"');
    expect(codex).toContain('SaveState');
    expect(codex).toContain('savestate.dev');
    expect(codex).toContain(stripe.products.pro.payment_link);
    expect(codex).toContain('When the Codex thread dies, the memory is yours');
    expect(codex).toContain('codex mcp add savestate -- npx -y @savestate/cli mcp');
  });

  it('lists the Gemini listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('https://savestate.dev/gemini');
    expect(homepage).toContain('href="/gemini"');
    expect(llms).toContain('https://savestate.dev/gemini');
    expect(vercel).toContain('"/gemini"');
    expect(vercel).toContain('"/gemini.html"');
    expect(gemini).toContain('SaveState');
    expect(gemini).toContain('savestate.dev');
    expect(gemini).toContain(stripe.products.pro.payment_link);
    expect(gemini).toContain('When the Gemini thread dies, the memory is yours');
    expect(gemini).toContain('savestate snapshot --adapter gemini');
  });

  it('lists the ChatGPT listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('https://savestate.dev/chatgpt');
    expect(homepage).toContain('href="/chatgpt"');
    expect(llms).toContain('https://savestate.dev/chatgpt');
    expect(vercel).toContain('"/chatgpt"');
    expect(vercel).toContain('"/chatgpt.html"');
    expect(chatgpt).toContain('SaveState');
    expect(chatgpt).toContain('savestate.dev');
    expect(chatgpt).toContain(stripe.products.pro.payment_link);
    expect(chatgpt).toContain('When the ChatGPT thread dies, the memory is yours');
    expect(chatgpt).toContain('savestate snapshot --adapter chatgpt');
  });

  it('lists the OpenAI listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('https://savestate.dev/openai');
    expect(homepage).toContain('href="/openai"');
    expect(llms).toContain('https://savestate.dev/openai');
    expect(vercel).toContain('"/openai"');
    expect(vercel).toContain('"/openai.html"');
    expect(openai).toContain('SaveState');
    expect(openai).toContain('savestate.dev');
    expect(openai).toContain(stripe.products.pro.payment_link);
    expect(openai).toContain('When the OpenAI thread dies, the memory is yours');
    expect(openai).toContain('savestate snapshot --adapter openai-assistants');
  });

  it('lists the Claude listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('<loc>https://savestate.dev/claude</loc>');
    expect(homepage).toContain('href="/claude"');
    expect(llms).toContain('https://savestate.dev/claude\n');
    expect(vercel).toContain('"/claude"');
    expect(vercel).toContain('"/claude.html"');
    expect(claude).toContain('SaveState');
    expect(claude).toContain('savestate.dev');
    expect(claude).toContain(stripe.products.pro.payment_link);
    expect(claude).toContain('When the Claude thread dies, the memory is yours');
    expect(claude).toContain('savestate snapshot --adapter claude-web');
  });

  it('points the how-savestate-works post CTAs at the live Payment Links', () => {
    expect(hrefForCta(howItWorks, 'how-it-works-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(howItWorks, 'how-it-works-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(howItWorks, 'how-it-works-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(howItWorks, 'how-it-works-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(howItWorks, 'how-it-works-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(howItWorks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the migrate-chatgpt-to-claude post CTAs at the live Payment Links', () => {
    expect(hrefForCta(migrate, 'migrate-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(migrate, 'migrate-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(migrate, 'migrate-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(migrate, 'migrate-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(migrate, 'migrate-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(migrate).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-is-the-new-moat post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryMoat, 'memory-moat-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryMoat, 'memory-moat-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryMoat, 'memory-moat-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryMoat, 'memory-moat-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryMoat, 'memory-moat-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(memoryMoat).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the why-ai-needs-backup post CTAs at the live Payment Links', () => {
    expect(hrefForCta(backupPlan, 'backup-plan-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupPlan, 'backup-plan-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupPlan, 'backup-plan-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(backupPlan, 'backup-plan-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(backupPlan, 'backup-plan-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(backupPlan).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the durable-agents-arent-durable post CTAs at the live Payment Links', () => {
    expect(hrefForCta(durableFinePrint, 'durable-fine-print-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(durableFinePrint, 'durable-fine-print-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(durableFinePrint, 'durable-fine-print-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(durableFinePrint, 'durable-fine-print-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(durableFinePrint, 'durable-fine-print-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(durableFinePrint).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the MCP docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsMcp, 'docs-mcp-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsMcp, 'docs-mcp-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsMcp, 'docs-mcp-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsMcp, 'docs-mcp-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsMcp, 'docs-mcp-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the CLI docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsCli, 'docs-cli-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsCli, 'docs-cli-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsCli, 'docs-cli-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsCli, 'docs-cli-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsCli, 'docs-cli-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the docs Getting Started CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsIndex, 'docs-index-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsIndex, 'docs-index-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsIndex, 'docs-index-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsIndex, 'docs-index-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsIndex, 'docs-index-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the adapters docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsAdapters, 'docs-adapters-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsAdapters, 'docs-adapters-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsAdapters, 'docs-adapters-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsAdapters, 'docs-adapters-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsAdapters, 'docs-adapters-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the storage docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsStorage, 'docs-storage-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsStorage, 'docs-storage-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsStorage, 'docs-storage-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsStorage, 'docs-storage-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsStorage, 'docs-storage-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the encryption docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsEncryption, 'docs-encryption-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsEncryption, 'docs-encryption-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsEncryption, 'docs-encryption-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsEncryption, 'docs-encryption-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsEncryption, 'docs-encryption-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the Trust Kernel docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsTrustKernel, 'docs-trust-kernel-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsTrustKernel, 'docs-trust-kernel-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsTrustKernel, 'docs-trust-kernel-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsTrustKernel, 'docs-trust-kernel-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsTrustKernel, 'docs-trust-kernel-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the format docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsFormat, 'docs-format-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsFormat, 'docs-format-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsFormat, 'docs-format-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsFormat, 'docs-format-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsFormat, 'docs-format-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the incremental docs CTAs at the live Payment Links', () => {
    expect(hrefForCta(docsIncremental, 'docs-incremental-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsIncremental, 'docs-incremental-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(docsIncremental, 'docs-incremental-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(docsIncremental, 'docs-incremental-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(docsIncremental, 'docs-incremental-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
  });

  it('points the your-ai-knows-everything post CTAs at the live Payment Links', () => {
    expect(hrefForCta(knowsEverything, 'knows-everything-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(knowsEverything, 'knows-everything-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(knowsEverything, 'knows-everything-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(knowsEverything, 'knows-everything-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(knowsEverything, 'knows-everything-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(knowsEverything).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the context-rot post CTAs at the live Payment Links', () => {
    expect(hrefForCta(contextRot, 'context-rot-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(contextRot, 'context-rot-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(contextRot, 'context-rot-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(contextRot, 'context-rot-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(contextRot, 'context-rot-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(contextRot).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the agentic-workflows post CTAs at the live Payment Links', () => {
    expect(hrefForCta(agenticWorkflows, 'agentic-workflows-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agenticWorkflows, 'agentic-workflows-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agenticWorkflows, 'agentic-workflows-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(agenticWorkflows, 'agentic-workflows-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(agenticWorkflows, 'agentic-workflows-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(agenticWorkflows).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the great-ai-memory-crisis post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryCrisis, 'memory-crisis-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryCrisis, 'memory-crisis-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryCrisis, 'memory-crisis-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryCrisis, 'memory-crisis-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryCrisis, 'memory-crisis-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(memoryCrisis).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the hidden-crisis post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hiddenCrisis, 'hidden-crisis-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenCrisis, 'hidden-crisis-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenCrisis, 'hidden-crisis-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hiddenCrisis, 'hidden-crisis-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hiddenCrisis, 'hidden-crisis-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hiddenCrisis).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the observational-memory post CTAs at the live Payment Links', () => {
    expect(hrefForCta(observationalMemory, 'observational-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(observationalMemory, 'observational-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(observationalMemory, 'observational-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(observationalMemory, 'observational-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(observationalMemory, 'observational-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(observationalMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the cloudflare-wrong-problem post CTAs at the live Payment Links', () => {
    expect(hrefForCta(wrongProblem, 'wrong-problem-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wrongProblem, 'wrong-problem-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wrongProblem, 'wrong-problem-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(wrongProblem, 'wrong-problem-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(wrongProblem, 'wrong-problem-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(wrongProblem).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the unitis-12m post CTAs at the live Payment Links', () => {
    expect(hrefForCta(unitis, 'unitis-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(unitis, 'unitis-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(unitis, 'unitis-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(unitis, 'unitis-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(unitis, 'unitis-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(unitis).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the 200k-context post CTAs at the live Payment Links', () => {
    expect(hrefForCta(context200k, 'context-200k-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(context200k, 'context-200k-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(context200k, 'context-200k-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(context200k, 'context-200k-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(context200k, 'context-200k-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(context200k).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-governance missing-layer post CTAs at the live Payment Links', () => {
    expect(hrefForCta(missingLayer, 'missing-layer-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(missingLayer, 'missing-layer-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(missingLayer, 'missing-layer-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(missingLayer, 'missing-layer-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(missingLayer, 'missing-layer-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(missingLayer).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Claude Code auto-mode post CTAs at the live Payment Links', () => {
    expect(hrefForCta(autoMode, 'auto-mode-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(autoMode, 'auto-mode-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(autoMode, 'auto-mode-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(autoMode, 'auto-mode-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(autoMode, 'auto-mode-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(autoMode).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the infrastructure single-point-of-failure post CTAs at the live Payment Links', () => {
    expect(hrefForCta(spof, 'spof-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(spof, 'spof-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(spof, 'spof-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(spof, 'spof-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(spof, 'spof-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(spof).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the one-click-two-years-gone post CTAs at the live Payment Links', () => {
    expect(hrefForCta(oneClick, 'one-click-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(oneClick, 'one-click-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(oneClick, 'one-click-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(oneClick).not.toMatch(/Try SaveState free/);
    expect(oneClick).not.toMatch(/class="btn"[^>]*savestate\.dev"|href="https:\/\/savestate\.dev"[^>]*class="btn"/);
  });

  it('points the memory-poisoning post CTAs at the live Payment Links', () => {
    expect(hrefForCta(poisoning, 'poisoning-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(poisoning, 'poisoning-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(poisoning, 'poisoning-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(poisoning, 'poisoning-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(poisoning, 'poisoning-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(poisoning).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the MCP memory-servers post CTAs at the live Payment Links', () => {
    expect(hrefForCta(mcpServers, 'mcp-servers-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcpServers, 'mcp-servers-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(mcpServers, 'mcp-servers-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(mcpServers, 'mcp-servers-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(mcpServers, 'mcp-servers-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(mcpServers).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the GitHub AI security misses-agent-state post CTAs at the live Payment Links', () => {
    expect(hrefForCta(githubMisses, 'github-misses-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubMisses, 'github-misses-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubMisses, 'github-misses-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(githubMisses, 'github-misses-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(githubMisses, 'github-misses-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(githubMisses).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Cloudflare vibe-coding operational-amnesia post CTAs at the live Payment Links', () => {
    expect(hrefForCta(amnesia, 'amnesia-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(amnesia, 'amnesia-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(amnesia, 'amnesia-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(amnesia, 'amnesia-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(amnesia, 'amnesia-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(amnesia).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the agent security wake-up-call post CTAs at the live Payment Links', () => {
    expect(hrefForCta(wakeUp, 'wake-up-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wakeUp, 'wake-up-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wakeUp, 'wake-up-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(wakeUp, 'wake-up-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(wakeUp, 'wake-up-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(wakeUp).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI memory-management dilemma post CTAs at the live Payment Links', () => {
    expect(hrefForCta(dilemma, 'dilemma-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(dilemma, 'dilemma-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(dilemma, 'dilemma-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(dilemma, 'dilemma-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(dilemma, 'dilemma-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(dilemma).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the building-custom-adapters post CTAs at the live Payment Links', () => {
    expect(hrefForCta(customAdapters, 'custom-adapters-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(customAdapters, 'custom-adapters-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(customAdapters, 'custom-adapters-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(customAdapters, 'custom-adapters-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(customAdapters, 'custom-adapters-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(customAdapters).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the why-ai-agents-need-memory-backups-now post CTAs at the live Payment Links', () => {
    expect(hrefForCta(needBackups, 'need-backups-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(needBackups, 'need-backups-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(needBackups, 'need-backups-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(needBackups, 'need-backups-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(needBackups, 'need-backups-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(needBackups).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the backup-strategies-are-the-new-ai-imperative post CTAs at the live Payment Links', () => {
    expect(hrefForCta(backupImperative, 'backup-imperative-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupImperative, 'backup-imperative-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupImperative, 'backup-imperative-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(backupImperative, 'backup-imperative-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(backupImperative, 'backup-imperative-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(backupImperative).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI rollback-strategy post CTAs at the live Payment Links', () => {
    expect(hrefForCta(rollback, 'rollback-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(rollback, 'rollback-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(rollback, 'rollback-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(rollback, 'rollback-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(rollback, 'rollback-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(rollback).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI governance missing-risk post CTAs at the live Payment Links', () => {
    expect(hrefForCta(governanceRisk, 'governance-risk-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governanceRisk, 'governance-risk-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governanceRisk, 'governance-risk-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(governanceRisk, 'governance-risk-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(governanceRisk, 'governance-risk-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(governanceRisk).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the ClawHub post CTAs at the live Payment Links', () => {
    expect(hrefForCta(clawhub, 'clawhub-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(clawhub, 'clawhub-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(clawhub, 'clawhub-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(clawhub, 'clawhub-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(clawhub, 'clawhub-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(clawhub).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the ai-backup-strategies post CTAs at the live Payment Links', () => {
    expect(hrefForCta(backupStrategies, 'backup-strategies-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupStrategies, 'backup-strategies-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(backupStrategies, 'backup-strategies-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(backupStrategies, 'backup-strategies-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(backupStrategies, 'backup-strategies-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(backupStrategies).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-poisoning security-risk post CTAs at the live Payment Links', () => {
    expect(hrefForCta(poisoningRisk, 'poisoning-risk-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(poisoningRisk, 'poisoning-risk-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(poisoningRisk, 'poisoning-risk-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(poisoningRisk, 'poisoning-risk-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(poisoningRisk, 'poisoning-risk-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(poisoningRisk).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the backup-strategies-lessons-recent-outages post CTAs at the live Payment Links', () => {
    expect(hrefForCta(outages, 'outages-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(outages, 'outages-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(outages, 'outages-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(outages, 'outages-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(outages, 'outages-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(outages).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the robust-memory-management post CTAs at the live Payment Links', () => {
    expect(hrefForCta(robustMemory, 'robust-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(robustMemory, 'robust-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(robustMemory, 'robust-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(robustMemory, 'robust-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(robustMemory, 'robust-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(robustMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI agents-as-employees HR-gap post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hrGap, 'hr-gap-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hrGap, 'hr-gap-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hrGap, 'hr-gap-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hrGap, 'hr-gap-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hrGap, 'hr-gap-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hrGap).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-rollbacks post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryRollbacks, 'memory-rollbacks-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryRollbacks, 'memory-rollbacks-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryRollbacks, 'memory-rollbacks-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryRollbacks, 'memory-rollbacks-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryRollbacks, 'memory-rollbacks-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(memoryRollbacks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI agent memory-backup-strategy post CTAs at the live Payment Links', () => {
    expect(hrefForCta(agentBackup, 'agent-backup-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentBackup, 'agent-backup-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentBackup, 'agent-backup-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(agentBackup, 'agent-backup-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(agentBackup, 'agent-backup-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(agentBackup).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the monitoring-stack post CTAs at the live Payment Links', () => {
    expect(hrefForCta(monitoringStack, 'monitoring-stack-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(monitoringStack, 'monitoring-stack-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(monitoringStack, 'monitoring-stack-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(monitoringStack, 'monitoring-stack-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(monitoringStack, 'monitoring-stack-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(monitoringStack).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-engineering disaster-recovery post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryEngineering, 'memory-engineering-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryEngineering, 'memory-engineering-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryEngineering, 'memory-engineering-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryEngineering, 'memory-engineering-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryEngineering, 'memory-engineering-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(memoryEngineering).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the more-than-just-cloud-solutions post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cloudSolutions, 'cloud-solutions-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cloudSolutions, 'cloud-solutions-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cloudSolutions, 'cloud-solutions-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cloudSolutions, 'cloud-solutions-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cloudSolutions, 'cloud-solutions-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cloudSolutions).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Cloudflare agent-memory database-problem post CTAs at the live Payment Links', () => {
    expect(hrefForCta(databaseProblem, 'database-problem-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(databaseProblem, 'database-problem-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(databaseProblem, 'database-problem-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(databaseProblem, 'database-problem-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(databaseProblem, 'database-problem-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(databaseProblem).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI memory-backup-strategies post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiMemoryBackup, 'openai-memory-backup-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiMemoryBackup, 'openai-memory-backup-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiMemoryBackup, 'openai-memory-backup-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiMemoryBackup, 'openai-memory-backup-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiMemoryBackup, 'openai-memory-backup-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiMemoryBackup).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI agent backups heroes-of-stability post CTAs at the live Payment Links', () => {
    expect(hrefForCta(heroesStability, 'heroes-stability-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(heroesStability, 'heroes-stability-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(heroesStability, 'heroes-stability-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(heroesStability, 'heroes-stability-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(heroesStability, 'heroes-stability-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(heroesStability).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Cloudflare Agent Memory storage-not-state post CTAs at the live Payment Links', () => {
    expect(hrefForCta(storageNotState, 'storage-not-state-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(storageNotState, 'storage-not-state-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(storageNotState, 'storage-not-state-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(storageNotState, 'storage-not-state-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(storageNotState, 'storage-not-state-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(storageNotState).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Cloudflare Agent Memory operations-problem post CTAs at the live Payment Links', () => {
    expect(hrefForCta(operationsProblem, 'operations-problem-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(operationsProblem, 'operations-problem-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(operationsProblem, 'operations-problem-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(operationsProblem, 'operations-problem-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(operationsProblem, 'operations-problem-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(operationsProblem).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-governance reliability post CTAs at the live Payment Links', () => {
    expect(hrefForCta(governanceReliability, 'governance-reliability-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governanceReliability, 'governance-reliability-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(governanceReliability, 'governance-reliability-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(governanceReliability, 'governance-reliability-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(governanceReliability, 'governance-reliability-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(governanceReliability).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the testing-ai-agents QA-process post CTAs at the live Payment Links', () => {
    expect(hrefForCta(qaProcess, 'qa-process-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(qaProcess, 'qa-process-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(qaProcess, 'qa-process-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(qaProcess, 'qa-process-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(qaProcess, 'qa-process-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(qaProcess).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI agent memory-management complexity post CTAs at the live Payment Links', () => {
    expect(hrefForCta(memoryComplexity, 'memory-complexity-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryComplexity, 'memory-complexity-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(memoryComplexity, 'memory-complexity-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(memoryComplexity, 'memory-complexity-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(memoryComplexity, 'memory-complexity-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(memoryComplexity).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI-dev-tools technical-debt post CTAs at the live Payment Links', () => {
    expect(hrefForCta(techDebt, 'tech-debt-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(techDebt, 'tech-debt-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(techDebt, 'tech-debt-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(techDebt, 'tech-debt-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(techDebt, 'tech-debt-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(techDebt).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CI/CD pipeline post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cicdPipeline, 'cicd-pipeline-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cicdPipeline, 'cicd-pipeline-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cicdPipeline, 'cicd-pipeline-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cicdPipeline, 'cicd-pipeline-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cicdPipeline, 'cicd-pipeline-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cicdPipeline).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the visual-agent-builders operational-debt post CTAs at the live Payment Links', () => {
    expect(hrefForCta(visualBuilders, 'visual-builders-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(visualBuilders, 'visual-builders-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(visualBuilders, 'visual-builders-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(visualBuilders, 'visual-builders-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(visualBuilders, 'visual-builders-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(visualBuilders).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the agents-will-break-in-production post CTAs at the live Payment Links', () => {
    expect(hrefForCta(productionBreak, 'production-break-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(productionBreak, 'production-break-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(productionBreak, 'production-break-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(productionBreak, 'production-break-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(productionBreak, 'production-break-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(productionBreak).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the incident-response-plan post CTAs at the live Payment Links', () => {
    expect(hrefForCta(incidentResponse, 'incident-response-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(incidentResponse, 'incident-response-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(incidentResponse, 'incident-response-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(incidentResponse, 'incident-response-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(incidentResponse, 'incident-response-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(incidentResponse).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CI/CD secrets post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cicdSecrets, 'cicd-secrets-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cicdSecrets, 'cicd-secrets-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cicdSecrets, 'cicd-secrets-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cicdSecrets, 'cicd-secrets-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cicdSecrets, 'cicd-secrets-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cicdSecrets).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI deployment-pipeline attack-vector post CTAs at the live Payment Links', () => {
    expect(hrefForCta(deploymentPipeline, 'deployment-pipeline-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(deploymentPipeline, 'deployment-pipeline-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(deploymentPipeline, 'deployment-pipeline-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(deploymentPipeline, 'deployment-pipeline-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(deploymentPipeline, 'deployment-pipeline-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(deploymentPipeline).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI deployment-risks lessons post CTAs at the live Payment Links', () => {
    expect(hrefForCta(deploymentRisks, 'deployment-risks-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(deploymentRisks, 'deployment-risks-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(deploymentRisks, 'deployment-risks-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(deploymentRisks, 'deployment-risks-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(deploymentRisks, 'deployment-risks-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(deploymentRisks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI API-changes post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiApiChanges, 'openai-api-changes-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiApiChanges, 'openai-api-changes-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiApiChanges, 'openai-api-changes-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiApiChanges, 'openai-api-changes-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiApiChanges, 'openai-api-changes-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiApiChanges).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI memory-changes post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiMemoryChanges, 'openai-memory-changes-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiMemoryChanges, 'openai-memory-changes-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiMemoryChanges, 'openai-memory-changes-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiMemoryChanges, 'openai-memory-changes-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiMemoryChanges, 'openai-memory-changes-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiMemoryChanges).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI API memory-management post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiApiMemory, 'openai-api-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiApiMemory, 'openai-api-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiApiMemory, 'openai-api-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiApiMemory, 'openai-api-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiApiMemory, 'openai-api-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiApiMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI security-features post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiSecurity, 'openai-security-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiSecurity, 'openai-security-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiSecurity, 'openai-security-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiSecurity, 'openai-security-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiSecurity, 'openai-security-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiSecurity).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Google AI security-features post CTAs at the live Payment Links', () => {
    expect(hrefForCta(googleSecurity, 'google-security-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(googleSecurity, 'google-security-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(googleSecurity, 'google-security-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(googleSecurity, 'google-security-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(googleSecurity, 'google-security-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(googleSecurity).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the memory-management outages wake-up post CTAs at the live Payment Links', () => {
    expect(hrefForCta(wakeUpOutages, 'wake-up-outages-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wakeUpOutages, 'wake-up-outages-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(wakeUpOutages, 'wake-up-outages-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(wakeUpOutages, 'wake-up-outages-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(wakeUpOutages, 'wake-up-outages-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(wakeUpOutages).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI security-features state-management-risks post CTAs at the live Payment Links', () => {
    expect(hrefForCta(securityFeaturesRisks, 'security-features-risks-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(securityFeaturesRisks, 'security-features-risks-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(securityFeaturesRisks, 'security-features-risks-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(securityFeaturesRisks, 'security-features-risks-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(securityFeaturesRisks, 'security-features-risks-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(securityFeaturesRisks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the OpenAI safety-features post CTAs at the live Payment Links', () => {
    expect(hrefForCta(openaiSafety, 'openai-safety-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiSafety, 'openai-safety-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(openaiSafety, 'openai-safety-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(openaiSafety, 'openai-safety-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(openaiSafety, 'openai-safety-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(openaiSafety).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI security-features hidden-risks post CTAs at the live Payment Links', () => {
    expect(hrefForCta(securityHiddenRisks, 'security-hidden-risks-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(securityHiddenRisks, 'security-hidden-risks-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(securityHiddenRisks, 'security-hidden-risks-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(securityHiddenRisks, 'security-hidden-risks-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(securityHiddenRisks, 'security-hidden-risks-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(securityHiddenRisks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the cybersecurity-weak-link post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cybersecurityWeakLink, 'cybersecurity-weak-link-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cybersecurityWeakLink, 'cybersecurity-weak-link-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cybersecurityWeakLink, 'cybersecurity-weak-link-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cybersecurityWeakLink, 'cybersecurity-weak-link-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cybersecurityWeakLink, 'cybersecurity-weak-link-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cybersecurityWeakLink).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI state-management transparency post CTAs at the live Payment Links', () => {
    expect(hrefForCta(transparency, 'transparency-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(transparency, 'transparency-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(transparency, 'transparency-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(transparency, 'transparency-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(transparency, 'transparency-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(transparency).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI state-management risk post CTAs at the live Payment Links', () => {
    expect(hrefForCta(stateRisk, 'state-risk-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(stateRisk, 'state-risk-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(stateRisk, 'state-risk-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(stateRisk, 'state-risk-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(stateRisk, 'state-risk-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(stateRisk).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the hidden-vulnerabilities post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hiddenVulnerabilities, 'hidden-vulnerabilities-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenVulnerabilities, 'hidden-vulnerabilities-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenVulnerabilities, 'hidden-vulnerabilities-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hiddenVulnerabilities, 'hidden-vulnerabilities-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hiddenVulnerabilities, 'hidden-vulnerabilities-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hiddenVulnerabilities).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the cost-of-neglecting-ai-memory-backups post CTAs at the live Payment Links', () => {
    expect(hrefForCta(costOfNeglecting, 'cost-of-neglecting-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(costOfNeglecting, 'cost-of-neglecting-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(costOfNeglecting, 'cost-of-neglecting-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(costOfNeglecting, 'cost-of-neglecting-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(costOfNeglecting, 'cost-of-neglecting-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(costOfNeglecting).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the cost-of-ignoring-ai-state-management post CTAs at the live Payment Links', () => {
    expect(hrefForCta(costOfIgnoring, 'cost-of-ignoring-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(costOfIgnoring, 'cost-of-ignoring-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(costOfIgnoring, 'cost-of-ignoring-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(costOfIgnoring, 'cost-of-ignoring-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(costOfIgnoring, 'cost-of-ignoring-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(costOfIgnoring).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the ignoring-ai-state-backups cybersecurity post CTAs at the live Payment Links', () => {
    expect(hrefForCta(ignoringBackups, 'ignoring-backups-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(ignoringBackups, 'ignoring-backups-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(ignoringBackups, 'ignoring-backups-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(ignoringBackups, 'ignoring-backups-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(ignoringBackups, 'ignoring-backups-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(ignoringBackups).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the hidden-risks managed-memory post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hiddenRisks, 'hidden-risks-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenRisks, 'hidden-risks-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hiddenRisks, 'hidden-risks-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hiddenRisks, 'hidden-risks-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hiddenRisks, 'hidden-risks-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hiddenRisks).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the impact-of-memory-on-ai-performance post CTAs at the live Payment Links', () => {
    expect(hrefForCta(impactOfMemory, 'impact-of-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(impactOfMemory, 'impact-of-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(impactOfMemory, 'impact-of-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(impactOfMemory, 'impact-of-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(impactOfMemory, 'impact-of-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(impactOfMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the savestate-pivot post CTAs at the live Payment Links', () => {
    expect(hrefForCta(savestatePivot, 'savestate-pivot-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(savestatePivot, 'savestate-pivot-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(savestatePivot, 'savestate-pivot-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(savestatePivot, 'savestate-pivot-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(savestatePivot, 'savestate-pivot-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(savestatePivot).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI development pipeline-security post CTAs at the live Payment Links', () => {
    expect(hrefForCta(pipelineSecurity, 'pipeline-security-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(pipelineSecurity, 'pipeline-security-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(pipelineSecurity, 'pipeline-security-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(pipelineSecurity, 'pipeline-security-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(pipelineSecurity, 'pipeline-security-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(pipelineSecurity).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the recent-upsets-ai-state-management post CTAs at the live Payment Links', () => {
    expect(hrefForCta(recentUpsets, 'recent-upsets-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(recentUpsets, 'recent-upsets-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(recentUpsets, 'recent-upsets-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(recentUpsets, 'recent-upsets-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(recentUpsets, 'recent-upsets-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(recentUpsets).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CISA guidelines post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cisaGuidelines, 'cisa-guidelines-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaGuidelines, 'cisa-guidelines-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaGuidelines, 'cisa-guidelines-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cisaGuidelines, 'cisa-guidelines-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cisaGuidelines, 'cisa-guidelines-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cisaGuidelines).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI defense-regulations post CTAs at the live Payment Links', () => {
    expect(hrefForCta(defenseRegulations, 'defense-regulations-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(defenseRegulations, 'defense-regulations-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(defenseRegulations, 'defense-regulations-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(defenseRegulations, 'defense-regulations-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(defenseRegulations, 'defense-regulations-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(defenseRegulations).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI safety-regulations post CTAs at the live Payment Links', () => {
    expect(hrefForCta(safetyRegulations, 'safety-regulations-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(safetyRegulations, 'safety-regulations-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(safetyRegulations, 'safety-regulations-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(safetyRegulations, 'safety-regulations-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(safetyRegulations, 'safety-regulations-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(safetyRegulations).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the NIST new-framework post CTAs at the live Payment Links', () => {
    expect(hrefForCta(nistFramework, 'nist-framework-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(nistFramework, 'nist-framework-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(nistFramework, 'nist-framework-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(nistFramework, 'nist-framework-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(nistFramework, 'nist-framework-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(nistFramework).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CISA new-guidelines post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cisaNewGuidelines, 'cisa-new-guidelines-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaNewGuidelines, 'cisa-new-guidelines-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaNewGuidelines, 'cisa-new-guidelines-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cisaNewGuidelines, 'cisa-new-guidelines-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cisaNewGuidelines, 'cisa-new-guidelines-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cisaNewGuidelines).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CISA elevating-guidelines post CTAs at the live Payment Links', () => {
    expect(hrefForCta(cisaElevating, 'cisa-elevating-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaElevating, 'cisa-elevating-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(cisaElevating, 'cisa-elevating-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(cisaElevating, 'cisa-elevating-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(cisaElevating, 'cisa-elevating-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(cisaElevating).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI regulations post CTAs at the live Payment Links', () => {
    expect(hrefForCta(aiRegulations, 'ai-regulations-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiRegulations, 'ai-regulations-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiRegulations, 'ai-regulations-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(aiRegulations, 'ai-regulations-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(aiRegulations, 'ai-regulations-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(aiRegulations).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the beyond-safety post CTAs at the live Payment Links', () => {
    expect(hrefForCta(beyondSafety, 'beyond-safety-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(beyondSafety, 'beyond-safety-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(beyondSafety, 'beyond-safety-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(beyondSafety, 'beyond-safety-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(beyondSafety, 'beyond-safety-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(beyondSafety).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the regulatory-compliance post CTAs at the live Payment Links', () => {
    expect(hrefForCta(regulatoryCompliance, 'regulatory-compliance-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(regulatoryCompliance, 'regulatory-compliance-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(regulatoryCompliance, 'regulatory-compliance-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(regulatoryCompliance, 'regulatory-compliance-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(regulatoryCompliance, 'regulatory-compliance-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(regulatoryCompliance).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CISA-align guidelines post CTAs at the live Payment Links', () => {
    expect(hrefForCta(alignCisa, 'align-cisa-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(alignCisa, 'align-cisa-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(alignCisa, 'align-cisa-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(alignCisa, 'align-cisa-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(alignCisa, 'align-cisa-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(alignCisa).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the AI CISA guidelines post CTAs at the live Payment Links', () => {
    expect(hrefForCta(aiCisaGuidelines, 'ai-cisa-guidelines-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiCisaGuidelines, 'ai-cisa-guidelines-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiCisaGuidelines, 'ai-cisa-guidelines-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(aiCisaGuidelines, 'ai-cisa-guidelines-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(aiCisaGuidelines, 'ai-cisa-guidelines-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(aiCisaGuidelines).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the GitHub Actions update post CTAs at the live Payment Links', () => {
    expect(hrefForCta(githubActionsUpdate, 'github-actions-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubActionsUpdate, 'github-actions-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(githubActionsUpdate, 'github-actions-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(githubActionsUpdate, 'github-actions-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(githubActionsUpdate, 'github-actions-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(githubActionsUpdate).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the hardware-renaissance post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hardwareRenaissance, 'hardware-renaissance-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hardwareRenaissance, 'hardware-renaissance-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hardwareRenaissance, 'hardware-renaissance-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hardwareRenaissance, 'hardware-renaissance-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hardwareRenaissance, 'hardware-renaissance-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hardwareRenaissance).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the rising-hardware-prices post CTAs at the live Payment Links', () => {
    expect(hrefForCta(risingHardware, 'rising-hardware-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(risingHardware, 'rising-hardware-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(risingHardware, 'rising-hardware-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(risingHardware, 'rising-hardware-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(risingHardware, 'rising-hardware-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(risingHardware).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the hardware-investments post CTAs at the live Payment Links', () => {
    expect(hrefForCta(hardwareInvestments, 'hardware-investments-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hardwareInvestments, 'hardware-investments-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(hardwareInvestments, 'hardware-investments-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(hardwareInvestments, 'hardware-investments-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(hardwareInvestments, 'hardware-investments-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(hardwareInvestments).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the CI/CD state-management post CTAs at the live Payment Links', () => {
    expect(hrefForCta(ciCd, 'ci-cd-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(ciCd, 'ci-cd-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(ciCd, 'ci-cd-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(ciCd, 'ci-cd-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(ciCd, 'ci-cd-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(ciCd).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the Azure AI upgrade post CTAs at the live Payment Links', () => {
    expect(hrefForCta(azureUpgrade, 'azure-upgrade-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(azureUpgrade, 'azure-upgrade-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(azureUpgrade, 'azure-upgrade-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(azureUpgrade, 'azure-upgrade-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(azureUpgrade, 'azure-upgrade-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(azureUpgrade).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the funding-2026 post CTAs at the live Payment Links', () => {
    expect(hrefForCta(funding2026, 'funding-2026-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(funding2026, 'funding-2026-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(funding2026, 'funding-2026-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(funding2026, 'funding-2026-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(funding2026, 'funding-2026-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(funding2026).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the evolve post CTAs at the live Payment Links', () => {
    expect(hrefForCta(evolve, 'evolve-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(evolve, 'evolve-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(evolve, 'evolve-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(evolve, 'evolve-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(evolve, 'evolve-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(evolve).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the continuous-deployment post CTAs at the live Payment Links', () => {
    expect(hrefForCta(continuousDeployment, 'continuous-deployment-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(continuousDeployment, 'continuous-deployment-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(continuousDeployment, 'continuous-deployment-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(continuousDeployment, 'continuous-deployment-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(continuousDeployment, 'continuous-deployment-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(continuousDeployment).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the evolving-strategy post CTAs at the live Payment Links', () => {
    expect(hrefForCta(evolvingStrategy, 'evolving-strategy-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(evolvingStrategy, 'evolving-strategy-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(evolvingStrategy, 'evolving-strategy-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(evolvingStrategy, 'evolving-strategy-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(evolvingStrategy, 'evolving-strategy-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(evolvingStrategy).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the couchbase post CTAs at the live Payment Links', () => {
    expect(hrefForCta(couchbase, 'couchbase-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(couchbase, 'couchbase-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(couchbase, 'couchbase-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(couchbase, 'couchbase-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(couchbase, 'couchbase-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(couchbase).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the new-standard post CTAs at the live Payment Links', () => {
    expect(hrefForCta(newStandard, 'new-standard-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(newStandard, 'new-standard-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(newStandard, 'new-standard-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(newStandard, 'new-standard-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(newStandard, 'new-standard-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(newStandard).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the agent-memory-crisis post CTAs at the live Payment Links', () => {
    expect(hrefForCta(agentMemoryCrisis, 'agent-memory-crisis-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentMemoryCrisis, 'agent-memory-crisis-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(agentMemoryCrisis, 'agent-memory-crisis-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(agentMemoryCrisis, 'agent-memory-crisis-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(agentMemoryCrisis, 'agent-memory-crisis-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(agentMemoryCrisis).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the ai-amnesia post CTAs at the live Payment Links', () => {
    expect(hrefForCta(aiAmnesia, 'ai-amnesia-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiAmnesia, 'ai-amnesia-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(aiAmnesia, 'ai-amnesia-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(aiAmnesia, 'ai-amnesia-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(aiAmnesia, 'ai-amnesia-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(aiAmnesia).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('points the persistent-memory post CTAs at the live Payment Links', () => {
    expect(hrefForCta(persistentMemory, 'persistent-memory-nav-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(persistentMemory, 'persistent-memory-pro-checkout')).toBe(stripe.products.pro.payment_link);
    expect(hrefForCta(persistentMemory, 'persistent-memory-team-checkout')).toBe(stripe.products.team.payment_link);
    expect(hrefForCta(persistentMemory, 'persistent-memory-npm-secondary')).toBe('https://www.npmjs.com/package/@savestate/cli');
    expect(hrefForCta(persistentMemory, 'persistent-memory-nav-pro-checkout')).not.toMatch(/npmjs\.com/);
    expect(persistentMemory).not.toMatch(/class="btn-nav"[^>]*npmjs\.com|npmjs\.com[^>]*class="btn-nav"/);
  });

  it('lists the Windsurf listing page on the live URL path', () => {
    const vercel = loadHtml('vercel.json');
    const llms = loadHtml('site/llms.txt');
    expect(sitemap).toContain('<loc>https://savestate.dev/windsurf</loc>');
    expect(homepage).toContain('href="/windsurf"');
    expect(llms).toContain('https://savestate.dev/windsurf\n');
    expect(vercel).toContain('"/windsurf"');
    expect(vercel).toContain('"/windsurf.html"');
    expect(windsurf).toContain('SaveState');
    expect(windsurf).toContain('savestate.dev');
    expect(windsurf).toContain(stripe.products.pro.payment_link);
    expect(windsurf).toContain('When Cascade dies, the memory is yours');
    expect(windsurf).toContain('savestate snapshot --adapter windsurf');
  });

  it('leaves MeshGuard strings untouched', () => {
    const stripeConfig = loadHtml('stripe-config.json');
    for (const html of [homepage, cursor, threadDies, mcp, agentMemory, codex, gemini, chatgpt, openai, claude, windsurf, stripeConfig]) {
      expect(html).not.toMatch(/MeshGuard/);
    }
  });
});
