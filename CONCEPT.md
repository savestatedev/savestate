# Savestate

**Your AI's memory. Yours.**

The portable, encrypted memory layer for every AI you use — ChatGPT, Claude, Gemini, Claude Code, OpenAI Assistants, and any agent built on top. Search, restore, and move your AI identity without giving up the keys.

> ChatGPT keeps your memory. Claude keeps your memory. Gemini keeps your memory. **You don't.** SaveState fixes that.

(Originally launched in January 2026 as "Time Machine for AI" — encrypted backup/restore. Pivoted in April 2026 to lead with the memory-layer story; backup is one of many things you can do with the portable archive.)

## The Problem

People are building deep relationships with AI assistants — ChatGPT, Claude, Gemini, custom agents. These contain:
- Months/years of conversation history
- Learned preferences and memories
- Custom instructions and personality
- Tool configurations and workflows
- Project context and knowledge

**None of this is portable. None of it is backed up. If the service goes down, changes their API, or you want to switch — you lose everything.**

Current options are fragmented:
- ChatGPT: manual JSON export (24-48h wait), no encryption
- Claude: memory text export, manual copy/paste
- Custom agents: varies wildly, usually nothing
- No universal format, no encryption, no scheduled backups

## The Solution

Savestate is an encrypted backup and restore system for AI agent state. Think Time Machine, but for your AI.

```bash
npx savestate init                    # Set up encryption + storage
npx savestate snapshot                # Capture current state  
npx savestate snapshot --schedule 6h  # Auto-backup every 6h
npx savestate search "cocktail recs"  # Search across all snapshots
npx savestate restore latest          # Restore to current platform
npx savestate restore v12 --to claude # Migrate to different platform
npx savestate diff v3 v5              # What changed between snapshots
npx savestate export --format html    # Browse your AI's memory
```

## Core Principles

1. **Your data, your keys.** Encryption is non-negotiable. AES-256-GCM with user-controlled keys. We never see your data.
2. **Platform-agnostic.** Works with ChatGPT, Claude, Gemini, Clawdbot, OpenAI Assistants API, custom agents, and more.
3. **CLI-first.** `npm install -g savestate` / `brew install savestate`. Also a web dashboard.
4. **Incremental.** Like git — only captures what changed. Full history, tiny storage.
5. **Searchable.** Query across all snapshots without restoring. Find that conversation from 6 months ago.
6. **Open format.** The Savestate Archive Format (SAF) is open spec. No vendor lock-in for your backup tool either.

## What Gets Captured

### Savestate Archive Format (SAF)

```
savestate-2026-01-27T15:00:00Z.saf.enc
├── manifest.json           # Version, platform, timestamp, checksum
├── identity/
│   ├── personality.md      # System prompt, custom instructions, SOUL
│   ├── config.json         # Settings, preferences, model choices
│   └── tools.json          # Tool/plugin/skill configurations
├── memory/
│   ├── core.json           # Platform memory (ChatGPT memories, Claude memory)
│   ├── knowledge/          # Uploaded docs, project files, RAG sources
│   └── embeddings.bin      # Vector embeddings (optional, for search)
├── conversations/
│   ├── index.json          # Conversation list with metadata
│   └── threads/            # Individual conversation exports
│       ├── abc123.json
│       └── def456.json
└── meta/
    ├── platform.json       # Source platform details
    ├── snapshot-chain.json # Links to parent snapshot (for incrementals)
    └── restore-hints.json  # Platform-specific restore instructions
```

## Platform Adapters

Each AI platform needs an adapter to extract and restore state:

### Tier 1 — Full Support (launch)
| Platform | Extract | Restore | Method |
|----------|---------|---------|--------|
| **Clawdbot** | ✅ | ✅ | Direct file access (SOUL.md, memory/, conversations) |
| **OpenAI Assistants API** | ✅ | ✅ | API (threads, files, instructions, tools) |
| **Claude Code bots** | ✅ | ✅ | CLAUDE.md, memory, project files, conversation state |
| **Custom agents** (file-based) | ✅ | ✅ | Configurable file paths |

### Tier 2 — Extract + Partial Restore
| Platform | Extract | Restore | Method |
|----------|---------|---------|--------|
| **ChatGPT** | ✅ | ⚠️ Memory only | Data export API + browser extension |
| **Claude** (consumer) | ✅ | ⚠️ Memory only | Memory export + Projects import |
| **Gemini** | ✅ | ⚠️ Limited | Google Takeout + Gems |

