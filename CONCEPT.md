# Savestate

**Time Machine for AI. Backup, restore, and migrate your AI identity.**

> Your AI knows you — your preferences, your history, your workflows. What happens when it disappears?

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
- **Format**: JSON + MessagePack (for binary data) + age encryption
- **Web Dashboard**: Next.js on Vercel
- **Adapters**: Plugin system (npm packages: @savestate/adapter-chatgpt, etc.)

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

## Phase 3 — Launch Readiness

- [ ] End-to-end test suite (snapshot → restore → verify across adapters)
- [x] Incremental snapshots (delta-only captures, snapshot chaining) — done in Phase 2
- [ ] GitHub Actions CI/CD (build, test, publish npm + Homebrew on release)
- [ ] Binary releases + install.sh (macOS arm64/x64, Linux arm64/x64, Windows x64)
- [ ] Encrypted search index (client-side, encrypted separately)
- [ ] Scheduled auto-backups (cron/daemon mode)
- [ ] Search command: full implementation (currently scaffolded)

## Phase 4 — Growth & Scale

- [ ] Web dashboard (Next.js) — subscriber management, snapshot browser
- [ ] Stripe Checkout integration (payment page on savestate.dev)
- [ ] Migration wizard (ChatGPT → Claude, etc.)
- [ ] Pro tier features (cloud storage, auto-backups, all adapters)
- [ ] Team features (shared backups, compliance, SSO)
- [ ] Product Hunt launch
- [ ] Blog post: "Your AI knows everything about you. What's your backup plan?"
- [ ] Community adapters: Copilot, Poe, Character.ai, Ollama/LM Studio

## Stripe Products (Live)

| Tier | Product ID | Price ID | Monthly |
|------|-----------|----------|---------|
| Pro | prod_Ts7JDG4QlJTBt6 | price_1SuN4PEJ7b5sfPTDks7Q6SHO | $9 |
| Team | prod_Ts7JeYmlMqwaO3 | price_1SuN4PEJ7b5sfPTDmE9uHVM6 | $29 |

Stripe account: WithCandor (shared across DBH Ventures startups pending LLC approvals)

---

*Created: January 27, 2026*
*Last updated: January 27, 2026*
*Status: Phase 2 complete, Phase 3 in progress*
*Version: 0.2.1 (6 adapters, S3/R2 storage, CI/CD, Homebrew, Stripe billing)*
*Author: David Hurley / Steve (AI)*
