# ⚡ SaveState

### Your AI's memory. Yours.

**The portable, encrypted memory layer for every AI you use.**

> ChatGPT keeps your memory. Claude keeps your memory. Gemini keeps your memory.
> **You don't.** SaveState fixes that.

---

## The Problem

Every AI you use is building a model of you — your preferences, history, projects, voice. Each platform locks that memory up in its own silo. There is no portability, no audit trail, no encryption boundary the user controls. If a service changes its API, you switch platforms, or your account is suspended, **everything that AI learned about you is gone.**

Worse: even within a single platform, "memory" is shallow. 1M-token context windows don't fix it — research shows reliable recall drops below 50% past 256K. Your assistant forgets what you told it last month.

## The Solution

SaveState is the cross-platform memory layer you control. One encrypted, searchable, portable archive for everything your AIs know about you.

```bash
npx savestate init                     # one-time: encryption + storage
npx savestate snapshot                 # capture state from any platform
npx savestate search "cocktail recs"   # full-text across every snapshot
npx savestate restore latest --to claude  # move state between platforms
npx savestate mcp                      # serve memory to Claude Code / Cursor / Codex
```

Think of it as **1Password for AI identity**: your data, encrypted with your keys, portable across every platform — backup is just one of the things you can do with it.

## Features

- 🔐 **Encrypted at rest** — AES-256-GCM with scrypt key derivation. Your keys, your data.
- 📦 **Open archive format** — The SaveState Archive Format (SAF) is an open spec. No vendor lock-in.
- 🔌 **Platform adapters** — Works with ChatGPT, Claude, Gemini, Clawdbot, OpenAI Assistants, and more.
- 📊 **Incremental** — Like git — only captures what changed. Full history, tiny storage.
- 💾 **Flexible storage** — Local filesystem (free) or SaveState Cloud (Pro/Team).
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

# Restore from a snapshot
savestate restore latest
```

## Supported Platforms

| Platform | Extract | Restore | Status |
|----------|---------|---------|--------|
| **OpenClaw / Clawdbot / Moltbot** | ✅ | ✅ | **Full support** |
| **OpenAI Assistants API** | ✅ | ✅ | Available |
| **Claude Code** | ✅ | ✅ | Available |
| **ChatGPT** | ✅ | ⚠️ Partial | Available |
| **Claude (consumer)** | ✅ | ⚠️ Partial | Available |
| **Gemini** | ✅ | ⚠️ Limited | Available |
| **Cursor** | ✅ | ✅ | Community (v0.1.0) |
| **Windsurf** | ✅ | ✅ | Community (v0.1.0) |

### OpenClaw Full Backup (v0.3.0+)

The OpenClaw adapter captures your **complete agent state**:

| Component | What's Captured |
|-----------|-----------------|
| **Identity** | SOUL.md, USER.md, AGENTS.md, TOOLS.md, IDENTITY.md |
| **Memory** | MEMORY.md, memory/*.md, memory SQLite databases |
| **Skills** | All SKILL.md files + scripts |
| **Scripts** | personal-scripts/, cron-wrappers/ |
| **Extensions** | Extension configs |
| **Conversations** | All session JSONL files (1000+ sessions) |
| **Gateway Config** | openclaw.json (agent defs, models, routing) |
| **Cron Jobs** | Scheduled tasks and behaviors |
| **Channel State** | Telegram offsets, message continuity |
| **Device Identity** | Device pairing, node relationships |

```bash
# Full backup including semantic memory DBs
savestate snapshot

# Include credentials (channel auth tokens)
savestate snapshot --include-credentials

# Backup specific agent only
savestate snapshot --agent-id main
```

Community adapters welcome! See [Contributing](#contributing).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  SaveState CLI                    │
│    init · snapshot · restore · list · diff         │
├─────────────────────────────────────────────────┤
│              Adapter Layer                        │
│   clawdbot · chatgpt · claude · openai · custom   │
├─────────────────────────────────────────────────┤
│              Core Engine                          │
│   snapshot · restore · diff · format              │
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
       ├── trace/                  # Askable Echoes trace ledger (optional)
       │   ├── index.json          # Run index + trace schema version
       │   └── runs/               # One JSONL file per run
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
savestate diff <a> <b>                Compare two snapshots
savestate config                      View/edit configuration
  --set <key=value>                  Set a config value
  --json                             Output as JSON
savestate adapters                    List available adapters
savestate schedule                    Configure auto-backups (Pro/Team)
  --every <interval>                 Backup interval (1h, 6h, 12h, 1d)
  --disable                          Disable scheduled backups
  --status                           Show schedule status
savestate migrate                     Migration wizard between platforms
  --from <platform>                  Source platform
  --to <platform>                    Target platform
  --list                             Show platform capabilities
  --dry-run                          Preview migration plan

savestate trace list                  List Askable Echoes trace runs
  --json                             Output as JSON
savestate trace show <run_id>         Show events for a trace run
  --json                             Output as JSON
savestate trace export                Export trace as JSONL (stdout)
  --run <id>                         Export only a specific run
  --format jsonl                     Export format
```

## Storage

### Local Storage (Free)

```bash
# Default — snapshots stored in ~/.savestate/
savestate config --set storage.type=local

# Custom path (e.g., Dropbox, iCloud sync folder)
savestate config --set storage.options.path=~/Dropbox/savestate
```

### Cloud Storage (Pro/Team)

Cloud storage is managed through the SaveState API with server-side subscription verification:

```bash
# Authenticate first
savestate login

# Push local snapshots to cloud
savestate cloud push              # Push latest snapshot
savestate cloud push --all        # Push all snapshots

# Pull snapshots from cloud
savestate cloud pull              # Pull latest
savestate cloud pull --id abc123  # Pull specific snapshot

# List cloud snapshots
savestate cloud list              # Shows usage stats
```

Cloud storage quotas:
- **Pro ($9/mo)**: 10 GB
- **Team ($29/mo)**: 100 GB

All data is **encrypted locally** before upload. Zero-knowledge by design.

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
├── commands/           # CLI command handlers
│   ├── init.ts
│   ├── snapshot.ts
│   ├── restore.ts
│   ├── list.ts
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