### Tier 3 — Community Adapters
| Platform | Notes |
|----------|-------|
| **Copilot** | Microsoft Graph API |
| **Poe** | API access |
| **Character.ai** | Limited API |
| **Open-source** (Ollama, LM Studio, etc.) | Local file access |

## Encryption

```
User passphrase
    → Argon2id (memory-hard KDF)
    → 256-bit master key
    → AES-256-GCM per-file encryption
    → HMAC-SHA256 integrity verification
```

- Master key never stored — derived from passphrase each time
- Optional: hardware key support (YubiKey, Touch ID via Secure Enclave)
- Optional: Shamir's Secret Sharing for recovery (split key across N parties)
- Encrypted before it leaves the machine — safe to store anywhere

## Storage Backends

```bash
savestate config storage local           # Default: ~/.savestate/
savestate config storage s3://bucket     # Amazon S3
savestate config storage r2://bucket     # Cloudflare R2
savestate config storage b2://bucket     # Backblaze B2
savestate config storage ~/Dropbox/      # Any sync folder
savestate config storage ~/iCloud/       # iCloud Drive
```

All backends receive only encrypted data. Zero-knowledge by design.

## Revenue Model

### Free Tier
- CLI tool (forever free, open source)
- Local storage
- Manual snapshots
- 1 platform adapter

### Pro ($9/mo)
- Scheduled auto-backups
- Cloud storage (10GB included)
- All platform adapters
- Search across snapshots
- Web dashboard
- Email alerts on backup failures

### Team ($29/mo)
- Shared team backups
- Compliance/audit trails
- SSO
- Priority support
- Custom adapters

### Enterprise
- Self-hosted
- Custom retention policies
- API access for integration
- Dedicated support

## Distribution

```bash
# npm (primary)
npm install -g savestate
npx savestate init

# Homebrew
brew install savestate

# pip
pip install savestate

# Docker
docker run -v ~/.savestate:/data savestate/savestate snapshot

# Binary releases
# macOS (arm64, x64), Linux (arm64, x64), Windows (x64)
curl -fsSL https://savestate.dev/install.sh | sh
```

## Tech Stack

- **CLI**: Node.js (TypeScript) — widest ecosystem reach
- **Encryption**: libsodium (via sodium-native) — proven, audited
- **Storage**: Abstract backend interface (local, S3-compatible, filesystem)
- **Cloud Storage**: Cloudflare R2 (configured via environment variables)
- **Format**: JSON + MessagePack (for binary data) + age encryption
- **Database**: Neon serverless Postgres (via `@neondatabase/serverless`) on Vercel
- **API**: Vercel serverless functions (`api/webhook.ts`, `api/account.ts`, `api/lib/db.ts`)
- **Payments**: Stripe (WithCandor account) — webhook + checkout flow
- **Web Dashboard**: Next.js on Vercel (future)
- **Adapters**: Plugin system (npm packages: @savestate/adapter-chatgpt, etc.)
- **CI/CD**: GitHub Actions (ci.yml: build/lint/smoke; release.yml: npm + binaries + Homebrew)

## Competitive Landscape

| Product | What it does | What it doesn't |
|---------|-------------|-----------------|
| ChatGPT Export | JSON dump of conversations | No encryption, no restore, no schedule, 24-48h wait |
| Claude Memory Export | Text dump of memories | No conversations, no encryption, no automation |
| Context Pack | Reformat convos for migration | Web-only, no encryption, no backup, no restore |
| Chrome extensions | Export individual chats | No encryption, no bulk, no restore, no automation |
| **Savestate** | **All of the above + encrypted + scheduled + searchable + restorable + universal** | — |

Nobody is doing this comprehensively. The closest analogy is 1Password for passwords — Savestate is 1Password for AI identity.

## Go-to-Market

1. **Launch on npm + brew** — developer-first
2. **Open source the CLI + SAF format** — build trust, get adapters contributed
3. **Blog post**: "Your AI knows everything about you. What's your backup plan?"
4. **Hacker News / Product Hunt** launch
5. **Integration partnerships**: Clawdbot (built-in), other agent frameworks
6. **Web dashboard** for non-technical users

## Name & Branding

**Savestate** — from gaming. A save state captures the exact moment in time. Resume from where you left off.

- **Domains**: savestate.dev (primary), savestate.me, savestate.io, savestate.app
- **npm**: `savestate` (available ✅)
- **brew**: `savestate`
- **GitHub**: `savestate/savestate` or `savestatedev/savestate`
- **Tagline**: "Time Machine for AI"
- **Alt taglines**: 
  - "Your AI identity, backed up."
  - "Never lose your AI again."
  - "Ctrl+S for your AI."

## Phase 1 — MVP ✅ (completed Jan 27, 2026)

