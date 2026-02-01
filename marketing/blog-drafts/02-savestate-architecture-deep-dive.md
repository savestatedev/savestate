# SaveState Architecture Deep Dive: How We Built Time Machine for AI

*Inside the SaveState Archive Format, encryption system, and adapter architecture*

---

## Introduction

When we set out to build SaveState, we had one guiding principle: **your data should be yours, forever.**

That sounds simple, but it has profound implications for architecture. It means:

- Encryption with keys we never see
- An open archive format with no vendor lock-in
- Storage backends you control
- Platform adapters that work without our permission

This post dives deep into how SaveState works under the hood. Whether you're evaluating it for security, planning to contribute an adapter, or just curious about the engineering, this is your guide.

[IMAGE: System architecture diagram showing CLI → Adapters → Encryption → Storage flow]

---

## Architecture Overview

SaveState has four major layers:

```
┌─────────────────────────────────────────────────┐
│                  SaveState CLI                  │
│    init · snapshot · restore · list · diff      │
├─────────────────────────────────────────────────┤
│              Adapter Layer                      │
│   chatgpt · claude · gemini · openai · custom   │
├─────────────────────────────────────────────────┤
│              Encryption Layer                   │
│   AES-256-GCM · scrypt KDF · integrity check    │
├─────────────────────────────────────────────────┤
│              Storage Backends                   │
│   local · s3 · r2 · cloud API                   │
└─────────────────────────────────────────────────┘
```

Each layer has a single responsibility:

1. **CLI Layer**: User interface, command parsing, orchestration
2. **Adapter Layer**: Platform-specific data extraction and restoration
3. **Encryption Layer**: Cryptographic operations, key derivation
4. **Storage Layer**: Persisting encrypted snapshots

Let's examine each in detail.

---

## The SaveState Archive Format (SAF)

At the heart of SaveState is the SAF — an open specification for AI state archives.

### Design Goals

When designing SAF, we optimized for:

1. **Portability** — Must work across any AI platform
2. **Simplicity** — Standard tools should be able to unpack it (after decryption)
3. **Extensibility** — New platforms shouldn't require format changes
4. **Efficiency** — Incremental snapshots should be cheap

### File Structure

Each snapshot produces a `.saf.enc` file:

```
snapshot-2026-01-27T15-00-00Z.saf.enc
```

The `.enc` suffix indicates encryption. After decryption, you get a gzipped tarball:

```
snapshot.saf.enc (encrypted envelope)
  └── snapshot.tar.gz (gzipped tarball)
       ├── manifest.json
       ├── identity/
       │   ├── personality.md
       │   ├── config.json
       │   └── tools.json
       ├── memory/
       │   ├── core.json
       │   └── knowledge/
       ├── conversations/
       │   ├── index.json
       │   └── threads/
       └── meta/
           ├── platform.json
           ├── snapshot-chain.json
           └── restore-hints.json
```

Let's break down each section:

### manifest.json

Every SAF archive starts with a manifest:

```json
{
  "version": "1.0",
  "id": "ss-2026-01-27T15-00-00Z-a1b2c3",
  "timestamp": "2026-01-27T15:00:00.000Z",
  "platform": "chatgpt",
  "adapter": "chatgpt@0.2.1",
  "checksum": "sha256:abc123...",
  "incremental": false,
  "parent": null
}
```

The manifest provides metadata for the snapshot and enables integrity verification. The `checksum` covers the entire unpacked archive, allowing tamper detection even if the encryption layer is somehow bypassed.

### identity/

The `identity` directory captures who your AI is:

**personality.md** — System prompts, custom instructions, SOUL files

```markdown
# Custom Instructions

## What would you like ChatGPT to know about you?
I'm a software developer working primarily in TypeScript...

## How would you like ChatGPT to respond?
Be concise and technical. Skip the preamble...
```

