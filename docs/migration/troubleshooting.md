# Troubleshooting

Solutions for common issues when using the Migration Wizard.

## Common Errors

### "SaveState not initialized"

```
✗ SaveState not initialized. Run `savestate init` first.
```

**Solution:** Initialize SaveState before migrating:
```bash
savestate init
```

This creates the configuration directory and encryption keys.

---

### "Export not found" / "Cannot locate export"

```
✗ Cannot locate ChatGPT export at specified path
```

**Causes:**
- Wrong path to export directory
- Export still zipped
- Missing required files

**Solutions:**

1. Unzip the export file:
   ```bash
   unzip chatgpt-export-*.zip -d ~/Downloads/chatgpt-export/
   ```

2. Point to the correct directory:
   ```bash
   savestate migrate --from chatgpt --to claude --export ~/Downloads/chatgpt-export/
   ```

3. Verify the export contains expected files:
   ```bash
   ls ~/Downloads/chatgpt-export/
   # Should show: user_data.json, conversations/, etc.
   ```

---

### "Authentication required"

```
⚠ Claude authentication required
```

**For browser-based extraction:**
1. The wizard will open a browser window
2. Log in to the platform
3. Return to the terminal and press Enter

**If browser doesn't open:**
```bash
savestate migrate --from claude --to chatgpt --no-browser
```
Then manually provide an export or session token.

---

### "File too large"

```
⚠ File 'large-dataset.csv' (156 MB) exceeds Claude limit (32 MB)
```

**Options:**

1. **Split the file** before migration:
   ```bash
   split -b 30M large-dataset.csv dataset-part-
   ```

2. **Exclude files** and migrate separately:
   ```bash
   savestate migrate --from chatgpt --to claude --include instructions,memories
   ```
   Then manually upload large files.

3. **Compress** if the file type allows:
   ```bash
   gzip large-dataset.csv
   ```

---

### "Instructions too long"

```
⚠ Instructions (6,240 chars) exceed ChatGPT limit (1,500 chars)
```

**Solutions:**

1. **Accept automatic condensation:**
   The wizard will show a proposed summary. Review and approve.

2. **Edit manually:**
   When prompted, choose "edit" to condense yourself.

3. **Split strategy:**
   ```bash
   savestate migrate --from claude --to chatgpt --strategy split
   ```
   Core instructions stay in Custom Instructions; details go to GPT knowledge.

---

### "Too many memories"

```
⚠ Knowledge file contains 247 facts; ChatGPT supports ~100 memories
```

**Solutions:**

1. **Automatic prioritization:**
   The wizard keeps the most important/recent memories.

2. **Selective migration:**
   ```bash
   savestate migrate --from claude --to chatgpt --memory-limit 100
   ```

3. **Manual review:**
   Export memories to a file, edit, then import:
   ```bash
   savestate migrate --from claude --to chatgpt --review
   ```

---

### "Transformation failed"

```
✗ Failed to transform memories: Invalid format
```

**Causes:**
- Corrupted export data
- Unexpected format in source platform
- Version mismatch

**Solutions:**

1. **Re-export** from the source platform

2. **Update SaveState:**
   ```bash
   npm update -g savestate
   ```

3. **Skip problematic content:**
   ```bash
   savestate migrate --from chatgpt --to claude --include instructions,files
   ```

4. **Report the issue:**
   ```bash
   savestate migrate --from chatgpt --to claude --verbose 2>&1 | tee migration-debug.log
   ```
   Share `migration-debug.log` when opening an issue.

---

### "Connection timeout"

```
✗ Connection to Claude timed out after 30s
```

**Solutions:**

1. **Check your internet connection**

2. **Increase timeout:**
   ```bash
   savestate migrate --from chatgpt --to claude --timeout 120
   ```

3. **Use offline mode:**
   Extract first, then load:
   ```bash
   savestate migrate --from chatgpt --extract-only
   # Later:
   savestate migrate --bundle ./migration-bundle.smb --to claude
   ```

---

### "Rate limited"

```
⚠ Rate limited by platform. Waiting 60s...
```

This is normal — the wizard automatically waits and retries. For large migrations:

```bash
savestate migrate --from chatgpt --to claude --rate-limit slow
```

---

### "Migration interrupted"

```
Migration interrupted. Progress saved.
Use 'savestate migrate --resume' to continue.
```

**This is recoverable!** Your progress is checkpointed.

**Resume:**
```bash
savestate migrate --resume
```

**If multiple interrupted migrations exist:**
```bash
savestate migrate --resume
# You'll be prompted to select which one
```

**Start fresh instead:**
```bash
savestate migrate --from chatgpt --to claude --force-new
```

