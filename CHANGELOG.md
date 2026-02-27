# Changelog

## [Unreleased]

### 🔍 Retrieval Explainability: "Why This Memory?" Inspector

No more black-box retrieval! SaveState now provides full transparency into why specific memories are selected.

#### Features
- **Score Breakdown** — See exactly how each factor (relevance, recency, tier, access, pinned) contributes to retrieval ranking
- **Source Trace** — Track memory provenance: origin snapshot, adapter, platform, and full snapshot chain
- **Policy Path** — Understand which config rules affected each memory (tier assignment, context inclusion, pin protection, demotion warnings)
- **Multiple Formats** — Human-readable terminal output, JSON for automation, Markdown for docs

#### CLI
```bash
savestate memory explain <memory-id>              # Human-readable explanation
savestate memory explain <id> --query "search"    # With query context
savestate memory explain <id> --format json       # Machine-readable
savestate memory explain <id> --format markdown   # Documentation-friendly
```

#### Scoring Algorithm
- **Relevance** (40%) — Content similarity to query
- **Recency** (25%) — Exponential decay based on age
- **Tier** (15%) — L1=100%, L2=70%, L3=40%
- **Access** (10%) — Recent access frequency boost
- **Pinned** (10%) — Manual pin status

See `docs/explainability.md` for full documentation.

Closes #115.

---

### 🧾 Askable Echoes — Auditable Trace Ledger

A new audit trail for agent runs! Captures tool calls, results, checkpoints, and errors for debugging, compliance, and learning.

#### Features
- **Trace Ledger Store** — Append-only JSONL event stream per agent run
- **SAF Integration** — Traces encrypted alongside snapshots (backwards compatible)
- **CLI Commands** — `savestate trace list|show|export` for inspection
- **Secret Redaction** — API keys, tokens, passwords auto-redacted by default
- **Full Adapter Support** — Clawdbot adapter captures + restores traces end-to-end

#### Schema
- Trace schema versioned independently (`schema_version: 1`)
- Event types: `tool_call`, `tool_result`, `message`, `checkpoint`, `error`
- See `docs/trace-ledger.md` for full spec

#### Security
- Path traversal protection in trace filenames
- Configurable redaction keys + custom hooks

Closes #94.

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
