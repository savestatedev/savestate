# Multi-Tier Memory Architecture

SaveState supports a multi-tier memory architecture (L1/L2/L3) designed for long-running AI agents. This feature organizes memories by relevance and access patterns, optimizing both token usage and retrieval speed.

## Overview

| Tier | Name | Purpose | Default Behavior |
|------|------|---------|------------------|
| **L1** | Short-term buffer | Current session/window | Included in context, 50 items max, 24h retention |
| **L2** | Working set | Recent + pinned items | Included in context, 500 items max, 30d retention |
| **L3** | Long-term archive | Full history | Searchable only, unlimited, no auto-expiry |

## Key Features

- **Automatic promotion/demotion** based on age and access patterns
- **Manual tier management** for precise control
- **Pinning** to prevent important memories from being demoted
- **Backward compatible** — existing flat memories default to L3

## CLI Commands

### List Memories

```bash
# List all memories with tier info
savestate memory list

# Filter by tier
savestate memory list --tier L1

# Show only pinned memories
savestate memory list --pinned

# JSON output
savestate memory list --json
```

### Promote/Demote

```bash
# Promote a memory to L1 (fastest access)
savestate memory promote <memory-id> --to L1

# Promote to L2
savestate memory promote <memory-id> --to L2

# Demote to archive
savestate memory demote <memory-id> --to L3
```

### Pin/Unpin

Pinned memories are never automatically demoted:

```bash
# Pin a memory
savestate memory pin <memory-id>

# Unpin a memory
savestate memory unpin <memory-id>
```

### Apply Policies

Run automatic tier management based on configured policies:

```bash
# Dry run - show what would change
savestate memory apply-policies --dry-run

# Apply changes
savestate memory apply-policies
```

### View Configuration

```bash
savestate memory config
```

## Default Tier Configuration

```json
{
  "version": "1.0.0",
  "defaultTier": "L2",
  "tiers": {
    "L1": {
      "maxItems": 50,
      "maxAge": "24h",
      "includeInContext": true
    },
    "L2": {
      "maxItems": 500,
      "maxAge": "30d",
      "includeInContext": true
    },
    "L3": {
      "maxItems": null,
      "maxAge": null,
      "includeInContext": false
    }
  },
  "policies": [
    {
      "name": "auto-demote-l1",
      "trigger": "age",
      "from": "L1",
      "to": "L2",
      "threshold": "24h"
    },
    {
      "name": "auto-demote-l2",
      "trigger": "age",
      "from": "L2",
      "to": "L3",
      "threshold": "30d"
    }
  ]
}
```

## SAF Schema

The SaveState Archive Format (SAF) includes tier metadata:

### MemoryEntry Fields

| Field | Type | Description |
|-------|------|-------------|
| `tier` | `'L1' \| 'L2' \| 'L3'` | Memory tier (defaults to L3) |
| `pinned` | `boolean` | Whether memory is pinned |
| `pinnedAt` | `string` | ISO timestamp when pinned |
| `lastAccessedAt` | `string` | Last access timestamp |
| `promotedAt` | `string` | When promoted to current tier |
| `demotedAt` | `string` | When demoted to current tier |
| `previousTier` | `'L1' \| 'L2' \| 'L3'` | Previous tier before change |

### Archive Structure

```
memory/
├── core.json         # Memory entries with tier metadata
├── tier-config.json  # Tier configuration
└── knowledge/
    └── index.json    # Knowledge documents
```

## Backward Compatibility

- Existing snapshots without tier data work seamlessly
- Memories without a `tier` field default to `L3`
- No migration required — tier metadata is added on first modification
- All existing operations (snapshot, restore, migrate) preserve tier data

## Use Cases

### Long-Running Agents

For agents that run continuously:

1. Recent interactions go to L1 (immediate context)
2. Important learnings get pinned to L2 (working memory)
3. Old conversations auto-archive to L3 (searchable history)

### Migration Between Platforms

When migrating from ChatGPT to Claude:

1. Core memories → L1/L2 (preserved in context)
2. Historical conversations → L3 (archived but accessible)
3. Pinned memories remain pinned across platforms

### Token Optimization

Only L1 and L2 memories are included in default context, reducing token usage while keeping relevant information accessible.

## Programmatic API

```typescript
import {
  getEffectiveTier,
  promoteMemory,
  demoteMemory,
  pinMemory,
  getContextMemories,
  applyTierPolicies,
} from '@savestate/cli';

// Get memories for agent context (L1 + L2 only)
const contextMemories = getContextMemories(snapshot.memory.core);

// Promote a memory
const promoted = promoteMemory(entry, 'L1');

// Apply automatic policies
const { updated, changes } = applyTierPolicies(
  snapshot.memory.core,
  snapshot.memory.tierConfig
);
```