**config.json** — Settings and preferences

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "plugins": ["code-interpreter", "browsing"],
  "memory_enabled": true
}
```

**tools.json** — Tool and plugin configurations

```json
{
  "tools": [
    {
      "id": "code-interpreter",
      "enabled": true,
      "settings": {}
    }
  ]
}
```

### memory/

The `memory` directory captures what your AI knows:

**core.json** — Platform memory entries

```json
{
  "entries": [
    {
      "id": "mem_001",
      "content": "User prefers TypeScript over JavaScript",
      "created": "2026-01-15T10:30:00Z",
      "source": "conversation:abc123"
    },
    {
      "id": "mem_002", 
      "content": "User is building a backup tool for AI agents",
      "created": "2026-01-20T14:15:00Z",
      "source": "explicit"
    }
  ]
}
```

**knowledge/** — Uploaded documents, RAG sources

Larger files (PDFs, datasets, knowledge bases) are stored in the `knowledge/` subdirectory with their metadata preserved.

### conversations/

The `conversations` directory preserves your interaction history:

**index.json** — Conversation index

```json
{
  "conversations": [
    {
      "id": "conv_abc123",
      "title": "SaveState architecture discussion",
      "created": "2026-01-25T09:00:00Z",
      "updated": "2026-01-25T11:30:00Z",
      "messages": 47,
      "file": "threads/conv_abc123.json"
    }
  ],
  "total": 156,
  "included": 156
}
```

**threads/** — Individual conversations

Each conversation is stored as a separate JSON file, making incremental backups efficient (unchanged conversations don't need re-archiving).

### meta/

The `meta` directory contains operational information:

**platform.json** — Source platform details

```json
{
  "platform": "chatgpt",
  "variant": "plus",
  "api_version": "2026-01",
  "extracted_at": "2026-01-27T15:00:00Z",
  "user_id": "user_xxxxx"
}
```

**snapshot-chain.json** — Incremental snapshot links

```json
{
  "type": "incremental",
  "parent": "ss-2026-01-20T15-00-00Z-d4e5f6",
  "delta": {
    "added": ["conversations/threads/conv_xyz789.json"],
    "modified": ["memory/core.json"],
    "removed": []
  }
}
```

**restore-hints.json** — Platform-specific restore instructions

```json
{
  "platform": "chatgpt",
  "instructions": [
    "Custom instructions must be manually pasted into Settings",
    "Memories can be bulk-imported via the API (requires Plus)",
    "Conversations are read-only (historical archive)"
  ],
  "api_available": true,
  "manual_steps_required": true
}
```

[IMAGE: Expanded view of SAF file structure with annotations explaining each section]

---

## Encryption: Zero-Knowledge by Design

SaveState's encryption ensures that your data is protected even if our servers (or any storage backend) are compromised.

### Key Derivation

We use scrypt for key derivation — a memory-hard function that resists GPU-based brute forcing:

```
User passphrase
    → scrypt (N=2^17, r=8, p=1, dkLen=32)
    → 256-bit AES key
```

Parameters explained:
- **N=131072 (2^17)** — CPU/memory cost parameter (high = harder to brute force)
- **r=8** — Block size parameter
- **p=1** — Parallelization parameter
- **dkLen=32** — Output key length (256 bits)

These parameters are intentionally aggressive. Key derivation takes ~100ms on modern hardware, which is imperceptible to legitimate users but devastating to attackers trying billions of guesses.

### Encryption

Once we have the key, we use AES-256-GCM:

```
Plaintext (tarball)
    → AES-256-GCM encrypt with:
        - 256-bit key (from scrypt)
        - 96-bit random IV (nonce)
    → Ciphertext + 128-bit auth tag
```

GCM (Galois/Counter Mode) provides both confidentiality and integrity:
- **Confidentiality**: Data is unreadable without the key
- **Integrity**: Any tampering is detected (auth tag verification fails)

### File Format

The encrypted file structure:

```
┌──────────────────────────────────────────────────┐
│  Salt (32 bytes)                                 │
├──────────────────────────────────────────────────┤
│  IV/Nonce (12 bytes)                            │
├──────────────────────────────────────────────────┤
│  Ciphertext (variable length)                   │
├──────────────────────────────────────────────────┤
│  Auth Tag (16 bytes)                            │
└──────────────────────────────────────────────────┘
```

The salt is regenerated for each encryption, ensuring the same passphrase produces different keys for different files.

### Implementation

Here's a simplified version of our encryption code:

```typescript
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;

