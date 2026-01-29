# Changelog

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
