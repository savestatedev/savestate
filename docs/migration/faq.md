# Frequently Asked Questions

## Security & Privacy

### Is my data encrypted during migration?

**Yes.** All data is encrypted using AES-256 encryption throughout the migration process:

- Export data is encrypted when read
- Migration bundles (.smb files) are encrypted at rest
- Temporary files are encrypted and securely deleted
- Your encryption key never leaves your machine

### Does my data go through SaveState servers?

**No.** The Migration Wizard runs entirely on your local machine. Your data is never uploaded to SaveState servers. The only network traffic is:

- Downloading the CLI tool (one-time)
- Connecting to source/target platforms (with your credentials)
- Optional: SaveState cloud sync (if you enable it)

### Can I audit what data is being migrated?

Yes! Use `--dry-run` to see exactly what will be extracted and transformed:

```bash
savestate migrate --from chatgpt --to claude --dry-run --verbose
```

You can also inspect the migration bundle:

```bash
savestate bundle inspect ./migration-bundle.smb
```

### How do I delete migration data after completion?

The wizard prompts you to delete the migration bundle after successful migration. You can also manually clean up:

```bash
# Remove specific migration
savestate migrate --cleanup --id <migration-id>

# Remove all old migrations
savestate migrate --cleanup --all
```

---

## Migration Basics

### Can I migrate back after moving platforms?

**Yes.** Migration is bidirectional. If you migrated from ChatGPT to Claude and want to return:

```bash
savestate migrate --from claude --to chatgpt
```

Your original ChatGPT data is also preserved in your SaveState snapshots.

### What about my conversation history?

Conversation history is **preserved but not imported**:

- Conversations are saved in your migration bundle
- They're searchable in your local SaveState snapshots
- They **don't** become active chats on the new platform
- Neither ChatGPT nor Claude can import external conversation history

### Will my AI "remember" me on the new platform?

Yes, through your transferred configuration:

- **Instructions** tell the AI how to respond to you
- **Memories/Knowledge** give context about your preferences
- **Files** provide reference material

The new AI won't have your conversation history, but it will have your identity context.

### How long does migration take?

| Content Size | Approximate Time |
|--------------|------------------|
| Instructions only | < 1 minute |
| + Memories | 1-2 minutes |
| + Files (< 50 MB) | 2-5 minutes |
| + Custom GPTs | 5-10 minutes |
| Large migration (> 500 MB) | 15-30 minutes |

Network speed and platform API limits affect timing.

### Can I migrate multiple ChatGPT accounts to one Claude account?

Not in a single run, but you can:

1. Migrate first account → Claude Project "Work"
2. Migrate second account → Claude Project "Personal"

```bash
savestate migrate --from chatgpt --to claude --project-name "Work Account"
savestate migrate --from chatgpt --to claude --project-name "Personal Account"
```

---

## Platform-Specific Questions

### Do I need API keys?

**No.** The Migration Wizard uses your normal account access:

- **ChatGPT:** Uses your data export (Settings → Export)
- **Claude:** Uses browser-based authentication

No OpenAI API key or Anthropic API key required.

### What about ChatGPT Plus vs Free?

Migration works with both, but:

| Feature | Free | Plus |
|---------|------|------|
| Custom Instructions | ✓ | ✓ |
| Memories | ✓ | ✓ |
| File uploads | Limited | ✓ |
| Custom GPTs | ✗ | ✓ |
| Larger exports | ✗ | ✓ |

### What about Claude Pro vs Free?

| Feature | Free | Pro |
|---------|------|-----|
| Projects | ✗ | ✓ |
| Larger context | Limited | ✓ |
| More storage | Limited | ✓ |

**Recommendation:** Claude Pro is recommended for full migration, especially for Custom GPT → Project conversion.

### Can I migrate my Custom GPTs?

Yes! Custom GPTs become Claude Projects:

| GPT Component | Claude Project |
|--------------|----------------|
| Name | Project name |
| Instructions | System prompt |
| Knowledge files | Project files |
| Conversation starters | In description |

**Not migrated:**
- GPT Actions (configure Claude MCP instead)
- DALL-E capability (use MCP image tools)
- Code Interpreter state (upload files manually)

### What happens to my GPT's profile picture?

Profile pictures are preserved in the migration bundle but **not automatically uploaded** to Claude Projects (which don't have profile images). The image is saved locally.

---

## Technical Questions

### What file formats are supported?

**Fully supported:**
- Documents: PDF, DOCX, TXT, MD, RTF
- Data: CSV, JSON, XML, XLSX
- Code: .py, .js, .ts, .java, .go, .rs, and more
- Images: PNG, JPG, GIF, WebP

**Limited support:**
- ZIP archives (may need extraction)
- Binary files (preserved but may not be usable)

### What are the file size limits?

| Platform | Per-File Limit |
|----------|----------------|
| ChatGPT | 512 MB |
| Claude | 32 MB |

When migrating to Claude, files over 32 MB are flagged for splitting or manual handling.

### Can I run migrations in CI/CD?

Yes, with non-interactive mode:

```bash
savestate migrate \
  --from chatgpt \
  --to claude \
  --export ./exports/chatgpt/ \
  --force \
  --no-color
```

For automation, you'll need to handle authentication separately.

### Where are migration bundles stored?

Default location: `~/.savestate/migrations/`

Customize with:
```bash
savestate migrate --from chatgpt --to claude --work-dir /path/to/dir
```

### Can I use a previous snapshot instead of live export?

Yes! If you have a SaveState snapshot:

```bash
savestate migrate --snapshot my-backup-2024-02-10 --to claude
```

This uses your existing snapshot as the source.

---

## Troubleshooting Questions

### Migration was interrupted. Did I lose my progress?

**No.** Progress is checkpointed at each phase. Resume with:

```bash
savestate migrate --resume
```

### Can I undo a migration?

The migration doesn't delete source data, so there's nothing to "undo." However:

- Your original platform is unchanged
- Claude Projects can be deleted if needed
- ChatGPT memories can be cleared in Settings

### Why is my content being "adapted"?

Adaptation happens when platforms have different:

- **Character limits** (Claude allows more than ChatGPT)
- **Feature sets** (memories vs. knowledge files)
- **Formats** (Markdown vs. XML conventions)

The wizard shows you proposed adaptations and lets you approve or edit them.

### What if a platform changes their export format?

SaveState extractors are updated regularly. If you encounter issues:

```bash
npm update -g savestate
```

Then retry your migration.

---

## Product Questions

### Is the Migration Wizard free?

The Migration Wizard is included in all SaveState plans:

| Plan | Migrations |
|------|------------|
| Free | Unlimited |
| Pro | Unlimited |
| Team | Unlimited |

Premium features like cloud sync and scheduled backups are in paid plans.

### What platforms are coming next?

Planned support:
- **Gemini** — Coming soon
- **Microsoft Copilot** — Coming soon  
- **Claude API** — Direct API integration
- **OpenAI Assistants** — Custom assistants

Request platforms: [github.com/savestatedev/savestate/discussions](https://github.com/savestatedev/savestate/discussions)

### Does migration count against my storage limits?

Migration bundles are temporary and can be deleted after successful migration. They count toward storage only while they exist.

---

## Still Have Questions?

- **Documentation:** [savestate.dev/docs](https://savestate.dev/docs)
- **GitHub Issues:** [Report bugs](https://github.com/savestatedev/savestate/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/savestatedev/savestate/discussions)
- **Discord:** [Community chat](https://discord.gg/savestate)
- **Email:** support@savestate.dev
