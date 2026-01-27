# ⚡ SaveState

### Time Machine for AI

**Backup, restore, and migrate your AI identity.**

> Your AI knows you — your preferences, your history, your workflows.
> What happens when it disappears?

---

## The Problem

People build deep relationships with AI assistants. Months of conversations, learned preferences, custom instructions, tool configurations — **none of it is portable, none of it is backed up.**

If the service changes, the API breaks, or you want to switch platforms — you lose everything.

## The Solution

SaveState is an encrypted backup and restore system for AI agent state. Think **Time Machine**, but for your AI.

```bash
npx savestate init                     # Set up encryption + storage
npx savestate snapshot                 # Capture current state
npx savestate restore latest           # Restore from last snapshot
npx savestate search "cocktail recs"   # Search across all snapshots
npx savestate diff v3 v5               # What changed between snapshots
```

## Features

- 🔐 **Encrypted at rest** — AES-256-GCM with scrypt key derivation. Your keys, your data.
- 📦 **Open archive format** — The SaveState Archive Format (SAF) is an open spec. No vendor lock-in.
- 🔌 **Platform adapters** — Works with ChatGPT, Claude, Gemini, Clawdbot, OpenAI Assistants, and more.
- 🔍 **Searchable** — Query across all snapshots without restoring. Find anything.
- 📊 **Incremental** — Like git — only captures what changed. Full history, tiny storage.
- 💾 **Flexible storage** — Local filesystem, S3, R2, Backblaze, Dropbox, iCloud — you choose.
- ⏰ **Scheduled backups** — Set it and forget it. Auto-snapshot on your schedule.
- 🖥️ **CLI-first** — Built for developers. Also has a web dashboard (coming soon).

## Quick Start

```bash
# Install globally
npm install -g savestate

# Initialize in your AI workspace
cd ~/my-ai-workspace
savestate init

# Take your first snapshot
savestate snapshot

# List all snapshots
savestate list

# Search across snapshots
savestate search "that recipe from last month"

# Restore from a snapshot
savestate restore latest
```

## Supported Platforms

| Platform | Extract | Restore | Status |
|----------|---------|---------|--------|
| **Clawdbot / Moltbot** | ✅ | ✅ | Available now |
| **OpenAI Assistants API** | ✅ | ✅ | Coming soon |
| **Custom file-based agents** | ✅ | ✅ | Coming soon |
| **ChatGPT** | ✅ | ⚠️ Partial | Planned |
| **Claude** | ✅ | ⚠️ Partial | Planned |
| **Gemini** | ✅ | ⚠️ Limited | Planned |

