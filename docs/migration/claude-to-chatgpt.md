# Migrating from Claude to ChatGPT

This guide walks you through moving your AI identity from Claude to ChatGPT, including your project configurations, system prompts, knowledge files, and preferences.

## Before You Begin

### What You'll Need

1. **Access to Claude** (claude.ai)
   - Your projects and conversations should be accessible
   - The migration reads directly from the Claude web interface

2. **ChatGPT Account**
   - ChatGPT Plus recommended for Custom GPTs
   - Access to Settings → Data Controls

3. **SaveState CLI** installed and initialized

## Differences from ChatGPT → Claude

Migrating _to_ ChatGPT has some unique considerations:

- **Smaller instruction limit**: ChatGPT allows 1,500 chars vs Claude's 8,000
- **Explicit memories**: ChatGPT uses discrete memory entries, not knowledge files
- **Custom GPTs**: Best way to preserve complex Claude Projects

## Step-by-Step Migration

### Step 1: Start the Migration

```bash
savestate migrate --from claude --to chatgpt
```

### Step 2: Connect to Claude

The wizard will guide you through accessing your Claude data:

```
Connecting to Claude...

? How would you like to extract your Claude data?
  ❯ Browser-based extraction (recommended)
    Manual export
    Existing snapshot
```

**Browser-based extraction** opens Claude in your browser and extracts data with your permission.

### Step 3: Select Projects to Migrate

```
Found in Claude:
  📁 Projects (4 total)
     ├─ Work Assistant
     ├─ Code Review Helper  
     ├─ Writing Coach
     └─ Research Companion

? Select projects to migrate:
  ❯ ◉ Work Assistant
    ◉ Code Review Helper
    ◯ Writing Coach (exceeds ChatGPT limits)
    ◉ Research Companion
```

### Step 4: Review Compatibility

```
╭─────────────────────────────────────────────────────────────╮
│  Migration: Claude → ChatGPT                                │
├─────────────────────────────────────────────────────────────┤
│  ✓ 3 items will transfer perfectly                          │
│  ⚠ 4 items require adaptation                               │
│  ✗ 0 items cannot be migrated                               │
╰─────────────────────────────────────────────────────────────╯

Projects
  ├─ ✓ Work Assistant (Will become Custom GPT)
  ├─ ⚠ Code Review Helper (Instructions exceed limit - will summarize)
  └─ ✓ Research Companion (Will become Custom GPT)

System Prompts
  └─ ⚠ Main system prompt (4,200 chars → needs condensing to 1,500)

Knowledge Files
  ├─ ✓ user-preferences.md (Converts to memories)
  └─ ⚠ project-context.md (Will be attached to Custom GPT)

Recommendations:
  1. Review summarized instructions for accuracy
  2. Long knowledge files will become GPT knowledge base
  3. Consider splitting large projects into multiple GPTs

Feasibility: ⚠ Moderate - Some content condensation required
```

### Step 5: Approve Transformations

For content that needs adaptation, the wizard shows the proposed changes:

```
System prompt transformation required.

Original (4,200 chars):
┌──────────────────────────────────────────────────────────────┐
│ You are a helpful assistant specializing in software        │
│ development. You should always:                              │
│ - Provide code examples in TypeScript unless specified       │
│ - Explain your reasoning before showing code                 │
│ - Use functional programming patterns when appropriate       │
│ - Consider performance implications...                       │
│ [... 3,800 more characters ...]                              │
└──────────────────────────────────────────────────────────────┘

Condensed (1,487 chars):
┌──────────────────────────────────────────────────────────────┐
│ Software development assistant. TypeScript preferred.        │
│ Explain reasoning before code. Use functional patterns.      │
│ Consider performance. Follow user's code style...            │
└──────────────────────────────────────────────────────────────┘

? Accept this transformation? (Y/n/edit)
```

### Step 6: Complete Migration

```
[============================] 100%

✓ Migration complete!

Summary:
  ✓ Custom Instructions set
  ✓ 23 memories created from knowledge files
  ✓ 3 Custom GPTs created
  ✓ 8 files uploaded to GPT knowledge

Created:
  Custom GPT: "Work Assistant"
  Custom GPT: "Code Review Helper"
  Custom GPT: "Research Companion"

Manual steps required:
  1. Review Custom GPT configurations in ChatGPT
  2. Verify memories in Settings → Personalization
  3. Test each GPT to ensure behavior matches
```