- [x] CLI scaffolding (init, snapshot, restore, list, diff, config, adapters, search)
- [x] SAF format spec v0.1
- [x] AES-256-GCM encryption with scrypt KDF
- [x] Clawdbot/Moltbot adapter (full extract + restore)
- [x] Claude Code adapter (full extract + restore)
- [x] OpenAI Assistants adapter (full — API v2, threads, files, vector stores)
- [x] Local storage backend
- [x] npm: @savestate/cli v0.2.0 + savestate-ai v0.1.0
- [x] GitHub: savestatedev/savestate
- [x] Landing page at savestate.dev (dark developer-first design)

## Phase 2 — Platforms & Infrastructure ✅ (completed Jan 27, 2026)

- [x] Logo — transparent PNG + SVG (concentric blue rings, circular arrow, pause symbol)
- [x] OpenAI Assistants adapter: full API implementation
- [x] ChatGPT adapter (export-based: conversations, memories, custom instructions)
- [x] Claude consumer adapter (claude.ai export + memory + Projects)
- [x] Gemini adapter (Google Takeout + optional API capture)
- [x] S3/R2 storage backend (AWS Sig V4, zero dependencies, Cloudflare R2 tested)
- [x] Homebrew formula: `brew tap savestatedev/tap && brew install savestate` (v0.2.0)
- [x] Stripe billing: Pro $9/mo + Team $29/mo (products live on WithCandor)
- [x] End-to-end test: full snapshot → restore cycle
- [x] GitHub Actions CI/CD (ci.yml: build/lint/smoke; release.yml: npm + binaries + Homebrew)
- [x] install.sh (platform-detect → binary → npm fallback → brew fallback)
- [x] v0.2.1 release pipeline tested (npm ✅, GitHub Release ✅, 4/5 binaries built)
- [x] Incremental snapshots (delta-only captures, auto-detect parent, chain reconstruction)

## Phase 3 — Launch Readiness (in progress)

