# @savestate/sdk

> Programmatic SaveState client. Snapshot, search, restore, and migrate AI memory across platforms — the same engine the [`@savestate/cli`](https://www.npmjs.com/package/@savestate/cli) ships, exposed as a TypeScript library.

```bash
npm install @savestate/sdk @savestate/cli
```

`@savestate/cli` is a peer dependency. The SDK is intentionally lean — it
ships no runtime engine code of its own; it composes the engine that
already lives inside `@savestate/cli`.

## Quick start

```ts
import { SaveStateClient } from '@savestate/sdk';

const client = new SaveStateClient({
  passphrase: process.env.SAVESTATE_PASSPHRASE!,
  storage: { type: 'local', path: './snapshots' },
});

// Snapshot from any registered adapter (or pass a custom one)
const snap = await client.snapshot({ adapter: 'claude-code', label: 'pre-deploy' });

// Cross-snapshot search
const hits = await client.search('cocktail recommendations', { limit: 10 });

// Restore
await client.restore('latest', { adapter: 'claude-code' });

// List, inspect, stats — match the CLI surface
const list = await client.list({ adapter: 'claude-code' });
const stats = await client.stats();

// Memory layer (live SQLite-backed memory store, not snapshots)
const mem = client.memory();
await mem.add({ type: 'fact', content: 'User prefers dark mode' });
const found = await mem.search({ search: 'dark mode' });
```

## Why an SDK?

Every AI builder reinvents memory. Vector store here, JSON blob there, a
half-broken redis cache somewhere else. None of it is portable, none of it
is encrypted by default, and the user never owns the keys.

SaveState is the **portable, governed, encrypted memory layer** that any
AI tool can plug into. The CLI is one front-end. The SDK is for everyone
else: agent frameworks, IDE plugins, custom orchestration layers, internal
tools that want a real memory substrate without writing one.

What you get out of the box:

- **AES-256-GCM encrypted snapshots** with the user holding the key.
- **Cross-platform memory** — one archive format (SAF) across ChatGPT,
  Claude, Claude Code, Gemini, OpenAI Assistants, and Clawdbot. Add your
  own adapter in 50 lines.
- **Cross-snapshot search** — decrypt-on-the-fly, scored, with an
  in-process LRU so repeated queries are fast.
- **Live memory store** — SQLite-backed, optionally encrypted, suitable
  for runtime agent memory between snapshots.
- **Trust Kernel hooks** — gate writes through policy before they hit the
  store (SDK exposes the same `WriteGate` the CLI uses).

This is the foundation for the **Memory Layer Protocol** (see
[`RFC-MLP.md`](./RFC-MLP.md)) — a vendor-neutral spec we want every AI
tool to implement.

## Public API

### `new SaveStateClient(options)`

| Option            | Type                                       | Notes                                              |
| ----------------- | ------------------------------------------ | -------------------------------------------------- |
| `passphrase`      | `string`                                   | Falls back to `process.env.SAVESTATE_PASSPHRASE`.  |
| `storage`         | `StorageConfig` or `{type, path}`          | Local filesystem by default.                       |
| `storageBackend`  | `StorageBackend`                           | Override the resolved backend (tests / custom).    |
| `memoryDbPath`    | `string`                                   | SQLite path for `client.memory()`.                 |

### Methods

```ts
client.snapshot({ adapter, label?, tags?, parentId?, full? }): Promise<CreateSnapshotResult>
client.restore(id, { adapter, include?, dryRun? }):           Promise<RestoreResult>
client.search(query, { snapshots?, types?, limit? }):         Promise<SearchResult[]>
client.list({ since?, until?, adapter?, tag? }):              Promise<SnapshotIndexEntry[]>
client.stats():                                               Promise<ComputedStats>
client.memory():                                              MemoryHandle
```

The `adapter` argument accepts either a registered adapter id
(`'claude-code'`, `'chatgpt'`, `'gemini'`, ...) or any object that
implements the `Adapter` interface re-exported from this package.

## Integrations

The SDK is framework-agnostic. The snippets below show how a builder
might wire it into common AI stacks. **These are illustrative — we do
not ship integration packages this iteration.**

### LangChain memory adapter

```ts
import type { BaseMemory } from 'langchain/memory';
import { SaveStateClient } from '@savestate/sdk';

class SaveStateLangChainMemory implements BaseMemory {
  constructor(private client: SaveStateClient) {}

  memoryKeys = ['savestate'];

  async loadMemoryVariables(input: { prompt: string }) {
    const hits = await this.client.search(input.prompt, { limit: 5 });
    return { savestate: hits.map((h) => h.content).join('\n') };
  }

  async saveContext(input: { prompt: string }, output: { response: string }) {
    const mem = this.client.memory();
    await mem.add({
      type: 'conversation',
      content: `Q: ${input.prompt}\nA: ${output.response}`,
    });
  }
}
```

### LlamaIndex memory adapter

```ts
import { SaveStateClient } from '@savestate/sdk';

const client = new SaveStateClient({
  passphrase: process.env.SAVESTATE_PASSPHRASE!,
  storage: { type: 'local', path: './snapshots' },
});

// Use SaveState as the long-term memory; LlamaIndex handles retrieval.
async function getRetrievalContext(query: string): Promise<string[]> {
  const hits = await client.search(query, { types: ['memory', 'knowledge'], limit: 8 });
  return hits.map((h) => h.context ?? h.content);
}
```

### Vercel AI SDK + OpenAI tool definition

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { SaveStateClient } from '@savestate/sdk';

const client = new SaveStateClient({
  passphrase: process.env.SAVESTATE_PASSPHRASE!,
});

export const recallTool = tool({
  description: 'Search the user’s SaveState memory for prior context.',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const hits = await client.search(query, { limit: 5 });
    return hits.map((h) => ({ when: h.snapshotTimestamp, text: h.content }));
  },
});
```

### Generic "fetch memories before each prompt"

```ts
import { SaveStateClient } from '@savestate/sdk';

const client = new SaveStateClient({
  passphrase: process.env.SAVESTATE_PASSPHRASE!,
});

export async function buildSystemPrompt(userMessage: string): Promise<string> {
  const hits = await client.search(userMessage, { limit: 6 });
  if (hits.length === 0) return 'You are a helpful assistant.';
  const recall = hits.map((h, i) => `${i + 1}. ${h.content}`).join('\n');
  return `You are a helpful assistant.\nRelevant memory:\n${recall}`;
}
```

## Building locally

This package lives in the SaveState monorepo. From the repo root:

```bash
npm install
npm run build           # builds @savestate/cli into dist/
cd packages/savestate-sdk
npx tsc                 # builds @savestate/sdk into packages/savestate-sdk/dist/
```

The SDK source uses relative imports into `../../src/` so the engine and
the SDK stay in lockstep. Published artifacts are emitted into
`packages/savestate-sdk/dist/`.

## Memory Layer Protocol

This SDK is a working reference implementation of the **Memory Layer
Protocol (MLP)** — see [`RFC-MLP.md`](./RFC-MLP.md). The goal: any
vendor (OpenAI, Anthropic, Google, your homegrown framework) can
implement the same surface and be a drop-in memory provider for any
agent. Comments and PRs welcome on the RFC.

## Links

- Docs: <https://savestate.dev/docs>
- CLI: [`@savestate/cli`](https://www.npmjs.com/package/@savestate/cli)
- GitHub: <https://github.com/savestatedev/savestate>

## License

MIT — same as the parent project.
