# RFC-MLP: Memory Layer Protocol

**Status:** DRAFT
**Authors:** SaveState core team
**Last updated:** 2026-04-28
**Reference implementation:** [`@savestate/sdk`](./README.md)

> A vendor-neutral specification for portable, governed, encrypted AI
> memory. Any tool can implement it; any agent can consume it.

---

## 1. Motivation

Every modern AI tool reinvents memory. ChatGPT has its own memory store.
Claude has projects and artifacts. Cursor has its own context. LangChain,
LlamaIndex, AutoGPT, and a hundred internal frameworks each ship their
own bolted-on memory. None of it is portable. None of it is encrypted by
default. None of it gives the user the keys.

This is bad for everyone:

- **Users** lose their memory every time they switch tools and have to
  re-explain themselves.
- **Builders** waste cycles writing the 17th vector store wrapper instead
  of solving their actual problem.
- **Vendors** end up with non-interoperable lock-in surfaces that don't
  scale to enterprise.

The **Memory Layer Protocol (MLP)** is a small, opinionated specification
for what an AI memory provider looks like. If a tool implements MLP, any
agent that speaks MLP can use it. SaveState is the first reference
implementation; we expect (and want) others.

## 2. Scope

MLP defines the **interfaces** an AI memory provider exposes. It does
not mandate a specific storage backend, encryption library, transport,
or programming language. A conforming implementation MAY be:

- An npm package (like `@savestate/sdk`).
- An MCP server.
- A REST API.
- A native library (Go, Rust, Python, ...).

In scope:

- Snapshot interface (point-in-time archives).
- Search interface (cross-snapshot, scored, typed).
- Memory CRUD interface (live runtime memory).
- Governance hooks (write/read gates).
- Security model (encryption, key custody, attestations).
- Versioning and capability discovery.

Out of scope (for now):

- Wire format normalization (each transport defines its own).
- Embedding / vector retrieval semantics (left to implementations).
- UI conventions.

## 3. Conformance levels

| Level     | Required surface                                      |
| --------- | ----------------------------------------------------- |
| **MLP-0** | Snapshot create, search.                              |
| **MLP-1** | MLP-0 + restore, list, stats.                         |
| **MLP-2** | MLP-1 + live memory CRUD.                             |
| **MLP-3** | MLP-2 + governance hooks (Trust Kernel equivalent).   |

A provider MUST advertise its highest supported level.

## 4. Snapshot interface

A snapshot is an immutable, encrypted, content-addressable archive of an
AI's state at a point in time. Conforming providers expose:

```ts
interface SnapshotProvider {
  snapshot(opts: {
    adapter: AdapterId | Adapter;
    label?: string;
    tags?: string[];
    parentId?: string;
    full?: boolean;
  }): Promise<{ snapshot: SnapshotMetadata; receipt: SaveReceipt }>;

  restore(id: SnapshotId | 'latest', opts: {
    adapter: AdapterId | Adapter;
    dryRun?: boolean;
  }): Promise<RestoreResult>;

  list(filter?: ListFilter): Promise<SnapshotMetadata[]>;
  inspect(id: SnapshotId): Promise<SnapshotSummary>;
  stats(): Promise<ComputedStats>;
}
```

Required guarantees:

- Snapshots MUST be content-addressed by a deterministic, manifest-
  invariant checksum.
- Snapshots MUST be encrypted at rest with an authenticated cipher
  (AES-256-GCM REQUIRED, ChaCha20-Poly1305 PERMITTED).
- The provider MUST NOT have access to user passphrases. Key derivation
  happens client-side.
- Incremental snapshots MUST reference their parent by id. Reconstruction
  walks the chain and fails closed on missing ancestors.

## 5. Search interface

Search is the killer feature: with a portable encrypted memory layer,
you can ask "what did I tell ChatGPT about my dog last March" and get
an answer regardless of which tool stored it.

```ts
interface SearchProvider {
  search(query: string, opts?: {
    snapshots?: SnapshotId[];
    types?: ContentType[];   // 'memory' | 'conversation' | 'identity' | 'knowledge'
    limit?: number;
  }): Promise<SearchResult[]>;
}

interface SearchResult {
  snapshotId: SnapshotId;
  snapshotTimestamp: ISO8601;
  type: ContentType;
  content: string;
  context?: string;       // surrounding context, if any
  score: number;          // relevance, 0–1
  path: string;           // SAF path within the snapshot
}
```

Implementations MAY ship a per-snapshot inverted index for performance.
Implementations MUST decrypt only when search runs (no plaintext at
rest), and SHOULD cache decrypted snapshots in-process with a bounded
LRU.

## 6. Memory CRUD interface (MLP-2)

The "snapshot" model captures point-in-time state. Agents also need
**live** memory — read/write between snapshots. MLP-2 conforming
providers expose a Memory handle:

