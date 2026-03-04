# Compatibility Guide

This guide details exactly what migrates between platforms, what requires adaptation, and what doesn't transfer.

## Platform Comparison

### Feature Support Matrix

| Feature | ChatGPT | Claude | Notes |
|---------|---------|--------|-------|
| Custom Instructions | ✓ 1,500 chars | ✓ 8,000 chars | Claude has larger limit |
| Explicit Memories | ✓ ~100 entries | ✗ | Claude uses project knowledge |
| Projects/Workspaces | ✗ | ✓ | Claude has project organization |
| Custom Bots | ✓ Custom GPTs | ✗ | Claude Projects serve this role |
| File Uploads | ✓ 512 MB max | ✓ 32 MB max | Different size limits |
| Code Execution | ✓ Code Interpreter | ✓ Artifacts | Different approaches |
| Image Generation | ✓ DALL-E | ✗ | Claude cannot generate images |
| Web Browsing | ✓ | ✓ | Both support with limitations |
| Conversation Export | ✓ | ✓ | Both can export history |

### Character Limits

| Content Type | ChatGPT Limit | Claude Limit |
|-------------|---------------|--------------|
| System Instructions | 1,500 characters | 8,000 characters |
| Memory entries | ~100 entries | N/A (uses files) |
| Single message | ~32,000 tokens | ~200,000 tokens |
| File upload | 512 MB | 32 MB per file |

## What Migrates Perfectly ✓

These items transfer without modification:

### Basic Instructions (Under Limits)

If your instructions fit within both platforms' limits, they transfer directly.

**Example:**
```
ChatGPT instruction (800 chars):
"I'm a software developer. I prefer TypeScript and concise answers with code examples."

→ Claude system prompt: Same text, no modification needed.
```

### Simple Files

Documents under 32 MB transfer directly:
- PDFs
- Text files
- Code files
- Markdown
- Small images

### Preference Keywords

Universal preferences work everywhere:
- "Be concise"
- "Use formal language"
- "Prefer code examples"
- "Explain step by step"

## What Requires Adaptation ⚠️

These items transfer but need reformatting:

### Memories → Project Knowledge (ChatGPT to Claude)

**ChatGPT memories:**
```
- User's name is Alex
- User prefers TypeScript
- User works at a startup
- User is in EST timezone
```

**Claude project knowledge file:**
```markdown
# User Context

## Personal Information
- Name: Alex
- Timezone: EST
- Works at: Startup

## Technical Preferences
- Primary language: TypeScript
```

### Project Knowledge → Memories (Claude to ChatGPT)

Inverse conversion — structured documents become discrete memory entries.

### Long Instructions (Claude → ChatGPT)

Claude's larger limit means content may need condensing:

**Original (6,000 chars):**
```
You are an expert software architect with 20 years of experience.

When reviewing code, you should:
1. First assess the overall architecture
2. Then examine individual components
3. Consider scalability implications
4. Review error handling patterns
5. Check for security vulnerabilities
6. Evaluate test coverage
[... continues ...]
```

**Condensed (1,400 chars):**
```
Expert software architect. Code review approach: architecture first, 
then components, scalability, error handling, security, and tests.
[Key points preserved, verbosity reduced]
```

### Custom GPTs → Claude Projects

