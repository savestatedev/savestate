# How SaveState Works: A Technical Deep Dive

*Under the hood of AI identity backup and migration*

---

## The Architecture

SaveState is designed around a few core principles:

1. **Your data never leaves your machine unencrypted**
2. **The archive format is open and documented**
3. **Platform adapters are pluggable and extensible**
4. **Storage backends are interchangeable**

Here's how it all fits together.

## The SaveState Archive Format (SAF)

Every snapshot produces a `.saf.enc` file. Here's what's inside:

```
snapshot.saf.enc (encrypted)
  └── snapshot.tar.gz
       ├── manifest.json           # Version, platform, timestamp, checksum
       ├── identity/
       │   ├── personality.md      # System prompt, custom instructions
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

The format is intentionally simple: a gzipped tarball with a well-defined structure. You can unpack it with standard tools (after decryption).

## Encryption

We take encryption seriously. Your AI knows sensitive things about you — SaveState ensures that data is protected.

```
User passphrase
    → scrypt (N=2^17, r=8, p=1) key derivation
    → 256-bit AES key
    → AES-256-GCM authenticated encryption
    → Integrity verification built into GCM auth tag
```

Key points:

- **Your passphrase is never stored** — it's derived fresh each time
- **Encryption happens locally** — data is encrypted before upload
- **Even we can't read your backups** — we don't have your keys
- **GCM provides integrity** — tampering is detected automatically

## Platform Adapters

SaveState uses adapters to interface with different AI platforms. Each adapter implements:

```typescript
interface Adapter {
  id: string;           // e.g., 'chatgpt', 'claude-web'
  name: string;         // Human-readable name
  
  detect(): Promise<boolean>;        // Can we operate here?
  extract(): Promise<Snapshot>;      // Pull current state
  restore(snapshot: Snapshot): void; // Push state back
}
```

### Currently Supported

| Platform | Extract | Restore | Notes |
|----------|---------|---------|-------|
| ChatGPT | ✅ | ⚠️ | Memories + instructions extract; limited restore |
| Claude Web | ✅ | ⚠️ | Projects + conversations; partial restore |
| Claude Code | ✅ | ✅ | Full CLAUDE.md + memory support |
| Gemini | ✅ | ⚠️ | Extensions + history; limited restore |
| OpenAI Assistants | ✅ | ✅ | Full API support |
| Moltbot/Clawdbot | ✅ | ✅ | Native file-based, full support |

### Building Your Own

Adapters are just TypeScript classes. Here's a minimal example:

```typescript
export class MyAdapter implements Adapter {
  readonly id = 'my-platform';
  readonly name = 'My AI Platform';
  
  async detect() {
    // Return true if this adapter should be used
    return existsSync('./my-platform-config.json');
  }
  
  async extract() {
    // Read state and return a Snapshot object
    const config = JSON.parse(readFileSync('./my-platform-config.json'));
    return {
      manifest: { id: generateId(), timestamp: new Date() },
      identity: { personality: config.systemPrompt },
      memory: { entries: config.memories },
      // ...
    };
  }
  
  async restore(snapshot) {
    // Write state back to the platform
    writeFileSync('./my-platform-config.json', JSON.stringify({
      systemPrompt: snapshot.identity.personality,
      memories: snapshot.memory.entries,
    }));
  }
}
```

We welcome community adapters! Submit a PR or publish as `@savestate/adapter-*`.

## Storage Backends

SaveState separates "what to backup" from "where to store it". Storage backends implement:

```typescript
interface StorageBackend {
  id: string;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  list(): Promise<{ key: string; size: number; lastModified: Date }[]>;
  delete(key: string): Promise<void>;
}
```

### Available Backends

- **Local filesystem** (default) — Snapshots in `.savestate/snapshots/`
- **Cloudflare R2** (Pro/Team) — Our managed cloud storage
- **Amazon S3** (coming soon)
- **Backblaze B2** (coming soon)

## Incremental Snapshots

Like git, SaveState only stores what changed between snapshots.

Each snapshot includes a `snapshot-chain.json` that references its parent. When extracting, we compute content hashes for each file. On subsequent snapshots, unchanged files reference the previous version instead of storing duplicates.

This means:

- First snapshot: Full size (typically 10KB - 5MB depending on conversation history)
- Subsequent snapshots: Only deltas (often <1KB if just memories changed)

## Migration: The Hard Part

Cross-platform migration is tricky because platforms structure data differently.

SaveState's approach:

1. **Extract to canonical format** — The SAF is platform-agnostic
2. **Transform on restore** — Adapters handle platform-specific conversion
3. **Preserve what's possible** — Some data doesn't translate; we're transparent about it

Example: ChatGPT → Claude migration

| ChatGPT | Claude | Status |
|---------|--------|--------|
| Custom instructions | System prompt in project | ✅ Migrates |
| Memories | Claude's memory (limited) | ⚠️ Partial |
| Conversations | Read-only archive | ✅ Preserved |
| GPTs | — | ❌ No equivalent |

The migration wizard (`savestate migrate`) shows exactly what will and won't transfer before you commit.

## CLI Reference

```bash
# Setup
savestate init                    # Initialize encryption + storage
savestate login                   # Authenticate for cloud features

# Core operations
savestate snapshot                # Capture current state
savestate restore [id]            # Restore from snapshot
savestate list                    # List all snapshots
savestate diff <a> <b>            # Compare two snapshots

# Pro features
savestate schedule --every 6h    # Auto-backup schedule
savestate migrate                 # Cross-platform migration wizard

# Configuration
savestate config                  # View current config
savestate adapters                # List available adapters
```

## What's Next

We're actively working on:

- **More adapters**: Copilot, Poe, Character.ai, Ollama/LM Studio
- **Team features**: Shared backups, SSO, compliance
- **Semantic search**: Find specific memories across snapshots
- **API access**: Programmatic backup/restore for automation

## Get Involved

SaveState is open source and we'd love your help:

- **Star the repo**: [github.com/savestatedev/savestate](https://github.com/savestatedev/savestate)
- **Report issues**: Found a bug? Let us know.
- **Build an adapter**: Your favorite platform not supported? PRs welcome.
- **Spread the word**: Tweet about it, tell your friends.

Your AI identity should belong to you. Let's make that the default.

---

*Questions? Comments? Find us on X [@SaveStateDev](https://x.com/SaveStateDev) or open an issue on GitHub.*
