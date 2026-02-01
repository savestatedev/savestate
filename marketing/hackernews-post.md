# Hacker News Post

## Show HN: SaveState – Time Machine for AI (Encrypted backup for ChatGPT, Claude, etc.)

---

### Title Options (choose based on character limit):

**Option A (69 chars):**
`Show HN: SaveState – Encrypted backup and migration for AI assistants`

**Option B (64 chars):**
`Show HN: SaveState – Time Machine for AI (backup ChatGPT/Claude)`

**Option C (59 chars):**
`Show HN: SaveState – Backup and restore your AI identity`

---

### Post Body:

Hey HN,

I built SaveState because I realized my AI assistants have become critical infrastructure in my workflow—and they have zero backup.

**The problem:**
- ChatGPT export takes 24-48 hours, produces unreadable JSON, has no encryption, and can't be restored
- Claude gives you a text dump of memories, no conversations
- Gemini requires Google Takeout gymnastics
- Custom agents (OpenAI Assistants API, etc.) often have no backup at all
- Switching platforms means starting from scratch

All this context we've built up—preferences, project knowledge, refined instructions—lives in a single point of failure with no portability.

**The solution:**
SaveState is encrypted backup for AI agent state. Think Time Machine, but for your AI.

```
npx savestate init                     # Set up encryption
npx savestate snapshot                 # Capture current state
npx savestate restore latest           # Restore from backup
savestate migrate --from chatgpt --to claude  # Cross-platform migration
```

**Technical details:**
- scrypt key derivation (N=2^17, r=8, p=1) → AES-256-GCM
- Open archive format (SAF) - JSON + Markdown, human-readable when decrypted
- Incremental snapshots (content-addressed, delta-only after first full backup)
- Plugin architecture for platform adapters
- Zero-knowledge cloud storage (data encrypted locally before upload)

**Current platform support:**
- Full backup/restore: Clawdbot, Claude Code bots, OpenAI Assistants API
- Backup + partial restore: ChatGPT (via data export), Claude.ai, Gemini

**Pricing:**
- CLI + local storage: Free forever, open source (MIT)
- Pro ($9/mo): Scheduled auto-backups, cloud storage, all adapters, search

The SAF format spec is open—I explicitly don't want your backup tool to be another vendor lock-in.

Code: https://github.com/savestatedev/savestate
Docs: https://savestate.dev/docs

I'd especially appreciate feedback on:
1. The encryption approach (any cryptographers here?)
2. Adapter priorities—what platforms should we support next?
3. The incremental snapshot strategy

Happy to answer questions about the architecture or implementation.

---

### Alternative Shorter Version (if needed):

Hey HN,

I built SaveState because I realized my AI has no backup.

ChatGPT export gives you unreadable JSON after 48 hours. Claude exports memories as text. Neither encrypts. Neither restores. Switching platforms means starting over.

SaveState is encrypted backup for AI—AES-256-GCM, scrypt KDF, open archive format. Works with ChatGPT, Claude, OpenAI Assistants, and custom agents.

```
npx savestate init
npx savestate snapshot
savestate migrate --from chatgpt --to claude
```

Free + open source for local backups. Pro tier for cloud storage and auto-scheduling.

Code: https://github.com/savestatedev/savestate

Would love feedback on encryption approach and which platforms to prioritize.

---

### Comment Responses to Prepare:

**Q: Why not just use the platform's export?**
A: Platform exports are incomplete (ChatGPT doesn't export memories properly, Claude doesn't export conversations), unencrypted (your data sits in a ZIP anyone can read), and non-restorable (it's archaeology, not backup). SaveState captures everything, encrypts it with your keys, and can actually restore to the same or different platform.

**Q: What about privacy—are you reading my data?**
A: We literally cannot. Data is encrypted with scrypt/AES-256-GCM *on your machine* before it ever touches our servers. We only see encrypted blobs. The passphrase never leaves your device. For the skeptical (as you should be), the CLI is fully functional with local storage only—no cloud required.

**Q: Why scrypt instead of Argon2?**
A: Both are good choices. scrypt has been around longer and has more production deployments, which means it's been battle-tested more extensively. We may add Argon2id as an option in the future—the architecture supports swapping KDFs.

**Q: How do you handle ChatGPT/Claude extraction without official API?**
A: ChatGPT: We use their official data export (which you request through the UI), then parse and organize it. Claude: We use the memory export feature plus Projects. We don't do any scraping or browser automation that would violate ToS—everything works through official export mechanisms.

**Q: What about rate limiting for incremental snapshots?**
A: Incremental snapshots are content-addressed. We hash each piece of content and only include what's changed since the last snapshot. This means frequent snapshots are tiny (a few KB of deltas) rather than re-uploading your entire conversation history.

**Q: Is this like restic/borg but for AI?**
A: Similar philosophy! Content-addressed storage, incremental snapshots, encryption at rest. The key difference is the adapter layer—we understand the semantics of AI data (conversations, memories, tools) rather than treating it as generic files. This lets us do things like cross-platform migration and semantic search.

**Q: Why Node.js/TypeScript?**
A: Widest ecosystem reach. npm is still the most accessible distribution for CLI tools—most developers already have Node installed. We also ship native binaries for those who don't want the Node dependency. The encryption uses sodium-native (bindings to libsodium), not JavaScript crypto.

---

### Timing Notes:

**Best times to post:**
- Tuesday-Thursday, 9-10 AM EST
- Avoid Mondays (catching up from weekend) and Fridays (checked out)

**First hour is critical:**
- Have a few friends ready to upvote and ask genuine questions
- Respond to every comment quickly
- Be technical and specific—HN appreciates depth

**Common HN pitfalls to avoid:**
- Don't be defensive about criticism
- Don't oversell—be honest about limitations
- Don't use marketing speak—HN hates it
- Do engage deeply with technical questions
