# Changelog

## [Unreleased]

---

## [0.9.0] - 2026-02-27

### 🔒 Privacy Controls (#117)
- **PII Redaction**: Auto-detect and redact emails, phone numbers, SSNs, API keys before storage
- **Deny-list Policy**: Configure fields and patterns that must never be persisted
- **Deletion Guarantees**: Cryptographic proof of deletion for compliance workflows

### 🔄 Memory Lifecycle Controls (#110)
- `savestate memory edit` to correct stored facts
- `savestate memory rollback` to revert to previous state
- `savestate memory expire` with TTL and decay policies
- Full audit log for all memory mutations

### 📊 Memory Quality Framework (#113)
- Confidence scoring for stored memories
- Staleness detection and relevance ranking
- Ingestion quarantine for low-confidence entries (#106)
- Retrieval relevance improvements (#101)

### 🏗️ Multi-tier Memory Architecture
- **L1 (Hot)**: In-session working memory
- **L2 (Warm)**: Cross-session persistent memory
- **L3 (Cold)**: Archived, searchable long-term storage

### 🧾 Askable Echoes: Trace Ledger (#94)
- Append-only JSONL event stream per agent run
- SAF integration (encrypted, backwards compatible)
- CLI: `savestate trace list|show|export`
- Auto-redaction of secrets (API keys, tokens, passwords)

### 🛡️ Core Integrity + Decision Guard (#68)
- Memory ingestion validation and quarantine
- Decision guard for high-stakes agent actions

### 📍 Path-addressable State Filesystem (#70)
- Address any piece of agent state by path
- Granular backup and restore of specific state subtrees

### 📋 Checkpoint Ledger (#47)
- Deterministic memory checkpoint system
- Point-in-time restore for any checkpoint

### 🎯 Action Recall Drillbook (#73)
- Structured action history with recall scoring
- Agent self-evaluation of past decisions

### 🩹 Failure Antibody System (#100)
- Warn-only failure pattern detection
- Agents learn from past failures to avoid repeating them

### 🧹 Repo Cleanup (#124)
- Cleaned up stray files from repo root
- Organized blog posts and documentation

---

## [0.8.0] - 2026-02-10

### 🚀 Migration Wizard — Full Release

Complete bidirectional migration between ChatGPT and Claude is here!

#### Features
- **Full Bidirectional Migration** — Seamlessly move your AI identity between ChatGPT ↔ Claude
- **Interactive CLI** — Beautiful progress bars and step-by-step guidance
- **`--dry-run` Mode** — Preview what will be migrated without making changes
- **`--review` Mode** — Inspect and approve each migration step interactively
- **`--resume` Mode** — Continue interrupted migrations from the last checkpoint

#### Testing & Quality
- **372 tests** — Comprehensive test coverage across all migration paths
- Complete documentation for migration workflows

#### Security
- Path traversal protection in all file handling operations
- Secure checkpoint storage with integrity verification

---

## [0.7.0] - 2026-02-09

### Added
- **Migration Wizard Core** — New `savestate migrate` command architecture
- **ChatGPT Extractor** — Extract custom instructions, memories, conversations, files, and GPTs
- **Claude Loader** — Load migration data into Claude Projects
- **Transform Rules Engine** — Bidirectional ChatGPT ↔ Claude transformations
- Checkpoint/resume capability for migrations
- Rollback support for failed migrations
- Compatibility report generation

### Security
- Path traversal protection in file handling
- Removed hardcoded infrastructure fallbacks

### Changed
- 159 tests now passing

---

## [0.5.0] - 2026-02-02

### 🚀 Full OpenClaw Runtime State Capture

The OpenClaw/Clawdbot adapter now captures your **complete agent state** for true personality restoration:

#### New Captures
- **Gateway config** (`openclaw.json`) — agent definitions, model preferences, channel routing
- **Cron jobs** (`cron/jobs.json`) — all scheduled behaviors and reminders
- **Device identity** — device pairing and authentication
- **Paired nodes** — mobile node relationships
- **Channel state** — Telegram update offsets for message continuity
- **Memory databases** — SQLite semantic memory (up to 100MB per agent)
- **Credentials** — channel auth tokens (opt-in with `--include-credentials`)

#### Security
- API keys and secrets are **redacted by default** in gateway config
- Credentials excluded unless explicitly requested
- Memory databases indexed with SHA-256 checksums

#### New CLI Options
```bash
savestate snapshot --include-credentials  # Include channel auth tokens
savestate snapshot --no-redact-secrets    # Keep API keys in config
savestate snapshot --agent-id main        # Backup single agent only
```

#### Additional Identity Files
- Now captures: `IDENTITY.md`, `BOOTSTRAP.md`, `HEARTBEAT.md`

#### Backward Compatible
- Supports all config directory names: `.openclaw`, `.moltbot`, `.clawdbot`
- Supports all gateway config names: `openclaw.json`, `moltbot.json`, `clawdbot.json`

---

## [0.4.2] - 2026-01-29

### Bug Fixes

- **FIXED**: Cloud push "file not found" — was looking in wrong directory (`.savestate/` instead of `~/.savestate/`)
- **FIXED**: CLI `--version` now correctly shows current version (was stuck on 0.1.0)
- **Added**: robots.txt and sitemap.xml for SEO
- **Added**: Open Graph and Twitter Card meta tags
- **Added**: install.sh accessible from website

---

## [0.4.1] - 2026-01-29

### Cloud Storage Improvements

- **Fixed**: CLI now properly calls the cloud storage API (was using wrong endpoints)
- **Fixed**: Storage usage tracking on upload/delete (handles re-uploads correctly)
- **Added**: `savestate cloud delete` command for removing cloud snapshots
- **Improved**: Storage quota calculation accounts for file replacements
- **Improved**: Better error messages for cloud operations

---

## [0.4.0] - 2026-01-29

### 🔒 Security & Pricing Enforcement

- **BREAKING**: Direct cloud storage (S3/R2/B2) removed from free CLI
- Cloud backups now require Pro or Team subscription
- New `savestate cloud` commands for managed cloud storage:
  - `savestate cloud push` — Upload snapshots to SaveState cloud
  - `savestate cloud pull` — Download snapshots from cloud
  - `savestate cloud list` — List cloud snapshots with usage stats
- Server-side subscription verification for all cloud operations
- Storage quotas enforced (Pro: 10GB, Team: 100GB)

### Why This Change

Previously, users could configure their own S3/R2 credentials directly in the CLI,
bypassing the subscription model. This release properly enforces the pricing tiers:

- **Free**: Local storage only, 1 adapter, manual snapshots
- **Pro ($9/mo)**: Cloud storage (10GB), all adapters, scheduled backups
- **Team ($29/mo)**: Cloud storage (100GB), SSO, compliance features

### Migration

If you were using `--storage s3` or similar:

1. Run `savestate login` to authenticate
2. Subscribe to Pro at https://savestate.dev/#pricing
3. Use `savestate cloud push` to upload existing local snapshots
4. Future backups: `savestate snapshot` (local) + `savestate cloud push`

Local storage continues to work unchanged for free users.

---

## [0.3.1] - 2026-01-28

- Fix incremental snapshot chain resolution
- Improve adapter detection for Claude Code
- Better error messages for missing passphrase

## [0.3.0] - 2026-01-28

- Add `savestate migrate` command for cross-platform migration
- Add ChatGPT memory adapter
- Add Gemini adapter (settings.json)
- Incremental snapshots with delta compression

## [0.2.1] - 2026-01-27

- Add `savestate schedule` for automatic backups (Pro/Team)
- Add `savestate search` for full-text search
- S3-compatible storage backend
- Homebrew tap: `brew install savestatedev/tap/savestate`

## [0.2.0] - 2026-01-27

- Add `savestate login/logout` for API authentication
- Add 6 platform adapters (Clawdbot, Claude Code, OpenAI Assistants, ChatGPT, Claude.ai, Gemini)
- Incremental snapshots (only capture changes)
- Improved diff command with side-by-side view

## [0.1.0] - 2026-01-27

- Initial release
- Core commands: init, snapshot, restore, list, diff, config, adapters
- AES-256-GCM encryption with scrypt KDF
- Local storage backend
- SaveState Archive Format (SAF) v0.1
