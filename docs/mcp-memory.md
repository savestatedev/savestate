# MCP Memory Integration

Issue #176: OpenMemory-compatible MCP tools for cross-platform memory sharing.

## Overview

SaveState's MCP server exposes memory tools that are compatible with the [OpenMemory MCP](https://docs.mem0.ai/openmemory/overview) specification. This enables seamless memory sharing between SaveState and other MCP-compatible tools like Claude Desktop, Cursor, and Windsurf.

## Quick Start

### 1. Configure MCP Client

Add SaveState to your MCP client configuration:

**Claude Desktop** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "savestate": {
      "command": "npx",
      "args": ["@savestate/cli", "mcp", "serve"]
    }
  }
}
```

**Cursor** (settings):
```json
{
  "mcp": {
    "servers": {
      "savestate": {
        "command": "npx",
        "args": ["@savestate/cli", "mcp", "serve"]
      }
    }
  }
}
```

### 2. Start Using Memory Tools

Once configured, your AI assistant can use these tools:

- `add_memories` - Store new memories
- `search_memory` - Search stored memories
- `list_memories` - View all memories
- `delete_memory` - Remove a specific memory
- `delete_all_memories` - Clear all memories

## Available Tools

### add_memories

Store one or more memory entries.

**Input:**
```json
{
  "memories": [
    {
      "content": "User prefers TypeScript over JavaScript",
      "type": "preference",
      "tags": ["coding", "language"],
      "importance": 0.8
    }
  ]
}
```

Or for a single memory:
```json
{
  "content": "The project uses PostgreSQL for the database"
}
```

**Memory Types:**
- `fact` - General knowledge (default)
- `event` - Something that happened
- `preference` - User preferences
- `conversation` - Conversation context

### search_memory

Search memories by query text and filters.

**Input:**
```json
{
  "query": "database preferences",
  "type": "preference",
  "tags": ["coding"],
  "limit": 10
}
```

### list_memories

List all stored memories with optional filtering.

**Input:**
```json
{
  "type": "fact",
  "limit": 50,
  "offset": 0
}
```

### delete_memory

Delete a specific memory by ID.

**Input:**
```json
{
  "id": "abc123-def456"
}
```

### delete_all_memories

Clear all stored memories. Requires explicit confirmation.

**Input:**
```json
{
  "confirm": true
}
```

## Storage

Memories are stored in a local SQLite database at `~/.savestate/memory.db`. This provides:

- **Persistence** - Memories survive across sessions
- **Performance** - Fast queries on indexed fields
- **Privacy** - All data stays on your machine

### Optional Encryption

Set the `SAVESTATE_MCP_PASSPHRASE` environment variable to encrypt memories at rest:

```bash
export SAVESTATE_MCP_PASSPHRASE="your-secure-passphrase"
npx @savestate/cli mcp serve
```

## SaveState-Native Tools

In addition to OpenMemory-compatible tools, SaveState provides its own namespaced tools:

- `savestate_memory_store` - Store a memory
- `savestate_memory_search` - Search memories
- `savestate_memory_delete` - Delete a memory

These work identically to the OpenMemory tools but follow SaveState's naming convention.

## Resources

The MCP server also exposes resources for programmatic access:

- `savestate://memories` - JSON list of all memories
- `savestate://snapshots` - JSON list of all snapshots

## Cross-Platform Memory

Memories stored via SaveState MCP are accessible from any MCP-compatible client. This enables:

1. **Context Continuity** - Start work in Cursor, continue in Claude Desktop
2. **Shared Preferences** - Set coding style once, use everywhere
3. **Project Memory** - Project context travels with you

## Example Workflow

1. Working in Cursor, tell your assistant: "Remember that this project uses ESM modules"
2. Assistant calls `add_memories` with `{ "content": "Project uses ESM modules", "type": "fact" }`
3. Later in Claude Desktop, ask: "What module system does this project use?"
4. Assistant calls `search_memory` with `{ "query": "module system" }`
5. Assistant retrieves and uses the stored fact

## Comparison with OpenMemory

| Feature | SaveState | OpenMemory (Mem0) |
|---------|-----------|-------------------|
| Storage | Local SQLite | Cloud or Self-hosted |
| Encryption | Optional (Argon2id + AES-256-GCM) | Cloud-managed |
| API Compatibility | OpenMemory MCP spec | Native |
| Snapshots | Yes (full state backup) | No |
| Migration | Yes (cross-platform) | No |

SaveState provides OpenMemory-compatible APIs while adding unique features like encrypted snapshots and cross-platform migration.