---

## Using --resume

The Migration Wizard automatically saves progress at each phase. If interrupted (Ctrl+C, network error, crash), you can resume:

```bash
savestate migrate --resume
```

### What Gets Saved

| Phase | Checkpoint Contains |
|-------|-------------------|
| Extracting | Partial bundle, completed items |
| Transforming | Transformed bundle, pending items |
| Loading | Loaded items, remaining queue |

### Viewing Interrupted Migrations

```bash
savestate migrate --resume --list
```

Output:
```
Interrupted Migrations:
  1. abc123 - ChatGPT → Claude (45% complete)
     Started: 2024-02-10 14:30
     Phase: transforming
     
  2. def456 - Claude → ChatGPT (12% complete)  
     Started: 2024-02-09 09:15
     Phase: extracting
```

### Cleaning Up Old Migrations

```bash
savestate migrate --cleanup
```

This removes incomplete migration bundles older than 7 days.

---

## Using --dry-run

Preview migrations without making changes:

```bash
savestate migrate --from chatgpt --to claude --dry-run
```

### What --dry-run Shows

1. **Compatibility report** — What transfers, adapts, or fails
2. **Size estimates** — How much data will be processed
3. **Time estimate** — Approximate migration duration
4. **Required actions** — Manual steps you'll need to take

### When to Use

- **Before any migration** — Understand what will happen
- **Large migrations** — Check for potential issues
- **Testing** — Verify the wizard recognizes your export

---

## Using --review

See items needing attention without starting migration:

```bash
savestate migrate --from chatgpt --to claude --review
```

### Review Mode Output

```
Items Requiring Review:
  
  ⚠ Custom Instructions (1,247 chars)
    Will transfer without modification
    
  ⚠ Memory Entries (47 entries)
    Action: Will be converted to project knowledge file
    
  ⚠ DALL-E Integration
    Action: Not available in Claude - use MCP alternatives
    
  ⚠ large-report.pdf (45 MB)
    Action: Exceeds Claude file limit - will be split
    
Recommendations:
  1. Review the memory → knowledge conversion
  2. Set up MCP tools for image generation
  3. Approve file splitting strategy
```

---

## Getting Help

### Verbose Logging

```bash
savestate migrate --from chatgpt --to claude --verbose
```

Shows detailed progress and debugging information.

### Debug Output

```bash
DEBUG=savestate:* savestate migrate --from chatgpt --to claude
```

Full debug logs for diagnosing issues.

### Saving Logs

```bash
savestate migrate --from chatgpt --to claude --verbose 2>&1 | tee migration.log
```

### Reporting Issues

1. **Gather information:**
   ```bash
   savestate --version
   node --version
   savestate migrate --from chatgpt --to claude --dry-run --verbose 2>&1 | tee debug.log
   ```

2. **Open an issue:** [github.com/savestatedev/savestate/issues](https://github.com/savestatedev/savestate/issues)

3. **Include:**
   - SaveState version
   - Node.js version
   - Platform (macOS/Linux/Windows)
   - The debug log (sanitize personal info)
   - Steps to reproduce

### Community Support

- **GitHub Discussions:** Ask questions and share tips
- **Discord:** Real-time help from the community

---

## Platform-Specific Issues

### ChatGPT Export Issues

**"Export email never arrived"**
- Check spam folder
- Wait up to 24 hours for large accounts
- Try requesting again from Settings → Data Controls

**"Export is incomplete"**
- Some accounts have data in multiple regions
- Contact OpenAI support if files are missing

### Claude Connection Issues

**"Project not accessible"**
- Ensure you have Claude Pro for Projects
- Check you're logged into the correct account
- Try browser-based extraction

**"MCP setup required"**
- See [Claude MCP documentation](https://docs.anthropic.com/claude/docs/mcp)
- MCP is optional but enables more features

---

## Error Reference

| Error Code | Meaning | Solution |
|------------|---------|----------|
| E001 | Not initialized | Run `savestate init` |
| E002 | Export not found | Check path, unzip export |
| E003 | Auth required | Log in via browser |
| E004 | File too large | Split or exclude file |
| E005 | Content too long | Condense or split |
| E006 | Transform failed | Re-export, update CLI |
| E007 | Load failed | Check target permissions |
| E008 | Rate limited | Wait or use --rate-limit |
| E009 | Connection error | Check network, retry |
| E010 | Checkpoint corrupt | Start fresh |

---

## See Also

- [Getting Started](./getting-started.md) — Prerequisites and quick start
- [Compatibility Guide](./compatibility-guide.md) — What migrates and how
- [FAQ](./faq.md) — Frequently asked questions
