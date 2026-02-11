# ChatGPT Migration Package

> Generated: 2026-02-11T00:25:47.210Z

## Overview

This package contains your migrated data from Claude, ready to be applied to ChatGPT.

## Status

| Item | Status |
|------|--------|
| Custom Instructions | ✅ Ready |
| Memories | ✅ 3 entries |
| Files | ❌ None |
| Custom GPTs | ❌ None |

## Manual Steps Required

### 1. Set Custom Instructions

1. Open ChatGPT → Settings (⚙️) → Personalization → Custom Instructions
2. Open `custom-instructions.txt` in this folder
3. Copy the content into the "How would you like ChatGPT to respond?" field
4. Save

### 2. Add Memories

1. Open ChatGPT → Settings (⚙️) → Personalization → Memory → Manage
2. Open `memories.md` in this folder
3. For each bullet point, click "Create memory" and paste the content
4. Repeat for all memories (or prioritize the most important ones)

> Note: ChatGPT has a limit of ~100 memories. 3 memories are included.

## Files in This Package

```
evil-directory/
├── custom-instructions.txt  # Copy to ChatGPT settings
├── custom-instructions-full.txt  # Full content (if truncated)
├── memories.md  # Memories to add manually
├── memories.json  # Memories in JSON format
```

---

Need help? Visit https://savestate.dev/docs/migration