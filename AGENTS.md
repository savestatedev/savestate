# AGENTS.md — SaveState

This file is for AI coding agents working on the SaveState codebase. Read this first.

## What is SaveState?

**SaveState is Time Machine for AI.** It's an encrypted backup and restore CLI for AI agent state — capturing memories, conversations, custom instructions, and configurations so they can be restored or migrated between platforms.

Think of it like 1Password for AI identity: your data, encrypted with your keys, portable across platforms.

## Quick Links

- **Website**: [savestate.dev](https://savestate.dev)
- **npm**: `@savestate/cli` and `savestate` (alias)
- **GitHub**: [savestatedev/savestate](https://github.com/savestatedev/savestate)
- **Concept doc**: `CONCEPT.md` — full product vision, architecture, roadmap

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  SaveState CLI                  │
│    init · snapshot · restore · list · diff      │
├─────────────────────────────────────────────────┤
│              Adapter Layer                      │
│   clawdbot · chatgpt · claude · openai · gemini │
├─────────────────────────────────────────────────┤
│              Core Engine                        │
│   snapshot · restore · diff · format            │
├─────────────────────────────────────────────────┤
│              Encryption Layer                   │
│   AES-256-GCM · scrypt KDF · integrity check    │
├─────────────────────────────────────────────────┤
│              Storage Backends                   │
│   local · s3 · r2 · cloud API                   │
└─────────────────────────────────────────────────┘
```

### Core Concepts

1. **SaveState Archive Format (SAF)** — Open spec for AI state snapshots (`.saf.enc` files)
2. **Adapters** — Platform-specific extractors/restorers (ChatGPT, Claude, Gemini, etc.)
3. **Storage Backends** — Where encrypted snapshots are stored (local, S3/R2, cloud API)
4. **Encryption** — AES-256-GCM with scrypt KDF, user-controlled keys

## Project Structure

```
savestate/
├── src/
│   ├── cli.ts              # CLI entry point (commander.js)
│   ├── index.ts            # Public API exports
│   ├── types.ts            # TypeScript interfaces (Snapshot, Adapter, etc.)
│   ├── encryption.ts       # AES-256-GCM encryption/decryption
│   ├── format.ts           # SAF archive packing/unpacking
│   ├── config.ts           # Configuration management (.savestate/config.json)
│   ├── snapshot.ts         # Snapshot creation logic
│   ├── restore.ts          # Snapshot restoration logic
│   ├── incremental.ts      # Delta/incremental snapshot logic
│   ├── search.ts           # Search across snapshots
│   ├── passphrase.ts       # Secure passphrase handling
│   ├── index-file.ts       # Snapshot index management
│   ├── commands/           # CLI command handlers
│   │   ├── init.ts
│   │   ├── snapshot.ts
│   │   ├── restore.ts
│   │   ├── list.ts
│   │   ├── diff.ts
│   │   ├── config.ts
│   │   ├── adapters.ts
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   ├── cloud.ts
│   │   ├── schedule.ts
│   │   └── migrate.ts
│   ├── storage/            # Storage backend implementations
│   │   ├── interface.ts    # StorageBackend interface
│   │   ├── local.ts        # Local filesystem backend
│   │   ├── s3.ts           # S3-compatible backend (R2, B2, etc.)
│   │   └── cloud.ts        # SaveState Cloud API backend
│   └── adapters/           # Platform adapters
│       ├── interface.ts    # Adapter interface
│       ├── registry.ts     # Adapter discovery and registration
│       ├── clawdbot.ts     # Clawdbot/Moltbot adapter
│       ├── claude-code.ts  # Claude Code adapter
│       ├── openai.ts       # OpenAI Assistants API adapter
│       ├── chatgpt.ts      # ChatGPT (export-based) adapter
│       ├── claude-web.ts   # Claude consumer (claude.ai) adapter
│       └── gemini.ts       # Gemini adapter
├── api/                    # Vercel serverless functions
│   ├── webhook.ts          # Stripe webhook handler
│   ├── account.ts          # Account/API key validation
│   ├── storage.ts          # Cloud storage proxy (R2)
│   └── lib/
│       ├── db.ts           # Neon Postgres client
│       └── email.ts        # SMTP email (PurelyMail)
├── site/                   # Landing page (savestate.dev)
│   ├── index.html
│   ├── dashboard.html      # Pro/Team web dashboard
│   └── docs/               # Documentation
├── marketing/              # Marketing content
├── test/                   # Tests
├── CONCEPT.md              # Full product vision
├── README.md               # User-facing docs
└── package.json
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript interfaces — start here to understand data structures |
| `src/format.ts` | SAF archive format — how snapshots are packaged |
| `src/encryption.ts` | Encryption implementation — AES-256-GCM with scrypt |
| `src/adapters/interface.ts` | Adapter interface — how to add new platforms |
| `src/storage/interface.ts` | Storage backend interface |
| `CONCEPT.md` | Product vision, roadmap, business model |

## SaveState Archive Format (SAF)

Each snapshot is a `.saf.enc` file with this structure:

```
snapshot.saf.enc (encrypted AES-256-GCM)
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
           ├── snapshot-chain.json # Incremental snapshot links
           └── restore-hints.json  # Platform-specific restore steps
```

## Adapter Interface

To add support for a new platform, implement the `Adapter` interface:

```typescript
interface Adapter {
  readonly id: string;              // e.g., 'chatgpt', 'claude-web'
  readonly name: string;            // Human-readable name
  readonly platform: string;        // Platform identifier
  readonly version: string;         // Adapter version

  detect(): Promise<boolean>;       // Can we operate here?
  extract(): Promise<Snapshot>;     // Pull current state
  restore(snapshot: Snapshot): Promise<void>;  // Push state back
  identify(): Promise<PlatformMeta>; // Platform metadata
}
```

Adapters are registered in `src/adapters/registry.ts`. See existing adapters for examples.

## Encryption Details

```
User passphrase
    → scrypt (N=2^17, r=8, p=1) — memory-hard KDF
    → 256-bit AES key
    → AES-256-GCM authenticated encryption
    → Integrity verification via GCM auth tag
```

- Master key is **never stored** — derived from passphrase each time
- Encryption happens **before** data leaves the machine
- Salt and IV are stored with the ciphertext (prepended)
- GCM auth tag provides tamper detection

## Development

### Setup

```bash
git clone https://github.com/savestatedev/savestate.git
cd savestate
npm install
npm run build
```

### Running locally

```bash
# Run CLI directly
node dist/cli.js --help

# Or link globally
npm link
savestate --help
```

### Testing

```bash
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests (requires adapters)
```

### Building

```bash
npm run build               # TypeScript → dist/
npm run build:binaries      # Create standalone binaries (pkg)
```

## Code Style

- **TypeScript** — Strict mode, explicit types preferred
- **Async/await** — No raw promises, always async/await
- **Error handling** — Throw descriptive errors, catch at CLI level
- **Logging** — Use structured logging, stderr for logs, stdout for data
- **No dependencies** where possible — Prefer Node.js built-ins
- **Comments** — Explain "why", not "what"

### Naming Conventions

- Files: `kebab-case.ts`
- Interfaces/Types: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- CLI flags: `--kebab-case`

### Import Order

```typescript
// 1. Node built-ins
import { readFileSync } from 'fs';
import { join } from 'path';

// 2. External packages
import { Command } from 'commander';

// 3. Internal modules (relative)
import { Adapter } from './adapters/interface';
import { encrypt } from './encryption';
```

## Contributing

### Adding a New Adapter

1. Create `src/adapters/<platform>.ts`
2. Implement the `Adapter` interface
3. Register in `src/adapters/registry.ts`
4. Add tests in `test/adapters/<platform>.test.ts`
5. Update README.md platform table
6. Update CONCEPT.md if adding new capabilities

### Adding a New Storage Backend

1. Create `src/storage/<backend>.ts`
2. Implement the `StorageBackend` interface
3. Register in storage factory
4. Add configuration options to `src/config.ts`

### Adding a CLI Command

1. Create `src/commands/<command>.ts`
2. Export a `register(program: Command)` function
3. Register in `src/cli.ts`
4. Update README.md CLI reference

## Infrastructure

### Vercel (savestate.dev)

- **Main project**: `savestate` — landing page + API
- **APIs**: `/api/webhook`, `/api/account`, `/api/storage`
- **Database**: Neon serverless Postgres (auto-injected `DATABASE_URL`)

### Stripe

- **Products**: Pro ($9/mo), Team ($29/mo)
- **Webhook events**: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`
- **Account**: WithCandor (shared pending LLC)

### Cloudflare R2

- **Bucket**: `savestate-backups`
- **Used for**: Pro/Team cloud storage
- **Access**: Proxied through `/api/storage` (never direct)

### npm

- **Packages**: `@savestate/cli`, `savestate` (alias), `savestate-ai` (legacy)
- **Org**: `@savestate`

## Common Tasks

### Release a new version

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Push with tags
git push && git push --tags

# 3. CI handles the rest (npm publish, GitHub Release, Homebrew)
```

### Debug an adapter

```bash
# Run with verbose logging
DEBUG=savestate:* savestate snapshot --adapter chatgpt

# Or add console.log in adapter and run:
node dist/cli.js snapshot --adapter chatgpt
```

### Test encryption

```bash
# Encrypt/decrypt a test file
node -e "
const { encrypt, decrypt } = require('./dist/encryption');
const plaintext = Buffer.from('test');
const key = Buffer.from('0'.repeat(64), 'hex');
const encrypted = encrypt(plaintext, key);
const decrypted = decrypt(encrypted, key);
console.log(decrypted.toString());
"
```

## Questions?

- **Product/roadmap**: See `CONCEPT.md`
- **User docs**: See `README.md`
- **Technical deep dive**: See `marketing/blog-how-it-works.md`
- **Issues**: [github.com/savestatedev/savestate/issues](https://github.com/savestatedev/savestate/issues)

---

*Last updated: January 30, 2026*
*Version: 0.2.1*