| GPT Component | Claude Adaptation |
|--------------|-------------------|
| Instructions | System prompt (may expand with Claude's limit) |
| Knowledge files | Project knowledge files |
| Actions/plugins | Manual MCP setup required |
| Conversation starters | Included in project description |

### Claude Projects → Custom GPTs

| Claude Component | GPT Adaptation |
|-----------------|----------------|
| System prompt | Instructions (may need condensing) |
| Knowledge files | GPT knowledge base |
| Artifacts | Save separately, reference in instructions |

### Formatting Conventions

**ChatGPT prefers:**
- Markdown formatting
- Natural language instructions
- Inline examples

**Claude prefers:**
- XML tags for structure
- Explicit sections
- Separated concerns

**Example transformation (ChatGPT → Claude):**

ChatGPT:
```
When I ask for code, always:
- Use TypeScript
- Include error handling
- Add comments
```

Claude:
```xml
<coding_preferences>
  <language>TypeScript</language>
  <requirements>
    - Include error handling
    - Add inline comments
  </requirements>
</coding_preferences>
```

## What Cannot Migrate ✗

### DALL-E Integration (ChatGPT)

Claude cannot generate images. 

**Alternatives:**
- Use MCP tools with external image services
- Reference this limitation in Claude system prompt
- Save generated images locally before migrating

### ChatGPT Plugins / GPT Actions

External service integrations don't transfer.

**Alternatives:**
- Set up equivalent MCP servers for Claude
- Document required integrations for manual setup

### Code Interpreter State

Files and variables in ChatGPT's Code Interpreter don't transfer.

**Alternatives:**
- Download important files before migration
- Upload to Claude Artifacts manually

### Active Conversation Context

Neither platform can import conversations as "active" chats with context.

**What happens:**
- Conversations are preserved in your SaveState snapshot
- They're searchable locally
- They don't appear as chats in the target platform

### Voice/Audio Settings

Platform-specific audio configurations don't transfer.

## File Compatibility

### Supported File Types

| Type | ChatGPT | Claude | Transfer Notes |
|------|---------|--------|----------------|
| PDF | ✓ | ✓ | Direct transfer |
| TXT/MD | ✓ | ✓ | Direct transfer |
| DOCX | ✓ | ✓ | May need re-upload |
| XLSX | ✓ | ✓ | Direct transfer |
| CSV | ✓ | ✓ | Direct transfer |
| JSON | ✓ | ✓ | Direct transfer |
| Python (.py) | ✓ | ✓ | Direct transfer |
| JavaScript/TypeScript | ✓ | ✓ | Direct transfer |
| Images (PNG, JPG) | ✓ | ✓ | Size limits apply |
| ZIP archives | ✓ | ⚠️ | May need extraction |

### Size Limits

| Scenario | Handling |
|----------|----------|
| File < 32 MB | Transfers directly to both |
| File 32-512 MB | OK for ChatGPT; needs splitting for Claude |
| File > 512 MB | Cannot transfer; needs manual handling |

## Compatibility Report

Use `--dry-run` to see exactly what will happen:

```bash
savestate migrate --from chatgpt --to claude --dry-run
```

Output:
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
  └─ ⚠ Memory Entries (47 entries) (Claude uses project knowledge)

Files
  ├─ ✓ notes.pdf (Will transfer without modification)
  ├─ ✓ preferences.md (Will transfer without modification)
  └─ ⚠ large-dataset.csv (File size exceeds Claude limit)

Features/Capabilities
  └─ ✗ DALL-E Integration (Not available in Claude)

Recommendations:
  1. Review adapted items before finalizing migration
  2. Memories will be converted to project knowledge
  3. 1 file(s) may need manual handling due to size limits
  4. Use MCP image generation tools for DALL-E replacement

Feasibility: ⚠ Moderate - Some items need adaptation
```

### Feasibility Ratings

| Rating | Meaning |
|--------|---------|
| **Easy** | > 80% transfers perfectly; minor adaptations only |
| **Moderate** | 50-80% perfect; some reformatting needed |
| **Complex** | < 50% perfect; significant adaptation required |
| **Partial** | > 30% cannot migrate; manual work needed |

## Best Practices

### Before Migration

1. **Run `--dry-run` first** — Understand what will happen
2. **Review large content** — Identify what may need condensing
3. **Export critical files** — Especially from Code Interpreter
4. **Document integrations** — List plugins/actions for manual setup

### During Migration

1. **Review transformations** — Approve condensed content
2. **Check file sizes** — Handle oversized files
3. **Note manual steps** — The wizard will list required actions

### After Migration

1. **Test thoroughly** — Start new conversations on target platform
2. **Verify preferences** — Check that your style preferences transferred
3. **Set up integrations** — Configure MCP/plugins manually
4. **Keep source account** — Until you've verified everything

## Platform-Specific Notes

### ChatGPT Quirks

- Memory management can be inconsistent
- GPTs have separate instruction limits
- Plugin configurations are complex
- Export includes all history (can be large)

### Claude Quirks

- Projects are the main organization unit
- No explicit memory API
- Artifacts are session-specific
- System prompts can be very long
- MCP requires technical setup

## See Also

- [Getting Started](./getting-started.md) — Quick start guide
- [ChatGPT → Claude Guide](./chatgpt-to-claude.md) — Detailed walkthrough
- [Claude → ChatGPT Guide](./claude-to-chatgpt.md) — Reverse migration
- [Troubleshooting](./troubleshooting.md) — Common issues and solutions
- [FAQ](./faq.md) — Frequently asked questions