```ts
interface MemoryProvider {
  add(entry: MemoryInput): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null>;
  delete(id: string): boolean;
  search(query?: MemoryQuery): Promise<MemoryEntry[]>;
  stats(): MemoryStats;
}

type MemoryType = 'fact' | 'event' | 'preference' | 'conversation';

interface MemoryInput {
  type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  importance?: number;      // 0–1
  tags?: string[];
  expiresAt?: ISO8601;
}
```

Live memory MUST be encryptable at rest. Implementations MAY require a
key source identical to the snapshot key, or MAY accept an independent
key.

## 7. Governance hooks (MLP-3)

Memory without governance is a liability. MLP-3 conforming providers
expose **gate** interfaces inspired by SaveState's Trust Kernel:

```ts
interface WriteGate {
  evaluate(write: WriteCandidate): {
    allowed: boolean;
    blockers: string[];     // human-readable rejection reasons
    score?: number;         // optional fitness/priority signal
  };
}

interface ReadGate {
  evaluate(read: ReadCandidate): {
    allowed: boolean;
    redactions?: PIIRedactionPlan;
  };
}
```

Required behaviors:

- A `WriteGate` MAY reject a memory write before it hits storage. Gate
  rejections MUST surface as a typed exception (e.g. `TrustGateRejection`)
  carrying the blocker list.
- A `ReadGate` MAY redact or suppress reads (PII filtering, deny-list
  enforcement, residency policies). Redacted reads MUST be marked.
- Implementations SHOULD ship an audit log of gate decisions for
  compliance.

## 8. Security model

- **Encryption at rest:** required. AES-256-GCM with a scrypt or argon2
  KDF is the SaveState reference choice.
- **Key custody:** the user owns the passphrase / KEK. Providers MAY
  offer optional managed key escrow but MUST NOT make it the default.
- **Authenticated encryption:** ciphertexts MUST be tamper-evident. GCM
  auth tags or equivalent are required.
- **Integrity verification:** every snapshot exposes a content checksum
  recomputable from the decrypted archive (manifest-invariant — the
  manifest is excluded from the hash so post-decrypt mutations don't
  invalidate the checksum).
- **PII handling:** providers SHOULD ship a PII detector and a
  redaction pipeline. SaveState's `privacy` module is a reference.
- **Deletion attestations:** providers MUST be able to produce
  cryptographic attestations of deletion when a user invokes the right
  to be forgotten.

## 9. Versioning

The protocol uses semantic versioning. Conformance level + protocol
version MUST be advertised by every provider. Example handshake:

```json
{ "protocol": "mlp", "version": "0.1", "level": "MLP-2", "vendor": "savestate" }
```

Breaking changes bump the major version. Additive changes bump minor.
Patch versions are reserved for clarifications.

Implementations MUST gracefully degrade to the highest compatible
version when negotiating with peers.

## 10. Capability discovery

Providers SHOULD expose a `capabilities()` call:

```ts
interface Capabilities {
  protocol: 'mlp';
  version: string;
  level: 'MLP-0' | 'MLP-1' | 'MLP-2' | 'MLP-3';
  adapters: string[];               // e.g. ['claude-code', 'chatgpt']
  storage: { local: boolean; cloud: boolean; residency?: string[] };
  encryption: { algorithm: string; kdf: string };
  features: {
    incrementalSnapshots: boolean;
    perSnapshotSearchIndex: boolean;
    governanceGates: boolean;
    deletionAttestations: boolean;
  };
}
```

This lets an agent decide at runtime whether a given provider can
service its needs.

## 11. Open questions

- Should there be a normative wire format for cross-vendor snapshot
  exchange, or is SAF (SaveState Archive Format) sufficient?
- Vector / embedding retrieval is currently out of scope. Should MLP-4
  add it?
- How should multi-tenant providers (e.g. an enterprise SaaS) handle
  per-user key isolation? SaveState's answer: separate KEK per tenant +
  optional HSM. Worth specifying?
- MCP integration: should an MLP provider be expected to expose its
  surface as MCP tools by default? (We think yes.)

## 12. Reference implementation

`@savestate/sdk` (this package) is the working reference. It implements
**MLP-3** today:

- Snapshot create, restore, list, inspect, stats — MLP-1.
- `client.memory()` exposes live CRUD + search — MLP-2.
- Trust Kernel `WriteGate` available via `MemoryStore`'s `writeGate`
  option — MLP-3.

PRs welcome at <https://github.com/savestatedev/savestate>.

## 13. License

This RFC is released under MIT, same as the rest of the SaveState
project. Vendors implementing MLP retain ownership of their
implementations.

---

*Mark this document DRAFT until at least one non-SaveState
implementation lands.*