Community adapters welcome! See [Contributing](#contributing).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  SaveState CLI                    │
│    init · snapshot · restore · search · diff      │
├─────────────────────────────────────────────────┤
│              Adapter Layer                        │
│   clawdbot · chatgpt · claude · openai · custom   │
├─────────────────────────────────────────────────┤
│              Core Engine                          │
│   snapshot · restore · search · diff · format     │
├─────────────────────────────────────────────────┤
│              Encryption Layer                     │
│   AES-256-GCM · scrypt KDF · integrity check     │
├─────────────────────────────────────────────────┤
│              Storage Backends                     │
│   local · s3 · r2 · b2 · filesystem              │
└─────────────────────────────────────────────────┘
```

### SaveState Archive Format (SAF)

Each snapshot produces a `.saf.enc` file:

```
snapshot.saf.enc (encrypted)
  └── snapshot.tar.gz
       ├── manifest.json           # Version, platform, timestamp, checksum
       ├── identity/
       │   ├── personality.md      # System prompt, SOUL, custom instructions
       │   ├── config.json         # Settings, preferences
       │   └── tools.json          # Tool/plugin configurations
       ├── memory/
       │   ├── core.json           # Platform memory entries
       │   └── knowledge/          # Uploaded docs, RAG sources
       ├── conversations/
       │   ├── index.json          # Conversation list with metadata
       │   └── threads/            # Individual conversation exports
       └── meta/
           ├── platform.json       # Source platform details
           ├── snapshot-chain.json # Incremental snapshot chain
           └── restore-hints.json  # Platform-specific restore steps
```

### Encryption

```
User passphrase
    → scrypt (N=2^17, r=8, p=1) key derivation
    → 256-bit AES key
    → AES-256-GCM authenticated encryption
    → Integrity verification built into GCM auth tag
```

Your master key is never stored — it's derived from your passphrase each time. Data is encrypted before it leaves your machine.

## CLI Reference

```
savestate init                        Initialize SaveState in current directory
savestate snapshot                    Capture current AI state
  -l, --label <label>                Label for the snapshot
  -t, --tags <tags>                  Comma-separated tags
  -a, --adapter <adapter>            Adapter to use
  -s, --schedule <interval>          Auto-snapshot interval (e.g., 6h)
savestate restore [snapshot-id]       Restore from a snapshot (default: latest)
  --to <platform>                    Restore to different platform
  --dry-run                          Preview without making changes
  --include <categories>             Only restore specific categories
savestate list                        List all snapshots
  --json                             Output as JSON
  --limit <n>                        Max snapshots to show
savestate search <query>              Search across snapshots
  --type <types>                     Filter by content type
  --limit <n>                        Max results
savestate diff <a> <b>                Compare two snapshots
savestate config                      View/edit configuration
  --set <key=value>                  Set a config value
  --json                             Output as JSON
savestate adapters                    List available adapters
```

## Storage Backends

```bash
# Local filesystem (default)
savestate config --set storage.type=local

# Amazon S3
savestate config --set storage.type=s3
savestate config --set storage.options.bucket=my-savestate-backups

# Cloudflare R2
savestate config --set storage.type=r2

# Any sync folder (Dropbox, iCloud, etc.)
savestate config --set storage.type=local
savestate config --set storage.options.path=~/Dropbox/savestate
```

All backends receive **only encrypted data**. Zero-knowledge by design.

## Contributing

SaveState is open source. We welcome contributions!

### Building from source

```bash
git clone https://github.com/savestatedev/savestate.git
cd savestate
npm install
npm run build
node dist/cli.js --help
```

### Creating an adapter

Adapters implement the `Adapter` interface:

```typescript
import type { Adapter, Snapshot, PlatformMeta } from 'savestate';

export class MyAdapter implements Adapter {
  readonly id = 'my-platform';
  readonly name = 'My Platform';
  readonly platform = 'my-platform';
  readonly version = '0.1.0';

  async detect(): Promise<boolean> { /* ... */ }
  async extract(): Promise<Snapshot> { /* ... */ }
  async restore(snapshot: Snapshot): Promise<void> { /* ... */ }
  async identify(): Promise<PlatformMeta> { /* ... */ }
}
```

Publish as `@savestate/adapter-<name>` on npm for auto-discovery.

### Project structure

```
src/
├── cli.ts              # CLI entry point (commander)
├── index.ts            # Public API
├── types.ts            # All TypeScript interfaces
├── encryption.ts       # AES-256-GCM encryption
├── format.ts           # SAF archive packing/unpacking
├── config.ts           # Configuration management
├── snapshot.ts         # Snapshot creation
├── restore.ts          # Snapshot restoration
├── search.ts           # Cross-snapshot search
├── commands/           # CLI command handlers
│   ├── init.ts
│   ├── snapshot.ts
│   ├── restore.ts
│   ├── list.ts
│   ├── search.ts
│   ├── diff.ts
│   ├── config.ts
│   └── adapters.ts
├── storage/            # Storage backends
│   ├── interface.ts
│   └── local.ts
└── adapters/           # Platform adapters
    ├── interface.ts
    ├── clawdbot.ts
    └── registry.ts
```

## License

MIT © [SaveState Contributors](LICENSE)

---

<p align="center">
  <strong>SaveState</strong> — Your AI identity, backed up.<br>
  <a href="https://savestate.dev">savestate.dev</a>
</p>
