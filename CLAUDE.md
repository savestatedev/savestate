# CLAUDE.md -- SaveState

## Project Summary

SaveState is "Time Machine for AI" -- an open-source CLI tool that backs up, restores, and migrates AI agent state across platforms. It captures conversations, memories, custom instructions, and configuration from ChatGPT, Claude, Claude Code, Gemini, and other AI platforms, encrypts everything with AES-256-GCM, and stores it locally or in the cloud.

**Website:** https://savestate.dev
**npm:** @savestate/cli
**GitHub:** https://github.com/savestatedev/savestate
**Founder:** David Hurley (https://dbhurley.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 18+ |
| CLI Framework | Commander.js |
| Encryption | AES-256-GCM with scrypt KDF |
| Testing | Vitest |
| Build | tsc (TypeScript compiler) |
| API | Vercel serverless functions |
| Database | Neon serverless Postgres |
| Storage | Local filesystem, S3, Cloudflare R2 |
| Email | PurelyMail (SMTP) |
| Payments | Stripe |
| Landing Page | Static HTML (site/) |
| Deployment | Vercel |

---

## Project Structure

```
savestate/
  src/
    cli.ts              # CLI entry point (commander.js)
    index.ts            # Public API exports
    types.ts            # All TypeScript interfaces
    encryption.ts       # AES-256-GCM encryption/decryption
    format.ts           # SAF archive packing/unpacking
    config.ts           # Configuration management
    snapshot.ts         # Snapshot creation logic
    restore.ts          # Snapshot restoration logic
    incremental.ts      # Delta/incremental snapshot logic
    commands/           # CLI command handlers (init, snapshot, restore, list, diff, etc.)
    adapters/           # Platform adapters (chatgpt, claude, gemini, openai, clawdbot, claude-code)
    storage/            # Storage backends (local, s3, cloud)
    integrity/          # Data integrity verification
    privacy/            # Privacy controls
    memory/             # Memory management
    migrate/            # Cross-platform migration
  api/                  # Vercel serverless functions
    webhook.ts          # Stripe webhook handler
    account.ts          # Account/API key validation
    storage.ts          # Cloud storage proxy (R2)
    lib/                # Shared API utilities (db, email)
  site/                 # Landing page (savestate.dev)
    index.html          # Main landing page
    dashboard.html      # Pro/Team web dashboard
    docs/               # Documentation pages
    blog/               # Blog posts (static HTML)
    robots.txt          # SEO robots directives
    llms.txt            # LLM-readable site description
    sitemap.xml         # Sitemap
  marketing/            # Marketing content and drafts
  AGENTS.md             # Detailed agent instructions (architecture, adapters, encryption)
  CONCEPT.md            # Full product vision and roadmap
```

---

## Key Concepts

1. **SaveState Archive Format (SAF)** -- Open spec for AI state snapshots (.saf.enc files)
2. **Adapters** -- Platform-specific extractors/restorers (6 adapters: ChatGPT, Claude, Claude Code, Gemini, OpenAI Assistants, Clawdbot)
3. **Storage Backends** -- Where encrypted snapshots are stored (local, S3/R2, cloud API)
4. **Encryption** -- AES-256-GCM with scrypt KDF; master key is never stored

---

## Configuration

### vercel.json
- Output directory: site/
- Build command: generates blog index
- API functions at api/**/*.ts
- Rewrites for blog posts and dashboard

### Stripe
- Products: Pro ($9/mo), Team ($29/mo)
- Webhook events: checkout.session.completed, customer.subscription.*, invoice.payment_failed

---

## Development

```bash
npm install
npm run build       # TypeScript to dist/
npm test            # Vitest
npm run dev         # Watch mode
```

Run CLI locally:
```bash
node dist/cli.js --help
```

---

## Code Style

- TypeScript strict mode, explicit types
- Async/await (no raw promises)
- Files: kebab-case.ts
- Interfaces/Types: PascalCase
- Functions/variables: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Prefer Node.js built-ins over external dependencies

---

## Key Files

| File | Purpose |
|------|---------|
| src/types.ts | All TypeScript interfaces -- start here |
| src/format.ts | SAF archive format |
| src/encryption.ts | AES-256-GCM with scrypt |
| src/adapters/interface.ts | Adapter interface for new platforms |
| src/storage/interface.ts | Storage backend interface |
| AGENTS.md | Detailed architecture and contribution guide |
| CONCEPT.md | Product vision, roadmap, business model |
