# CLAUDE.md -- SaveState

## Project Summary

SaveState is "Your AI's memory. Yours." — the portable, encrypted memory layer for every AI a user touches. Open-source CLI + MCP server + cloud-optional backend that captures conversations, memories, custom instructions, and configuration from ChatGPT, Claude, Claude Code, Gemini, OpenAI Assistants, and Clawdbot, encrypts everything with AES-256-GCM, and lets users search / restore / migrate across platforms — without giving up the keys.

(Originally launched January 2026 as "Time Machine for AI" — encrypted backup/restore. Pivoted in April 2026 to lead with the memory-layer story. Same product, much bigger market: backup is one of many things you can do with the portable archive, alongside cross-platform search, MCP runtime memory, governance, and migration.)

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
    search.ts           # Cross-snapshot search (decrypt-on-the-fly, scored)
    commands/           # CLI command handlers (init, snapshot, restore, list, diff, search, stats, etc.)
    adapters/           # Platform adapters (chatgpt, claude, gemini, openai, clawdbot, claude-code)
    storage/            # Storage backends (local, s3, cloud)
    integrity/          # Data integrity verification
    privacy/            # Privacy controls
    memory/             # Memory management
    migrate/            # Cross-platform migration
    fitness/            # Signal Fitness League — memory optimization engine
    trust-kernel/       # State model + promotion pipeline (gating new memories)
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

---

## Current State (April 28, 2026)

**Phase 5 in progress** — pivoting from "backup tool" to "AI memory layer with
portability." Backup is commodity; the moat is owning the cross-platform
memory layer and surfacing it back to users via search, stats, and runtime
integrations (MCP). See `CONCEPT.md` Phase 5 for full thesis.

Recently landed (April 28, 2026):
- `savestate search <query>` — full implementation; decrypts snapshots on the
  fly, scores by phrase + word + position, returns context snippets across
  memory / identity / conversations / knowledge.
- `savestate stats [--json]` — engagement loop: shows total snapshots, time
  covered, cadence, adapter mix, top tags.
- `savestate doctor [--json]` — chain-integrity health check across every
  snapshot. Decrypts, unpacks, walks incremental chains, verifies content
  checksums, reports per-snapshot status + summary. Exit non-zero on any
  unhealthy snapshot so it can be wired into cron.
- `savestate inspect <id> [--json]` — decrypt + summarize a snapshot
  without restoring. Read-only counterpart to `restore`; counts of
  memories / conversations / knowledge / tools / skills, chain depth,
  parent. Useful for browsing history and debugging.
- `savestate prune` — apply retention policy. `--keep-last N` and/or
  `--older-than DATE` select drops; `--apply` actually deletes (default
  is dry-run). Refuses to drop the newest snapshot or any sole snapshot
  per adapter. JSON plan output for tooling.
- `savestate doctor --adapter <id> --limit <n>` — restrict the health
  check to one adapter or the most recent N snapshots. Useful for cron
  jobs that run incrementally.
- Search snapshot cache — `searchSnapshots` now keeps a 32-entry LRU of
  decrypted snapshots keyed by `(snapshot id, passphrase fingerprint)`.
  Repeat queries within a process avoid re-decrypt + re-unpack. Real
  win when the MCP search tool gets called multiple times in a session.
- `savestate list` filters: `--since`, `--until`, `--adapter`, `--tag`
  combine as AND. Throws on invalid date strings. The base `list` is now
  practical at 100+ snapshots.
- MCP `savestate_search_snapshots` + `savestate_stats` tools — the cross-
  snapshot search and stats surfaces are now callable from any MCP client
  (Claude Code, Cursor, Codex, etc.). This is the Phase 5 "hot
  infrastructure" hook; SaveState becomes a memory provider, not just a
  backup tool.
- **Signal Fitness League** (`src/fitness/`) — paired-inference shadow
  scoring of memory snippets so low-fitness items demote/drop while
  rare-but-impactful items are protected. Foundation for "memory that earns
  its place." Cherry-picked from PR #184.
- **Manifest-invariant content checksum** — `computeContentChecksum` hashes
  archive files excluding `manifest.json`, fixing a long-standing bug where
  `restore` could not actually verify integrity (the manifest mutates after
  the first hash). Old snapshots warn but do not fail.
- Memory store tests: rebuilt `better-sqlite3` for current Node ABI (was
  failing locally on Node 25 with NODE_MODULE_VERSION mismatch).

Open PRs reviewed:
- **#184** (Signal Fitness League) — module merged April 28; PR closed.
- **#185** (Looper template strip) — closed April 28 as regression.
- **#183** (Trust Kernel Phase 1) — module merged April 28; PR closed.
  Replaced the prior single-file `src/trust-kernel/index.ts` (zero callers)
  with PR #183's six-file decomposed implementation
  (types/store/gates/worker), kept the directory name `src/trust-kernel/`
  to match documentation. 25 trust tests added; total 1226 passing.

Phase 5 pivot (April 28, 2026):
- Hero reframe shipped across landing, README, CONCEPT, AGENTS, CLAUDE,
  package.json, CLI description: "Time Machine for AI" → "Your AI's
  memory. Yours." Backup is now framed as one of many things you can do
  with the portable archive; the headline is the cross-platform memory
  layer.
- MCP-first distribution: new `site/docs/mcp.html` setup guide for
  Claude Code / Cursor / Codex; landing CTA includes the MCP JSON
  snippet alongside the npm one-liner; "Run as an MCP memory provider"
  card with NEW badge.
- Time Machine UI shipped in `site/dashboard.html`: horizontal timeline
  of cloud snapshots, color-coded by inferred adapter, click any dot to
  expand details + copy a `savestate restore <id>` command.
- Obsidian project doc moved from `Projects/4-Active/` to
  `Projects/2-Core/` and updated to reflect Phase 5 status.
- Founder-narrative pivot blog post:
  `site/blog/from-backup-tool-to-memory-layer-the-savestate-pivot.html`,
  now the featured post on /blog after regenerating the index.

Next-up Phase 5 work (in priority order):
1. Trust Kernel Phase 2 — TrustGate integration into the live memory
   path, ActionGate enforcement, full audit logging.
2. Encrypted full-text search index (per-snapshot, separately keyed) —
   turns `savestate search` from O(N decrypts) into O(1).
3. Team / compliance tier (SSO, audit logs, data-residency selection).
4. MCP catalog presence across Claude Code / Cursor / Codex registries.
5. Community adapters: Cursor, Windsurf, Codeium, Zed AI.

## Claude Code Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Bias toward caution over speed.

### Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — do not pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what is confusing. Ask.

### Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### Surgical Changes
- Do not "improve" adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- Every changed line should trace directly to the user's request.

### Goal-Driven Execution
- Transform tasks into verifiable goals with success criteria.
- For multi-step tasks, state a brief plan with verification checkpoints.
- Strong success criteria enable independent work. Weak criteria require constant clarification.