## What Transfers

### Claude Projects → Custom GPTs

Each Claude Project becomes a ChatGPT Custom GPT:

| Claude Project | ChatGPT Custom GPT |
|---------------|-------------------|
| Project name | GPT name |
| System prompt | GPT instructions |
| Knowledge files | GPT knowledge base |
| Description | GPT description |

### System Prompts → Custom Instructions

Your main Claude configuration becomes ChatGPT custom instructions:

**Claude system prompt** → Split into:
- "What would you like ChatGPT to know about you?"
- "How would you like ChatGPT to respond?"

### Knowledge Files → Memories + GPT Knowledge

| Claude Knowledge | ChatGPT Destination |
|-----------------|-------------------|
| User preferences | Memory entries |
| Context documents | GPT knowledge files |
| Reference materials | GPT knowledge files |

Small, fact-based content becomes memories. Larger documents become GPT knowledge base files.

**Example memory conversion:**

Claude knowledge file:
```markdown
# User Preferences
- Prefers TypeScript over JavaScript
- Uses VS Code as primary editor
- Timezone: EST
- Likes concise explanations
```

ChatGPT memories:
```
- User prefers TypeScript over JavaScript
- User's primary editor is VS Code
- User is in EST timezone
- User prefers concise explanations
```

### Conversations

Like ChatGPT → Claude, conversations are **preserved locally** but cannot be imported as active ChatGPT chats.

## What Doesn't Transfer

| Claude Feature | Status | Alternative |
|---------------|--------|-------------|
| Artifacts (code/docs) | ⚠️ | Save locally, upload as needed |
| MCP integrations | ❌ | Use ChatGPT plugins/actions |
| Project organization | ⚠️ | Use GPT folders |
| Large system prompts | ⚠️ | Condensed or split into GPT knowledge |

## Handling Content Limits

### Instructions Too Long

Claude allows 8,000 characters; ChatGPT allows 1,500. Options:

1. **Automatic summarization** (default)
   - SaveState condenses your instructions intelligently
   - Preserves key behaviors and preferences
   - Review and approve before applying

2. **Split into GPT + knowledge**
   ```bash
   savestate migrate --from claude --to chatgpt --strategy split
   ```
   Core instructions go to Custom Instructions; details go to GPT knowledge.

3. **Manual editing**
   - Choose "edit" when prompted
   - Condense manually in the interactive editor

### Knowledge Files Too Large

ChatGPT GPT knowledge has limits. Large files are handled by:

1. Splitting into smaller chunks
2. Extracting key facts as memories
3. Flagging for manual upload

## Tips for Success

1. **Start with `--dry-run`**
   ```bash
   savestate migrate --from claude --to chatgpt --dry-run
   ```
   Review what will be condensed or split.

2. **Prioritize content** — Focus on your most-used projects first

3. **Test extensively** — ChatGPT may behave differently with condensed instructions

4. **Use Custom GPTs** — They're the closest equivalent to Claude Projects

5. **Keep your Claude account** — Until you've verified everything works

## Troubleshooting

### "Instructions too long, cannot condense"

Some instructions are too complex to auto-condense:
```bash
savestate migrate --from claude --to chatgpt --include memories,files
```
Then manually create Custom Instructions from your Claude setup.

### "Too many memories"

ChatGPT has a ~100 memory limit. If you have more knowledge entries:
- Critical facts → Memories
- Supporting context → GPT knowledge files

### "Project not found"

Ensure you're logged into Claude and the project is accessible:
```bash
savestate migrate --from claude --to chatgpt --browser
```
This opens a browser for authentication.

See [Troubleshooting](./troubleshooting.md) for more solutions.

## Next Steps

- [Compatibility Guide](./compatibility-guide.md) — Full details on platform differences
- [ChatGPT → Claude Guide](./chatgpt-to-claude.md) — If you want to migrate back
- [FAQ](./faq.md) — Common questions
