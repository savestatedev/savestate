# Building Custom Adapters for SaveState: A Developer's Guide

**Meta Description:** Learn how to create SaveState adapters for any AI platform. This step-by-step tutorial covers the adapter interface, data extraction, restoration, and publishing your adapter to npm for the community.

**Keywords:** SaveState adapter, custom adapter development, AI backup integration, SaveState plugin, adapter tutorial, TypeScript AI tools

---

[IMAGE: Code editor showing adapter interface with icons of various AI platforms (custom agent, local LLM, enterprise bot) surrounding it]

## Introduction

SaveState ships with adapters for ChatGPT, Claude, Gemini, and OpenAI Assistants API. But what if you're using a custom AI agent, an enterprise bot, or a platform we don't support yet?

That's where custom adapters come in.

This guide walks you through building a complete SaveState adapter from scratch. By the end, you'll have a working adapter that can:

- Detect your AI platform
- Extract conversations, memories, and configurations
- Restore snapshots back to the platform
- Integrate seamlessly with the SaveState CLI

Let's build.

---

## Prerequisites

Before we start, make sure you have:

- **Node.js 18+** (20+ recommended)
- **TypeScript** knowledge (intermediate level)
- **SaveState CLI** installed (`npm install -g savestate`)
- **Familiarity** with your target AI platform's data format

```bash
# Verify your setup
node --version  # v20.x.x or higher
savestate --version  # v0.2.x
```

---

## Understanding the Adapter Interface

Every SaveState adapter implements the `Adapter` interface:

```typescript
interface Adapter {
  // Metadata
  readonly id: string;          // Unique identifier (e.g., 'my-custom-agent')
  readonly name: string;        // Human-readable name
  readonly platform: string;    // Platform category
  readonly version: string;     // Adapter version

  // Detection
  detect(): Promise<boolean>;
  identify(): Promise<PlatformMeta>;

  // Core operations
  extract(): Promise<Snapshot>;
  restore(snapshot: Snapshot): Promise<void>;

  // Capabilities (optional)
  capabilities(): AdapterCapabilities;
}
```

Let's understand each method:

| Method | Purpose |
|--------|---------|
| `detect()` | Returns `true` if this adapter can handle the current workspace |
| `identify()` | Returns metadata about the platform/account being backed up |
| `extract()` | Pulls all data from the platform into a `Snapshot` object |
| `restore()` | Pushes a `Snapshot` back to the platform |
| `capabilities()` | Declares what this adapter can and cannot do |

[IMAGE: Flow diagram showing detect() → identify() → extract() → Snapshot → restore()]

---

## Project Setup

Let's create a new adapter project:

```bash
# Create project directory
mkdir savestate-adapter-myagent
cd savestate-adapter-myagent

# Initialize npm package
npm init -y

# Install dependencies
npm install typescript @types/node --save-dev
npm install savestate --save-peer  # Peer dependency

# Initialize TypeScript
npx tsc --init
```

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Update your `package.json`:

```json
{
  "name": "@savestate/adapter-myagent",
  "version": "0.1.0",
  "description": "SaveState adapter for MyAgent platform",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "keywords": [
    "savestate",
    "savestate-adapter",
    "ai-backup",
    "myagent"
  ],
  "peerDependencies": {
    "savestate": "^0.2.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

**Important:** The `savestate-adapter` keyword enables auto-discovery by the CLI.

---

## Step 1: Define the Adapter Shell

Create `src/index.ts`:

```typescript
import type {
  Adapter,
  AdapterCapabilities,
  PlatformMeta,
  Snapshot,
  SnapshotIdentity,
  SnapshotMemory,
  SnapshotConversations,
  SnapshotMeta
} from 'savestate';

export interface MyAgentConfig {
  basePath: string;
  apiKey?: string;
}

export class MyAgentAdapter implements Adapter {
  readonly id = 'myagent';
  readonly name = 'MyAgent Platform';
  readonly platform = 'myagent';
  readonly version = '0.1.0';

  constructor(private config: MyAgentConfig) {}

