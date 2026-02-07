# Claude Code MCP Integration

SaveState provides a native MCP (Model Context Protocol) server that integrates directly with Claude Code, allowing you to backup and restore your AI agent state using natural language.

## Quick Setup

Add SaveState to your Claude Code configuration:

**~/.claude/settings.json**
```json
{
  "mcpServers": {
    "savestate": {
      "command": "npx",
      "args": ["@savestate/cli", "mcp"]
    }
  }
}
```

Or if you have SaveState installed globally:
```json
{
  "mcpServers": {
    "savestate": {
      "command": "savestate",
      "args": ["mcp"]
    }
  }
}
```

## Prerequisites

1. **Initialize SaveState** in your project directory:
   ```bash
   savestate init
   ```
   This creates a `.savestate/` directory with your encryption config.

2. **Set your passphrase** (or you'll be prompted during tool calls):
   ```bash
   export SAVESTATE_PASSPHRASE="your-secure-passphrase"
   ```

## Available Tools

Once configured, Claude Code can use these tools:

### `savestate_snapshot`

Create a new encrypted snapshot of your current state.

**Example prompts:**
- "Create a backup of my current state"
- "Snapshot my project with label 'before-refactor'"
- "Back up everything before I make these changes"

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| passphrase | string | ✅ | Encryption passphrase |
| label | string | | Human-readable label |
| tags | string[] | | Tags for organization |
| adapter | string | | Force specific adapter |
| full | boolean | | Skip incremental, do full snapshot |

### `savestate_restore`

Restore state from a previous snapshot.

**Example prompts:**
- "Restore my state from the last backup"
- "Roll back to snapshot abc123"
- "Show me what would be restored (dry run)"

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| snapshotId | string | ✅ | Snapshot ID or "latest" |
| passphrase | string | ✅ | Decryption passphrase |
| adapter | string | | Force specific adapter |
| dryRun | boolean | | Preview without changes |

### `savestate_list`

List all available snapshots.

**Example prompts:**
- "Show my recent backups"
- "List all Claude Code snapshots"
- "What snapshots do I have?"

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | number | | Max results (default: 10) |
| platform | string | | Filter by platform |

### `savestate_status`

Check SaveState configuration.

**Example prompts:**
- "Is SaveState configured?"
- "What adapter would be used?"
- "Check my backup setup"

## What Gets Captured

The Claude Code adapter captures:

- **CLAUDE.md files** — Root and subdirectory instructions
- **~/.claude/CLAUDE.md** — Global instructions
- **.claude/settings.json** — Project settings
- **.claude/settings.local.json** — Local overrides
- **.claude/todos.md** — Todo lists
- **.claude/memory/** — Memory files
- **Project metadata** — package.json, pyproject.toml, etc.
- **File manifest** — Project structure snapshot

## Example Workflow

```
You: Create a backup before I refactor the auth module
Claude: [calls savestate_snapshot with label "pre-auth-refactor"]
        ✓ Snapshot created! ID: ss_abc123...

You: Actually, that refactor didn't work. Roll it back.
Claude: [calls savestate_restore with snapshotId "ss_abc123"]
        ✓ Restored from snapshot ss_abc123

You: What backups do I have from this week?
Claude: [calls savestate_list]
        Found 3 snapshots:
        • ss_abc123 "pre-auth-refactor" - Today 2:30 PM
        • ss_def456 "daily" - Yesterday 9:00 AM
        • ss_ghi789 "initial" - Monday 10:15 AM
```

## Security Notes

- **Passphrase required** — All snapshots are AES-256-GCM encrypted
- **Local storage** — By default, snapshots stay on your machine
- **Cloud optional** — Pro/Team plans can sync to encrypted cloud storage
- **No plaintext** — Passphrases are never stored; snapshots are unreadable without them

## Troubleshooting

### "SaveState not initialized"
Run `savestate init` in your project directory first.

### "No adapter detected"
Make sure you have a `CLAUDE.md` file or `.claude/` directory in your project.

### "Wrong passphrase"
The passphrase must match what was used during `savestate init`.

### MCP server not connecting
1. Check that `@savestate/cli` is installed: `npm list -g @savestate/cli`
2. Verify the path in settings.json is correct
3. Restart Claude Code after changing settings

## CLI Equivalent

Every MCP tool has a CLI equivalent:

| MCP Tool | CLI Command |
|----------|-------------|
| savestate_snapshot | `savestate snapshot` |
| savestate_restore | `savestate restore <id>` |
| savestate_list | `savestate list` |
| savestate_status | `savestate config` |
