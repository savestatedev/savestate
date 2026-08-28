# Week 3 Show HN — DRAFT

> **DRAFT — DO NOT FILE ON HACKER NEWS.**
> Unpublished week 3 copy. Refresh of `marketing/hackernews-post.md` for the current product.
> Do not submit this. Do not create an HN account action from this PR.

The January post led with "Time Machine for AI" and an npm-first CTA. That is the old product. Week 3 leads with Claude Code / Cursor / Clawdbot, memory that survives the chat, and live Pro checkout on a buyer page.

npm is secondary. No invented user counts.

**CTA:** https://savestate.dev/blog/when-the-chat-dies (buyer page; Subscribe is the live Pro Payment Link from `stripe-config.json`). Tool pages if the thread goes tool-specific: https://savestate.dev/cursor · https://savestate.dev/claude-code · https://savestate.dev/clawdbot

---

## Title options

**Option A (recommended, 78 chars):**
`Show HN: SaveState – when the chat dies, Claude Code/Cursor/Clawdbot still know`

**Option B (73 chars):**
`Show HN: SaveState – portable memory for Claude Code, Cursor, and Clawdbot`

**Option C (68 chars):**
`Show HN: Encrypted agent memory that survives the chat ($9/mo Pro)`

---

## Post body

Hey HN,

I built SaveState because the chat is not the memory.

Claude Code closes. Cursor crashes. Clawdbot's gateway restarts. The next session starts blank — rules, MCP config, CLAUDE.md, SOUL.md, the workspace that made the agent yours, still sitting where the vendor put them, or gone with the disk.

A transcript export is not a restore.

SaveState snapshots identity, memories, conversations, and tools into an encrypted archive (AES-256-GCM, scrypt KDF, user-held passphrase). Search it later. Restore it on another box. The chat can die. The archive does not.

**What actually works today**
- Claude Code — first-class. Extract and restore CLAUDE.md, `.claude/`, and `~/.claude/`.
- Clawdbot — first-party. SOUL.md, MEMORY.md, skills, gateway config, session JSONL. Credentials stay out unless you opt in.
- Cursor — community adapter. MCP servers, composer-rules, project `.cursor/rules`. Workspace SQLite is recorded in the manifest; we do not parse Composer threads yet, and restore never writes back into the live IDE database.

**Pro is live.** $9/month — scheduled snapshots, cloud storage, search, dashboard. Card today. No waitlist.

https://savestate.dev/blog/when-the-chat-dies

CLI / local path is still free and open source if you want that first. The product a stranger can buy is on that page.

Code: https://github.com/savestatedev/savestate

I'd especially appreciate feedback on:
1. Whether "memory that survives the chat" is the right frame vs. backup/restore
2. Cursor v2 — is parsing `state.vscdb` Composer history worth the risk, given we refuse to write back into the live DB
3. The encryption approach (scrypt → AES-256-GCM, keys never leave the machine)

Happy to answer questions about the adapters or the archive format.

---

## Shorter version (if the long one feels like a pitch)

Hey HN,

When the chat dies, the next Claude Code / Cursor / Clawdbot session starts blank. SaveState is encrypted portable memory for those three — snapshot the identity, not the window.

Claude Code and Clawdbot are full extract/restore. Cursor captures MCP + rules today; Composer history is v2, and we do not write back into the live IDE SQLite.

Pro is live at $9/mo. Buyer page (checkout is on the page, not a raw Stripe dump): https://savestate.dev/blog/when-the-chat-dies

Code: https://github.com/savestatedev/savestate

Would love feedback on the frame and on whether Cursor chat-history parsing is worth doing.

---

## Comment responses to prepare (do not post in advance)

**Q: Why not just use the platform export?**
A: Exports are incomplete, unencrypted, and usually not restorable. Claude Code's brain is files on disk (`CLAUDE.md`, `.claude/`). Cursor's is MCP + rules + a SQLite we are honest about not fully parsing yet. Clawdbot is a workspace. SaveState understands those layouts, encrypts with your keys, and can put the files back.

**Q: Are you reading my data?**
A: We cannot. Encryption happens on the machine before upload. Local-only storage works with no account.

**Q: Is this just backup with a new headline?**
A: Backup is one thing you can do with the archive. The product is a memory layer you own — search, restore, move across Claude Code / Cursor / Clawdbot. The chat is a session. The archive is the agent.

**Q: Why $9?**
A: Pro is scheduled cloud snapshots, search, and a dashboard. The CLI stays free. The Payment Link is live; the buyer page is the front door so we are not dumping a Stripe URL at you.

---

## Filing notes (for later — not now)

- Do not file this from this PR.
- When someone does file it: Tuesday–Thursday, morning US time. Reply to comments. Do not get defensive. Do not paste npm as the first reply.
- Link the buyer post, not `npm install`.