  async detect(): Promise<boolean> {
    // TODO: Implement detection logic
    return false;
  }

  async identify(): Promise<PlatformMeta> {
    // TODO: Implement identification
    return {
      platform: this.platform,
      version: 'unknown',
      accountId: 'local',
      workspace: this.config.basePath
    };
  }

  async extract(): Promise<Snapshot> {
    // TODO: Implement extraction
    throw new Error('Not implemented');
  }

  async restore(snapshot: Snapshot): Promise<void> {
    // TODO: Implement restoration
    throw new Error('Not implemented');
  }

  capabilities(): AdapterCapabilities {
    return {
      extract: ['identity', 'memory', 'conversations'],
      restore: ['identity', 'memory'],
      incremental: true,
      search: true
    };
  }
}

// Export factory function for CLI discovery
export function createAdapter(config: MyAgentConfig): Adapter {
  return new MyAgentAdapter(config);
}

// Default export for simple imports
export default MyAgentAdapter;
```

---

## Step 2: Implement Detection

The `detect()` method tells SaveState whether this adapter can handle the current workspace.

```typescript
import { access, readFile } from 'fs/promises';
import { join } from 'path';

async detect(): Promise<boolean> {
  try {
    // Check for MyAgent's signature file
    const configPath = join(this.config.basePath, '.myagent', 'config.json');
    await access(configPath);
    
    // Optionally verify file contents
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    return config.platform === 'myagent';
  } catch {
    return false;
  }
}
```

**Best practices for detection:**

- Check for platform-specific files or directories
- Verify file contents when possible (not just existence)
- Return `false` gracefully on any error
- Don't throw exceptions—just return `false`

For API-based platforms, you might check credentials:

```typescript
async detect(): Promise<boolean> {
  if (!this.config.apiKey) return false;
  
  try {
    // Test API connectivity
    const response = await fetch('https://api.myagent.dev/v1/me', {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

---

## Step 3: Implement Identification

The `identify()` method returns metadata about what's being backed up:

```typescript
async identify(): Promise<PlatformMeta> {
  const configPath = join(this.config.basePath, '.myagent', 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));
  
  return {
    platform: this.platform,
    version: config.version || '1.0.0',
    accountId: config.userId || 'local',
    workspace: this.config.basePath,
    extra: {
      agentName: config.agentName,
      createdAt: config.createdAt
    }
  };
}
```

The `extra` field lets you include platform-specific metadata.

---

## Step 4: Implement Extraction

This is the core of your adapter. The `extract()` method pulls all data into a `Snapshot`:

```typescript
async extract(): Promise<Snapshot> {
  // 1. Extract identity
  const identity = await this.extractIdentity();
  
  // 2. Extract memory
  const memory = await this.extractMemory();
  
  // 3. Extract conversations
  const conversations = await this.extractConversations();
  
  // 4. Build metadata
  const meta = await this.buildMeta();
  
  return {
    identity,
    memory,
    conversations,
    meta
  };
}

private async extractIdentity(): Promise<SnapshotIdentity> {
  const personalityPath = join(this.config.basePath, '.myagent', 'personality.md');
  const configPath = join(this.config.basePath, '.myagent', 'settings.json');
  const toolsPath = join(this.config.basePath, '.myagent', 'tools.json');
  
  const personality = await this.safeReadFile(personalityPath, '');
  const config = await this.safeReadJson(configPath, {});
  const tools = await this.safeReadJson(toolsPath, {});
  
  return { personality, config, tools };
}

private async extractMemory(): Promise<SnapshotMemory> {
  const memoryPath = join(this.config.basePath, '.myagent', 'memory');
  
  // Core memories
  const corePath = join(memoryPath, 'core.json');
  const core = await this.safeReadJson(corePath, { entries: [] });
  
  // Knowledge files
  const knowledgePath = join(memoryPath, 'knowledge');
  const knowledge = await this.extractKnowledgeFiles(knowledgePath);
  
  return { core, knowledge };
}

private async extractConversations(): Promise<SnapshotConversations> {
  const convoPath = join(this.config.basePath, '.myagent', 'conversations');
  const files = await readdir(convoPath);
  
  const threads: Record<string, any> = {};
  const index: ConversationIndex[] = [];
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const id = file.replace('.json', '');
    const content = await readFile(join(convoPath, file), 'utf-8');
    const conversation = JSON.parse(content);
    
    threads[id] = conversation;
    index.push({
      id,
      title: conversation.title || 'Untitled',
      preview: this.getPreview(conversation),
      messageCount: conversation.messages?.length || 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });
  }
  
  return { index, threads };
}

// Helper methods
private async safeReadFile(path: string, fallback: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return fallback;
  }
}

private async safeReadJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

private getPreview(conversation: any): string {
  const firstMessage = conversation.messages?.[0];
  if (!firstMessage) return '';
  const content = firstMessage.content || '';
  return content.slice(0, 200);
}
```

### Handling Different Data Sources

**File-based agents:**
```typescript
const data = await readFile('/path/to/data.json', 'utf-8');
```

**API-based platforms:**
```typescript
const response = await fetch('https://api.platform.com/v1/conversations', {
  headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
});
const data = await response.json();
```

**Database-backed agents:**
```typescript
import Database from 'better-sqlite3';
const db = new Database('/path/to/agent.db');
const rows = db.prepare('SELECT * FROM conversations').all();
```

[IMAGE: Diagram showing three data source types (Files, API, Database) all flowing into extract()]

---

## Step 5: Implement Restoration

The `restore()` method writes a snapshot back to the platform:

```typescript
async restore(snapshot: Snapshot): Promise<void> {
  // 1. Restore identity
  await this.restoreIdentity(snapshot.identity);
  
  // 2. Restore memory
  await this.restoreMemory(snapshot.memory);
  
  // 3. Restore conversations (if supported)
  if (this.capabilities().restore.includes('conversations')) {
    await this.restoreConversations(snapshot.conversations);
  }
}

private async restoreIdentity(identity: SnapshotIdentity): Promise<void> {
  const basePath = join(this.config.basePath, '.myagent');
  
  // Ensure directory exists
  await mkdir(basePath, { recursive: true });
  
  // Write personality
  if (identity.personality) {
    await writeFile(
      join(basePath, 'personality.md'),
      identity.personality
    );
  }
  
  // Write config
  if (identity.config) {
    await writeFile(
      join(basePath, 'settings.json'),
      JSON.stringify(identity.config, null, 2)
    );
  }
  
  // Write tools
  if (identity.tools) {
    await writeFile(
      join(basePath, 'tools.json'),
      JSON.stringify(identity.tools, null, 2)
    );
  }
}

private async restoreMemory(memory: SnapshotMemory): Promise<void> {
  const memoryPath = join(this.config.basePath, '.myagent', 'memory');
  await mkdir(memoryPath, { recursive: true });
  
  // Restore core memories
  await writeFile(
    join(memoryPath, 'core.json'),
    JSON.stringify(memory.core, null, 2)
  );
  
  // Restore knowledge files
  if (memory.knowledge) {
    const knowledgePath = join(memoryPath, 'knowledge');
    await mkdir(knowledgePath, { recursive: true });
    
    for (const [filename, content] of Object.entries(memory.knowledge)) {
      await writeFile(join(knowledgePath, filename), content);
    }
  }
}

private async restoreConversations(convos: SnapshotConversations): Promise<void> {
  const convoPath = join(this.config.basePath, '.myagent', 'conversations');
  await mkdir(convoPath, { recursive: true });
  
  for (const [id, conversation] of Object.entries(convos.threads)) {
    await writeFile(
      join(convoPath, `${id}.json`),
      JSON.stringify(conversation, null, 2)
    );
  }
  
  // Write index
  await writeFile(
    join(convoPath, 'index.json'),
    JSON.stringify(convos.index, null, 2)
  );
}
```

### Handling Partial Restore

Not all platforms support full restoration. Declare your capabilities honestly:

```typescript
capabilities(): AdapterCapabilities {
  return {
    extract: ['identity', 'memory', 'conversations'],  // Can extract all
    restore: ['identity', 'memory'],  // Can only restore identity and memory
    incremental: true,
    search: true
  };
}
```

When restore is called with unsupported categories, handle gracefully:

```typescript
async restore(snapshot: Snapshot): Promise<void> {
  const caps = this.capabilities();
  
  if (caps.restore.includes('identity')) {
    await this.restoreIdentity(snapshot.identity);
  }
  
  if (caps.restore.includes('memory')) {
    await this.restoreMemory(snapshot.memory);
  }
  
  if (caps.restore.includes('conversations')) {
    await this.restoreConversations(snapshot.conversations);
  } else {
    console.warn('⚠️ Conversation restore not supported for this platform');
  }
}
```

---

## Step 6: Add Incremental Support

For efficient backups, implement incremental snapshots:

```typescript
async extract(parentSnapshot?: Snapshot): Promise<Snapshot> {
  if (!parentSnapshot) {
    // Full extraction
    return this.fullExtract();
  }
  
  // Incremental extraction - only what changed
  return this.incrementalExtract(parentSnapshot);
}

private async incrementalExtract(parent: Snapshot): Promise<Snapshot> {
  const current = await this.fullExtract();
  
  // Compare and include only changes
  const delta: Snapshot = {
    identity: this.diffIdentity(parent.identity, current.identity),
    memory: this.diffMemory(parent.memory, current.memory),
    conversations: this.diffConversations(parent.conversations, current.conversations),
    meta: {
      ...current.meta,
      incremental: {
        parent: parent.meta.snapshotId,
        changedFiles: [],  // Track what changed
        deletedFiles: []
      }
    }
  };
  
  return delta;
}

private diffConversations(
  parent: SnapshotConversations,
  current: SnapshotConversations
): SnapshotConversations {
  const newThreads: Record<string, any> = {};
  const newIndex: ConversationIndex[] = [];
  
  for (const [id, thread] of Object.entries(current.threads)) {
    const parentThread = parent.threads[id];
    
    // Include if new or modified
    if (!parentThread || JSON.stringify(parentThread) !== JSON.stringify(thread)) {
      newThreads[id] = thread;
      const indexEntry = current.index.find(i => i.id === id);
      if (indexEntry) newIndex.push(indexEntry);
    }
  }
  
  return { index: newIndex, threads: newThreads };
}
```

---

## Step 7: Testing Your Adapter

Create a test file at `src/test.ts`:

```typescript
import { MyAgentAdapter } from './index.js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

async function setupTestFixture(basePath: string) {
  // Create test data
  await mkdir(join(basePath, '.myagent', 'memory', 'knowledge'), { recursive: true });
  await mkdir(join(basePath, '.myagent', 'conversations'), { recursive: true });
  
  await writeFile(
    join(basePath, '.myagent', 'config.json'),
    JSON.stringify({ platform: 'myagent', version: '1.0.0' })
  );
  
  await writeFile(
    join(basePath, '.myagent', 'personality.md'),
    '# My Agent\n\nYou are a helpful assistant.'
  );
  
  await writeFile(
    join(basePath, '.myagent', 'memory', 'core.json'),
    JSON.stringify({ entries: [{ text: 'User prefers dark mode' }] })
  );
}

async function test() {
  const testDir = './test-workspace';
  await setupTestFixture(testDir);
  
  const adapter = new MyAgentAdapter({ basePath: testDir });
  
  // Test detection
  console.log('Testing detect()...');
  const detected = await adapter.detect();
  console.assert(detected === true, 'Should detect platform');
  console.log('✓ detect() passed');
  
  // Test identification
  console.log('Testing identify()...');
  const meta = await adapter.identify();
  console.assert(meta.platform === 'myagent', 'Platform should be myagent');
  console.log('✓ identify() passed');
  
  // Test extraction
  console.log('Testing extract()...');
  const snapshot = await adapter.extract();
  console.assert(snapshot.identity.personality.includes('helpful assistant'), 'Should extract personality');
  console.assert(snapshot.memory.core.entries.length > 0, 'Should extract memories');
  console.log('✓ extract() passed');
  
  // Test restoration
  console.log('Testing restore()...');
  const restoreDir = './test-restore';
  const restoreAdapter = new MyAgentAdapter({ basePath: restoreDir });
  await restoreAdapter.restore(snapshot);
  console.log('✓ restore() passed');
  
  console.log('\n✅ All tests passed!');
}

test().catch(console.error);
```

Run your tests:

```bash
npm run build
node dist/test.js
```

---

## Step 8: Publishing Your Adapter

Once your adapter is working, publish it to npm:

### Prepare for Publishing

```bash
# Build
npm run build

# Test the package locally
npm link
savestate adapters  # Should show your adapter

# Update version
npm version patch  # or minor/major
```

### Publish

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

### Naming Convention

For automatic discovery, use one of these naming patterns:

- `@savestate/adapter-<name>` (official namespace)
- `savestate-adapter-<name>` (community)
- Any package with the `savestate-adapter` keyword

---

## Advanced Topics

### Handling Authentication

For API-based platforms, implement secure credential handling:

```typescript
import { createInterface } from 'readline';

async function promptForApiKey(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Enter API key: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export class ApiPlatformAdapter implements Adapter {
  private apiKey?: string;
  
  async ensureAuthenticated(): Promise<void> {
    if (!this.apiKey) {
      this.apiKey = await promptForApiKey();
    }
  }
  
  async extract(): Promise<Snapshot> {
    await this.ensureAuthenticated();
    // ... use this.apiKey for API calls
  }
}
```

### Rate Limiting

For APIs with rate limits:

```typescript
import { setTimeout } from 'timers/promises';

async function rateLimitedFetch(urls: string[], rateLimit: number): Promise<any[]> {
  const results = [];
  
  for (const url of urls) {
    results.push(await fetch(url).then(r => r.json()));
    await setTimeout(1000 / rateLimit);  // e.g., 10 req/sec → 100ms delay
  }
  
  return results;
}
```

### Progress Reporting

For large extractions, report progress:

```typescript
async extract(options?: { onProgress?: (pct: number) => void }): Promise<Snapshot> {
  const total = 4;  // identity, memory, conversations, meta
  let completed = 0;
  
  const report = () => {
    completed++;
    options?.onProgress?.(completed / total * 100);
  };
  
  const identity = await this.extractIdentity();
  report();
  
  const memory = await this.extractMemory();
  report();
  
  // ...
}
```

---

## Example: Complete Adapter

Here's a complete, production-ready adapter for reference:

[Link to GitHub Gist or example repository]

---

## Contributing Back

Built an adapter for a popular platform? Consider contributing it to the SaveState organization:

1. Fork `savestatedev/savestate`
2. Add your adapter to `packages/adapters/<name>/`
3. Add tests
4. Submit a PR

We're especially looking for adapters for:
- Microsoft Copilot
- Poe
- Character.ai
- Local LLMs (Ollama, LM Studio)

---

## Conclusion

You now have everything you need to build SaveState adapters for any AI platform. The plugin system is designed to be:

- **Simple** — Just implement the `Adapter` interface
- **Flexible** — Handle file, API, or database sources
- **Discoverable** — Publish to npm for automatic CLI integration

**Your adapter could help thousands of users protect their AI data.** We can't wait to see what you build.

---

*Questions? Join our [Discord community](https://discord.gg/savestate) or open an issue on [GitHub](https://github.com/savestatedev/savestate).*

---

**Related Posts:**
- [Architecture Deep Dive: How SaveState Works](/blog/architecture-deep-dive)
- [The Great AI Memory Crisis](/blog/great-ai-memory-crisis)
- [Why Your AI Needs a Backup](/blog/why-ai-needs-backup)

**Tags:** developer tutorial, adapters, plugins, TypeScript, open source, contribution guide
