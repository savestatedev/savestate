# Getting Started with Migration Wizard

SaveState's Migration Wizard helps you move your AI identity between platforms. Think of it as transferring your relationship with one AI to another — your preferences, memories, files, and custom configurations all come along.

## Prerequisites

Before you begin, make sure you have:

1. **SaveState CLI installed**
   ```bash
   npm install -g savestate
   # or
   curl -sSL https://savestate.dev/install.sh | bash
   ```

2. **SaveState initialized**
   ```bash
   savestate init
   ```

3. **Access to both platforms**
   - Source platform: Account with data you want to migrate
   - Target platform: Account where you want to import

4. **Data export from source** (if required)
   - ChatGPT: Download your data from Settings → Data Controls → Export
   - Claude: Export project or use the web interface

> **No API keys required!** The Migration Wizard works with data exports, not API access. Your data stays local and encrypted.

## Quick Start

The simplest migration is a single command:

```bash
savestate migrate --from chatgpt --to claude
```

The wizard will:
1. Guide you through extracting your ChatGPT data
2. Show a compatibility report
3. Transform your data for Claude
4. Help you import to Claude

### Interactive Mode

Just run `savestate migrate` without options for a fully interactive experience:

```bash
savestate migrate
```

You'll be prompted to select:
- Source platform
- Target platform  
- What content to migrate

## What Gets Migrated

| Content Type | Description |
|-------------|-------------|
| **Instructions** | Custom instructions, personality, preferences |
| **Memories** | Learned facts about you (converted to project knowledge for Claude) |
| **Files** | Uploaded documents and knowledge files |
| **Conversations** | Chat history (preserved but may not import as active chats) |
| **Custom Bots/GPTs** | Your created bots → Projects (Claude) |

## What to Expect

### Typical Migration Time

| Content | Approximate Time |
|---------|-----------------|
| Instructions only | < 1 minute |
| With memories | 1-2 minutes |
| With files (< 100MB) | 2-5 minutes |
| Full migration with GPTs | 5-10 minutes |

### The Three Phases

1. **Extract** — Pull data from source platform
   - Reads your export file or connects to the platform
   - Creates an encrypted migration bundle

2. **Transform** — Adapt for target platform
   - Reformats instructions for the new platform
   - Converts memories to project knowledge (if needed)
   - Checks file compatibility

3. **Load** — Import to target platform
   - Creates projects or workspaces
   - Uploads files
   - Applies your identity settings

### Progress Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⏸ SaveState Migration Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migration Plan:

  From: ChatGPT
  To:   Claude

What will be migrated:

  ✓ Identity (personality, instructions, system prompts)
  ✓ Memory (learned facts, preferences)
  ⚠ Files (limited support in Claude)
  ⚠ Conversations (preserved but may not import)
  ✓ Custom Bots / GPTs → Projects

Proceed with migration? (Y/n)
```

## Command Options

| Option | Description |
|--------|-------------|
| `--from <platform>` | Source platform (chatgpt, claude) |
| `--to <platform>` | Target platform (chatgpt, claude) |
| `--dry-run` | Preview without migrating |
| `--review` | Show items needing attention |
| `--resume` | Continue interrupted migration |
| `--include <types>` | Only migrate specific types (comma-separated) |
| `--force` | Skip confirmation prompts |
| `--no-color` | Disable colored output |
| `--list` | Show available platforms |

### Examples

```bash
# Preview what will happen
savestate migrate --from chatgpt --to claude --dry-run

# Migrate only instructions and memories
savestate migrate --from chatgpt --to claude --include instructions,memories

# Resume after interruption
savestate migrate --resume

# List supported platforms
savestate migrate --list
```

## Supported Platforms

| Platform | As Source | As Target | Notes |
|----------|-----------|-----------|-------|
| ChatGPT | ✓ | ✓ | Full support |
| Claude | ✓ | ✓ | Full support |
| Gemini | Coming soon | Coming soon | — |
| Copilot | Coming soon | Coming soon | — |

## Security & Privacy

Your data is **always encrypted** during migration:

- Migration bundles use AES-256 encryption
- Data stays local — nothing sent to SaveState servers
- Temporary files are securely deleted after completion
- You control when to delete the migration bundle

## Next Steps

- [ChatGPT → Claude Migration Guide](./chatgpt-to-claude.md)
- [Claude → ChatGPT Migration Guide](./claude-to-chatgpt.md)
- [Compatibility Guide](./compatibility-guide.md)
- [Troubleshooting](./troubleshooting.md)
- [FAQ](./faq.md)
