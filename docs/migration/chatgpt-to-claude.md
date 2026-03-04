# Migrating from ChatGPT to Claude

This guide walks you through moving your AI identity from ChatGPT to Claude, including your custom instructions, memories, files, and GPTs.

## Before You Begin

### Export Your ChatGPT Data

1. Go to [ChatGPT Settings](https://chat.openai.com/) → **Settings** → **Data Controls**
2. Click **Export data**
3. Wait for the email with your download link (usually 5-30 minutes)
4. Download and unzip the export file

The export contains:
- `user_data.json` — Your memories and settings
- `conversations/` — Chat history
- Custom GPT configurations (if any)

### Have Claude Ready

Make sure you have:
- A Claude account (claude.ai)
- Claude Pro recommended for Projects feature
- Logged in to the Claude web interface

## Step-by-Step Migration

### Step 1: Start the Migration

```bash
savestate migrate --from chatgpt --to claude
```

Or use the interactive wizard:

```bash
savestate migrate
```

### Step 2: Locate Your Export

When prompted, provide the path to your ChatGPT export:

```
? Path to ChatGPT export: ~/Downloads/chatgpt-export-2024-02-10/
```

SaveState will scan the export and show what was found:

```
Found in export:
  ✓ Custom Instructions (1,247 characters)
  ✓ Memories (47 entries)
  ✓ Conversations (234 chats)
  ✓ Files (12 files, 45.2 MB)
  ✓ Custom GPTs (3 bots)
```

### Step 3: Review Compatibility Report

The wizard shows how your data will transfer:

```
╭─────────────────────────────────────────────────────────────╮
│  Migration: ChatGPT → Claude                                │
├─────────────────────────────────────────────────────────────┤
│  ✓ 5 items will transfer perfectly                          │
│  ⚠ 3 items require adaptation                               │
│  ✗ 1 items cannot be migrated                               │
╰─────────────────────────────────────────────────────────────╯

Custom Instructions
  └─ ✓ Custom Instructions (Will transfer without modification)

Memories
  └─ ⚠ Memory Entries (47 entries) (Claude uses project knowledge instead)

Features/Capabilities  
  └─ ✗ DALL-E Integration (Not available in Claude)
  └─ ⚠ Code Interpreter (Claude uses Artifacts for code execution)

Recommendations:
  1. Review adapted items before finalizing migration
  2. Your ChatGPT plugins won't transfer - see Claude MCP alternatives
  3. Memories will be converted to project knowledge - review the mapping

Feasibility: ⚠ Moderate - Some items need adaptation
```

### Step 4: Confirm and Proceed

```
Proceed with migration? (Y/n) Y

[============================] 100%

✓ Migration complete!

Summary:
  ✓ Instructions loaded
  ✓ 47 memories → project knowledge
  ✓ 12 files uploaded
  ✓ 3 GPTs → Claude Projects

Created:
  Project: "My ChatGPT Identity"
  URL: https://claude.ai/project/abc123

Manual steps required:
  1. Review the project knowledge file for accuracy
  2. Set up MCP tools to replace DALL-E functionality
```

### Step 5: Complete Manual Steps

After migration, you may need to:

1. **Review project knowledge** — Your memories were converted to a knowledge document. Open the Claude project and review the "Memories from ChatGPT" file.

2. **Set up MCP alternatives** — If you used ChatGPT plugins, see [Claude MCP integrations](https://docs.anthropic.com/claude/docs/mcp) for alternatives.

3. **Test your setup** — Start a new conversation and verify your preferences transferred correctly.

## What Transfers

### Custom Instructions → System Prompt

Your ChatGPT custom instructions become Claude's project system prompt:

| ChatGPT | Claude |
|---------|--------|
| "What would you like ChatGPT to know about you?" | Project Knowledge file |
| "How would you like ChatGPT to respond?" | Project System Prompt |

**Example transformation:**

ChatGPT:
```
I'm a software developer working mainly with TypeScript and React.
I prefer concise answers with code examples.
```

Claude (Project System Prompt):
```xml
<user_context>
The user is a software developer working mainly with TypeScript and React.
</user_context>

<response_style>
Provide concise answers with code examples.
</response_style>
```

### Memories → Project Knowledge

ChatGPT memories become a structured knowledge document:

```markdown
# User Context (from ChatGPT Memories)

## Personal Information
- Name: Alex
- Timezone: EST
- Preferred language: English

## Technical Preferences  
- Primary languages: TypeScript, Python
- Editor: VS Code
- Prefers functional programming style

## Communication Style
- Likes concise responses
- Appreciates code examples
- Prefers explanations before solutions
```

### Custom GPTs → Claude Projects

Each Custom GPT becomes a Claude Project:

| GPT Component | Claude Equivalent |
|--------------|-------------------|
| Name | Project name |
| Description | Project description |
| Instructions | System prompt |
| Knowledge files | Project knowledge |
| Conversation starters | (included in description) |

### Files

Files transfer directly to Claude Project files:
- PDFs, documents, code files ✓
- Images ✓  
- Large files may need splitting (Claude limit: 32MB per file)

### Conversations

Conversation history is **preserved in your SaveState snapshot** but **cannot be imported as active Claude chats**. They remain searchable in your local backup.

## What Doesn't Transfer

| ChatGPT Feature | Status | Alternative |
|-----------------|--------|-------------|
| DALL-E image generation | ❌ | Use MCP image tools |
| Code Interpreter files | ⚠️ | Upload to Claude Artifacts |
| Web browsing state | ⚠️ | Claude has built-in search |
| Plugin configurations | ❌ | Set up equivalent MCP servers |
| Voice settings | ❌ | Not applicable |
| GPT Actions | ❌ | Use Claude MCP tools |

## Platform Differences

### Character Limits

| Content | ChatGPT | Claude |
|---------|---------|--------|
| Instructions | 1,500 chars | 8,000 chars |
| Memory entries | 100 entries | Unlimited (as knowledge) |
| File size | 512 MB | 32 MB per file |

Your ChatGPT content will fit comfortably in Claude's larger limits. Long instructions may be reformatted for Claude's XML-style preferences.

### Memory Model

**ChatGPT**: Explicit memory entries that persist across conversations

**Claude**: Project knowledge (files) that provide context within a project

The migration converts your memories to a structured knowledge document that Claude references automatically.

## Tips for Success

1. **Start with a dry run**
   ```bash
   savestate migrate --from chatgpt --to claude --dry-run
   ```

2. **Review the compatibility report** before proceeding

3. **Test in a new conversation** after migration

4. **Keep your ChatGPT export** until you've verified everything works

5. **Use Projects** — Claude Pro's Projects feature best preserves your ChatGPT identity

## Troubleshooting

### "Export not found"

Make sure you unzipped the ChatGPT export and point to the directory:
```bash
savestate migrate --from chatgpt --to claude --export ~/Downloads/chatgpt-export/
```

### "Memories conversion failed"

If memory conversion fails, you can migrate without memories:
```bash
savestate migrate --from chatgpt --to claude --include instructions,files
```

Then manually add key memories to your Claude project knowledge.

### "File too large"

Claude has a 32MB file limit. Large files will be flagged in the compatibility report. Options:
- Split into smaller files
- Compress if possible
- Skip and upload manually

See [Troubleshooting](./troubleshooting.md) for more solutions.

## Next Steps

- [Compatibility Guide](./compatibility-guide.md) — Full details on what transfers
- [Claude → ChatGPT Guide](./claude-to-chatgpt.md) — If you ever want to go back
- [FAQ](./faq.md) — Common questions