export function encrypt(plaintext: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(passphrase, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, ciphertext, authTag]);
}

export function decrypt(encrypted: Buffer, passphrase: string): Buffer {
  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encrypted.subarray(-16);
  const ciphertext = encrypted.subarray(SALT_LENGTH + IV_LENGTH, -16);
  
  const key = scryptSync(passphrase, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
}
```

### What This Means for You

- **We never see your passphrase** — It's never transmitted anywhere
- **We can't read your backups** — Even if you use our cloud storage
- **Lost passphrase = lost data** — There's no recovery mechanism (this is a feature, not a bug)
- **Each file is independently encrypted** — Compromising one doesn't help with others

[IMAGE: Encryption flow diagram showing passphrase → scrypt → AES-256-GCM → encrypted file]

---

## The Adapter System

Adapters are SaveState's bridge to the AI platform ecosystem. Each adapter knows how to extract and restore state for a specific platform.

### The Interface

Every adapter implements this TypeScript interface:

```typescript
interface Adapter {
  // Identification
  readonly id: string;        // e.g., 'chatgpt'
  readonly name: string;      // e.g., 'ChatGPT'
  readonly platform: string;  // Platform family
  readonly version: string;   // Adapter version

  // Core operations
  detect(): Promise<boolean>;
  extract(): Promise<Snapshot>;
  restore(snapshot: Snapshot, options?: RestoreOptions): Promise<void>;
  identify(): Promise<PlatformMeta>;

  // Capabilities (optional)
  capabilities?: {
    extract: boolean;
    restore: boolean;
    partialRestore: boolean;
    incrementalExtract: boolean;
  };
}
```

### Detection

The `detect()` method determines if an adapter should be used:

```typescript
// Clawdbot adapter
async detect(): Promise<boolean> {
  // Look for SOUL.md in current directory or parent
  const soulPath = this.findSoulFile();
  return soulPath !== null;
}

// OpenAI Assistants adapter
async detect(): Promise<boolean> {
  // Check for OPENAI_API_KEY environment variable
  return !!process.env.OPENAI_API_KEY;
}
```

When you run `savestate snapshot` without specifying an adapter, SaveState runs each adapter's `detect()` method and uses the first match.

### Extraction

The `extract()` method pulls current state into the SAF structure:

```typescript
async extract(): Promise<Snapshot> {
  const identity = await this.extractIdentity();
  const memory = await this.extractMemory();
  const conversations = await this.extractConversations();
  
  return {
    manifest: {
      id: generateId(),
      timestamp: new Date().toISOString(),
      platform: this.platform,
      adapter: `${this.id}@${this.version}`,
    },
    identity,
    memory,
    conversations,
    meta: await this.identify(),
  };
}
```

Each platform requires different extraction strategies:

| Platform | Strategy |
|----------|----------|
| **Clawdbot** | Read SOUL.md, memory/ directory, conversations directly from filesystem |
| **OpenAI Assistants** | API calls to list assistants, threads, files, vector stores |
| **ChatGPT** | Parse data export JSON (conversations.json, memories, user_system_instructions) |
| **Claude Web** | Parse exported data + scrape Projects via authenticated session |
| **Gemini** | Google Takeout data + Gems API where available |

### Restoration

The `restore()` method pushes a snapshot back to a platform:

```typescript
async restore(snapshot: Snapshot, options?: RestoreOptions): Promise<void> {
  // Validate snapshot is compatible with this platform
  this.validateSnapshot(snapshot);
  
  if (options?.include?.includes('identity') ?? true) {
    await this.restoreIdentity(snapshot.identity);
  }
  
  if (options?.include?.includes('memory') ?? true) {
    await this.restoreMemory(snapshot.memory);
  }
  
  // Some platforms don't support conversation restore
  if (this.capabilities.restore && (options?.include?.includes('conversations') ?? true)) {
    await this.restoreConversations(snapshot.conversations);
  }
}
```

Restore capabilities vary dramatically by platform:

| Platform | Identity | Memory | Conversations |
|----------|----------|--------|---------------|
| **Clawdbot** | ✅ Full | ✅ Full | ✅ Full |
| **OpenAI Assistants** | ✅ Full | ✅ Full | ✅ Full |
| **ChatGPT** | ⚠️ Manual paste | ⚠️ API (Plus only) | ❌ Read-only |
| **Claude Web** | ⚠️ Projects | ⚠️ Limited | ❌ Read-only |

### Building Your Own Adapter

Creating an adapter for a new platform is straightforward:

```typescript
import type { Adapter, Snapshot, PlatformMeta } from 'savestate';

export class MyPlatformAdapter implements Adapter {
  readonly id = 'my-platform';
  readonly name = 'My AI Platform';
  readonly platform = 'my-platform';
  readonly version = '0.1.0';
  
  capabilities = {
    extract: true,
    restore: true,
    partialRestore: true,
    incrementalExtract: false,
  };

  async detect(): Promise<boolean> {
    // Return true if we're in the right context
    return existsSync('.my-platform-config');
  }

  async extract(): Promise<Snapshot> {
    const config = JSON.parse(readFileSync('.my-platform-config', 'utf-8'));
    
    return {
      manifest: {
        id: `ss-${Date.now()}`,
        timestamp: new Date().toISOString(),
        platform: this.platform,
        adapter: `${this.id}@${this.version}`,
      },
      identity: {
        personality: config.systemPrompt,
        config: config.settings,
        tools: config.tools || [],
      },
      memory: {
        core: config.memories || [],
        knowledge: [],
      },
      conversations: {
        index: [],
        threads: [],
      },
      meta: await this.identify(),
    };
  }

  async restore(snapshot: Snapshot): Promise<void> {
    const config = {
      systemPrompt: snapshot.identity.personality,
      settings: snapshot.identity.config,
      tools: snapshot.identity.tools,
      memories: snapshot.memory.core,
    };
    
    writeFileSync('.my-platform-config', JSON.stringify(config, null, 2));
  }

  async identify(): Promise<PlatformMeta> {
    return {
      platform: this.platform,
      variant: 'standard',
      extractedAt: new Date().toISOString(),
    };
  }
}
```

Publish as `@savestate/adapter-my-platform` on npm and SaveState will auto-discover it.

[IMAGE: Adapter registry diagram showing multiple adapters plugging into the same core]

---

## Storage Backends

SaveState separates "what to store" from "where to store it" through pluggable storage backends.

### The Interface

```typescript
interface StorageBackend {
  readonly id: string;
  
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  list(): Promise<StorageEntry[]>;
  delete(key: string): Promise<void>;
  
  // Optional
  exists?(key: string): Promise<boolean>;
  getMetadata?(key: string): Promise<StorageMetadata>;
}

interface StorageEntry {
  key: string;
  size: number;
  lastModified: Date;
}
```

### Available Backends

**Local Filesystem** (default)

```typescript
class LocalStorageBackend implements StorageBackend {
  constructor(private basePath: string) {}
  
  async put(key: string, data: Buffer): Promise<void> {
    const filePath = join(this.basePath, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }
  
  async get(key: string): Promise<Buffer> {
    return readFile(join(this.basePath, key));
  }
  
  // ... list, delete
}
```

**S3-Compatible** (R2, B2, Minio, etc.)

Our S3 backend uses AWS Signature V4 with zero external dependencies:

```typescript
class S3StorageBackend implements StorageBackend {
  constructor(
    private bucket: string,
    private credentials: S3Credentials,
    private endpoint?: string  // For R2/B2/etc
  ) {}
  
  async put(key: string, data: Buffer): Promise<void> {
    const request = this.signRequest('PUT', key, data);
    await fetch(request.url, request);
  }
  
  // ... AWS Sig V4 implementation
}
```

**SaveState Cloud API** (Pro/Team)

For subscribers, we proxy to our managed R2 bucket through an authenticated API:

```typescript
class CloudStorageBackend implements StorageBackend {
  constructor(private apiKey: string) {}
  
  async put(key: string, data: Buffer): Promise<void> {
    await fetch(`https://savestate.dev/api/storage/${key}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: data,
    });
  }
}
```

The API validates your subscription before accepting uploads.

---

## Incremental Snapshots

Like git, SaveState only stores what changed between snapshots.

### How It Works

1. **Hash everything** — Each file in the snapshot gets a SHA-256 hash
2. **Compare to parent** — Check which hashes differ from the previous snapshot
3. **Store deltas only** — Unchanged files reference the parent snapshot

```json
// snapshot-chain.json
{
  "type": "incremental",
  "parent": "ss-2026-01-20T15-00-00Z-abc123",
  "delta": {
    "added": [
      "conversations/threads/conv_new.json"
    ],
    "modified": [
      "memory/core.json",
      "manifest.json"
    ],
    "removed": [],
    "unchanged": [
      "identity/personality.md",
      "identity/config.json",
      "conversations/threads/conv_001.json",
      // ... hundreds more
    ]
  },
  "size": {
    "actual": 12847,
    "fullEquivalent": 4523891
  }
}
```

### Reconstruction

When restoring an incremental snapshot, SaveState reconstructs the full state:

```typescript
async function reconstructSnapshot(snapshotId: string): Promise<Snapshot> {
  const chain = await buildSnapshotChain(snapshotId);
  
  // Start with oldest (full) snapshot
  let snapshot = await loadSnapshot(chain[0]);
  
  // Apply each incremental delta
  for (const delta of chain.slice(1)) {
    snapshot = applyDelta(snapshot, delta);
  }
  
  return snapshot;
}
```

### Space Savings

Real-world savings are significant:

| Snapshot | Type | Size | Full Equivalent | Savings |
|----------|------|------|-----------------|---------|
| Day 1 | Full | 2.1 MB | 2.1 MB | 0% |
| Day 2 | Incremental | 47 KB | 2.2 MB | 98% |
| Day 3 | Incremental | 12 KB | 2.2 MB | 99% |
| Day 7 | Incremental | 89 KB | 2.4 MB | 96% |

Most changes are new conversations or memory updates. Identity, tools, and knowledge rarely change.

[IMAGE: Visual showing snapshot chain with delta sizes shrinking over time]

---

## What's Next

SaveState's architecture is designed for extensibility. Here's what we're working on:

- **Encrypted search index** — Search across snapshots without decrypting everything
- **Hardware key support** — YubiKey, Touch ID via Secure Enclave
- **Shamir's Secret Sharing** — Split your passphrase across trusted parties
- **Streaming encryption** — Handle arbitrarily large snapshots
- **Adapter SDK** — Simplified adapter development with testing utilities

---

## Conclusion

SaveState's architecture reflects our core belief: your data should be yours.

- **Open format** — SAF is documented, standard tools work with it
- **Strong encryption** — AES-256-GCM with scrypt, keys you control
- **Pluggable adapters** — Any platform can be supported
- **Flexible storage** — Store anywhere, we never see your data

We've tried to make the right choices for security and portability, even when they made implementation harder. Because when it comes to your AI identity, there's no room for shortcuts.

Questions? Comments? Find us on [GitHub](https://github.com/savestatedev/savestate) or [Twitter](https://x.com/SaveStateDev).

---

*Ready to protect your AI identity?*

```bash
npm install -g @savestate/cli
savestate init
savestate snapshot
```

[savestate.dev](https://savestate.dev)