- [x] Incremental snapshots (delta-only captures, snapshot chaining) — done in Phase 2
- [x] Stripe Checkout integration (pricing section + Payment Links on savestate.dev)
- [x] Provisioning webhook (api/webhook.ts — Stripe → account creation + API key)
- [x] Account API (api/account.ts — key validation, tier/features/storage)
- [x] CLI login/logout commands (savestate login, savestate logout)
- [x] Account database schema — Neon serverless Postgres (switched from Turso/libSQL Jan 27 evening)
- [x] Deploy webhook + API to Vercel — LIVE at savestate.dev/api/* (Jan 27 evening)
  - `GET /api/account` — validates API key, returns tier/features/storage ✅
  - `POST /api/webhook` — Stripe subscription lifecycle events ✅
  - `GET/PUT/DELETE /api/storage` — cloud storage proxy for Pro/Team ✅
  - Stripe env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) configured
  - R2 env vars (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET) configured
  - SMTP env var (SMTP_PASSWORD) configured for PurelyMail
  - Neon DATABASE_URL auto-injected via Vercel integration
  - Stripe API version: 2025-12-15.clover
- [x] Configure Stripe webhook endpoint URL in Stripe Dashboard (savestate.dev/api/webhook)
  - Events: checkout.session.completed, subscription updated/deleted, invoice.payment_failed
- [x] Welcome email with API key (post-checkout) — PurelyMail SMTP, dark-themed HTML template
  - DNS: MX, SPF, DKIM (x3), DMARC on savestate.dev via Vercel DNS
  - Inboxes: noreply@savestate.dev, hello@savestate.dev (creds in 1Password)
  - Zero-dep raw SMTP over TLS (api/lib/email.ts)
- [x] Cloud storage proxy (R2 bucket proxied through API for Pro/Team)
  - PUT/GET/DELETE/LIST, storage limit enforcement, AWS Sig V4 signing
- [x] End-to-end test: account creation → API key → welcome email → CLI login ✅ (Jan 27, 9:38 PM)
  - Test account provisioned in Neon, API key validated, welcome email delivered, CLI `savestate login` authenticated
- [ ] End-to-end test suite (snapshot → restore → verify across adapters)
- [ ] Encrypted search index (client-side, encrypted separately)
- [ ] Scheduled auto-backups (cron/daemon mode)
- [ ] Search command: full implementation (currently scaffolded)
- [ ] Documentation site (savestate.dev/docs — scaffolded, needs more pages)

## Phase 4 — Growth & Scale (Jan 28, 2026)

- [x] Scheduled auto-backups (`savestate schedule --every 6h`)
  - macOS launchd integration (LaunchAgents)
  - Linux systemd timer + service units
  - Status, enable, disable workflow
- [x] Web dashboard (site/dashboard.html) — Pro/Team subscribers
  - Login with API key
  - View cloud snapshots + storage usage
  - Download/delete snapshots
  - Responsive dark theme
- [x] Migration wizard (`savestate migrate`)
  - Interactive guided migration: ChatGPT → Claude, etc.
  - --list shows platform capabilities
  - --dry-run for preview
  - Clear notes about platform limitations
- [ ] Team features (shared backups, compliance, SSO)
- [ ] Product Hunt launch
- [ ] Blog post: "Your AI knows everything about you. What's your backup plan?"
- [ ] Community adapters: Copilot, Poe, Character.ai, Ollama/LM Studio

## Phase 5 — Memory Layer & Stickiness (April 28, 2026)

The market has shifted: AI assistants treating memory as a first-class product
(ChatGPT Memory, Claude Projects, Gemini Gems, MCP memory servers) means
"backup" alone is commodity table stakes. Stickiness now comes from owning
the cross-platform memory layer and surfacing the *value* of it back to users.
This phase pivots from pure backup to "AI memory layer with portability".

- [x] **Search across snapshots** — `savestate search <query>` decrypts on the
      fly, scores by relevance, returns context snippets across memory,
      identity, conversations, knowledge. Shipped April 28.
- [x] **Stats command** — `savestate stats [--json]` surfaces total snapshots,
      cadence, time covered, adapter mix, and top tags. Engagement loop:
      users come back to see their own data. Shipped April 28.
- [x] **Doctor command** — `savestate doctor [--json]` walks every snapshot
      end-to-end (decrypt → unpack → reconstruct chain → verify checksum)
      and reports per-snapshot health. Cron-friendly exit codes. Shipped
      April 28.
- [x] **Inspect command** — `savestate inspect <id> [--json]` decrypts a
      single snapshot read-only and summarizes its contents (counts of
      memories / conversations / knowledge / tools / skills, chain depth).
      Lets users browse history without restoring. Shipped April 28.
- [x] **Prune command** — `savestate prune` applies retention policy
      (`--keep-last`, `--older-than`) with chain-safety guarantees and a
      dry-run default. Required to keep the index sane on long-running
      installs. Shipped April 28.
- [x] **List filters** — `--since`, `--until`, `--adapter`, `--tag` combine
      as AND on `savestate list`. Makes 100+ snapshot indices navigable.
      Shipped April 28.
- [x] **Doctor adapter/limit filters** — `--adapter <id>` and
      `--limit <n>` make the health check incremental for cron use.
      Shipped April 28.
- [x] **Search snapshot cache** — per-process 32-entry LRU keyed by
      `(snapshot id, passphrase fingerprint)`. Subsequent queries skip
      decrypt + unpack. Major perf win for MCP search workloads.
      Shipped April 28.
- [x] **MCP cross-snapshot tools** — `savestate_search_snapshots` and
      `savestate_stats` exposed via the existing MCP server, so Claude
      Code / Cursor / Codex / any MCP client can recall what a user said
      months ago on a different platform. Shipped April 28. This is the
      "hot infrastructure" pivot point.
- [x] **Signal Fitness League (memory optimization engine)** — paired-inference
      scoring of memory snippets so that low-fitness items are demoted/dropped
      while rare-but-impactful items are protected. Lays the groundwork for
      "memory that earns its place." Shipped April 28 (cherry-picked from PR #184).
- [x] **Manifest-invariant content checksum** — fixed restore-time integrity
      verification. Previous archive-hash semantics were unverifiable because
      the manifest mutates between hash and final pack. Shipped April 28.
- [x] **Trust Kernel Phase 1** — state model + promotion pipeline. PR #183
      merged April 28. Candidate → stable → revoked transitions,
      write/trust/action gates, denylist, audit trail, six-file
      decomposed implementation (types/store/gates/worker) under
      `src/trust-kernel/`. Foundation for the enterprise / Team tier.
      Phase 2 (TrustGate live integration, ActionGate enforcement, audit
      logging) and Phase 3 (shadow rollout, eval harness) still TODO.
- [ ] **Encrypted full-text search index** — current search decrypts every
      snapshot on each query. Build a per-snapshot client-side search index
      that ships alongside the SAF, encrypted with a separate key. Sub-second
      search across hundreds of snapshots without bulk decrypt.
- [x] **MCP memory server adapter** — partial; `savestate_search_snapshots`
      and `savestate_stats` shipped April 28. Still TODO: write-side audit,
      governance integration with Trust Kernel, namespacing.
- [ ] **Time Machine UI** — visual timeline view in the dashboard. Browse
      memories by date, "rewind" to a prior identity state, diff between any
      two points in time. Visceral hook that makes the value obvious.
- [ ] **Memory portability score** — measure what fraction of source platform
      state was successfully captured + restorable per platform. Public
      compatibility matrix; drives ecosystem trust.
- [ ] **Team / compliance tier**: shared snapshots with role-scoped
      decryption, audit logs, SSO, data-residency selection (US / EU R2
      buckets), DPA/SOC2 path. Drives ARPU.
- [ ] **Community adapters**: Copilot, Poe, Character.ai, Ollama/LM Studio,
      Cursor, Windsurf, Codeium, Zed AI.

### Stickiness thesis (why pivot)

1. **Backup is necessary but not engaging.** Users open backup tools when
   something breaks. We need surface area in the *daily* workflow.
2. **Memory is the moat.** Whoever owns the cross-platform memory layer owns
   the relationship. Search + stats + fitness keep users in our surface.
3. **The "1Password for AI identity" framing only works if we are the
   default place users go to inspect, search, and reason about what their
   AI knows.** That's why search/stats/fitness/UI ship before we chase
   more adapters.
4. **MCP integration converts us from cold storage to hot infrastructure.**
   Once SaveState is wired into a user's daily Claude Code / Cursor / Codex
   loop as a memory provider, churn drops to near zero.

### Competitive notes (April 2026)

- ChatGPT Memory has grown more capable but is still siloed; no portability,
  no audit, no encryption boundary the user controls.
- Claude Projects + Memory: similar siloing; export still manual.
- Mem.ai, Heyday, Rewind: personal-knowledge memory, but none with
  encrypted SAF-style portability across providers.
- MCP memory servers (Anthropic + ecosystem): lots of momentum, but most
  implementations are unencrypted and lack lifecycle/governance. SaveState
  + Trust Kernel + Fitness ships the missing governance layer.
- Letta / MemGPT: long-term memory in agents, but as runtime, not as
  user-controlled portable artifact.

## Stripe Products (Live)

| Tier | Product ID | Price ID | Monthly |
|------|-----------|----------|---------|
| Pro | prod_Ts7JDG4QlJTBt6 | price_1SuN4PEJ7b5sfPTDks7Q6SHO | $9 |
| Team | prod_Ts7JeYmlMqwaO3 | price_1SuN4PEJ7b5sfPTDmE9uHVM6 | $29 |

Stripe account: WithCandor (shared across DBH Ventures startups pending LLC approvals)

## Infrastructure Details

### Vercel Projects
- **Main project**: `savestate` (prj_V551D28C7WHtiVXZtr79MjuB648s) — has custom domain, env vars, Neon DB
  - Domain: `savestate.dev` (landing page + API)
  - Env vars: DATABASE_URL (Neon), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- **Legacy project**: `savestate-dev` (prj_DrEiUvqKcCb0yNrIMOcYKJfSGVo6) — same repo, no env vars (domain moved away Jan 27)
- **GitHub**: savestatedev/savestate (auto-deploys on push to main)

### Database
- **Provider**: Neon serverless Postgres (via Vercel Neon integration)
- **Driver**: `@neondatabase/serverless` (tagged template queries)
- **Schema**: `accounts` table — id (UUID), email, api_key (ss_live_*), tier, stripe_customer_id, stripe_subscription_id, stripe_status, storage_used/limit, timestamps
- **Indexes**: email, api_key, stripe_customer_id

### Cloudflare R2
- **Bucket**: Configured via `R2_BUCKET` environment variable
- **Endpoint**: Configured via `R2_ENDPOINT` environment variable
- **Credentials**: 1Password → "clawdbot skill: cloudflare r2"

### 1Password Access
- Password in `OP_PASSWORD` env var (from `~/.clawdbot/.env`)
- The `!` in password breaks bash — use: `printf "%s" "BendDontBreak\\!Steve" > /tmp/.op-pw && export OP_SESSION_my=$(cat /tmp/.op-pw | op signin --account my.1password.com --raw) && rm -f /tmp/.op-pw`

---

*Created: January 27, 2026*
*Last updated: April 28, 2026 — Phase 5 in progress (memory layer pivot)*
*Status: LAUNCHED — Phase 4 shipped, Phase 5 (stickiness) underway*
*Version: 0.9.0 (6 adapters, S3/R2 storage, Neon Postgres, CI/CD, Homebrew, Stripe billing, welcome emails, memory governance, search, stats, Signal Fitness League)*
*Author: David Hurley / Steve (AI)*
