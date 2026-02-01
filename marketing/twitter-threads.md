# SaveState Twitter Threads

---

## 🚀 Main Launch Thread

**Thread Title:** Introducing SaveState: Time Machine for AI

---

**1/12**
🚀 Introducing SaveState — Time Machine for AI

Your AI assistant knows you better than most humans:
• Your preferences
• Your projects
• Your communication style
• Months of conversations

What's your backup plan?

Probably none. Let's fix that. 🧵

---

**2/12**
The problem:

• ChatGPT export takes 48 hours and gives you unreadable JSON
• Claude memory? Text dump only
• Want to switch platforms? Start from scratch
• Account locked? Everything's gone

Your photos have iCloud. Your passwords have 1Password.

Your AI has nothing.

---

**3/12**
SaveState is encrypted backup for your AI identity.

```bash
npx savestate init
npx savestate snapshot
```

That's it. Your AI state is now encrypted and backed up.

Your keys. Your data. Always.

---

**4/12**
What gets captured:

✅ Conversation history
✅ Memories & learned preferences
✅ Custom instructions
✅ Uploaded documents
✅ Tool configurations

Everything that makes your AI *yours*.

---

**5/12**
Platform support at launch:

🟢 Clawdbot / Claude Code — full backup & restore
🟢 OpenAI Assistants API — full backup & restore
🟡 ChatGPT — backup (restore memories only)
🟡 Claude.ai — backup (restore memories only)
🟡 Gemini — backup via Takeout

More coming via community adapters.

---

**6/12**
Migration is real:

```bash
savestate migrate --from chatgpt --to claude
```

• Memories transfer
• Custom instructions convert
• Documents upload to Projects
• Conversations become reference material

No more starting over.

---

**7/12**
Encryption is non-negotiable.

• scrypt key derivation (memory-hard, GPU-resistant)
• AES-256-GCM encryption
• Your passphrase, your keys
• Data encrypted BEFORE it leaves your machine

We literally cannot read your backups. By design.

---

**8/12**
Incremental snapshots = tiny storage.

Like git for your AI:
• First backup: full snapshot
• Later backups: only what changed
• Chain reconstruction on restore

500 conversations ≠ 500x storage cost.

---

**9/12**
Storage options:

Free:
• Local filesystem
• Any sync folder (Dropbox, iCloud)

Pro ($9/mo):
• SaveState Cloud (encrypted R2)
• Auto-scheduled backups
• All platform adapters
• Search across snapshots

---

**10/12**
The SAF format is open source.

Your backup tool shouldn't create another vendor lock-in.

• JSON + Markdown (human-readable when decrypted)
• Open spec anyone can implement
• Community adapters welcome

Fork it. Extend it. It's yours.

---

**11/12**
Get started in 60 seconds:

```bash
npm install -g savestate
savestate init
savestate snapshot
```

Or:
```bash
brew tap savestatedev/tap
brew install savestate
```

Full docs: https://savestate.dev/docs

---

**12/12**
Your AI relationship is an investment.

Months of context. Refined preferences. Accumulated knowledge.

It deserves the same protection as your photos, your files, your passwords.

SaveState: Your AI identity, backed up.

https://savestate.dev

⭐ Star us: https://github.com/savestatedev/savestate

---

## 🔐 Technical Deep-Dive Thread

**Thread Title:** How SaveState Encrypts Your AI Data

---

**1/10**
"How exactly does SaveState encryption work?"

Great question. Let me walk you through the cryptography.

🧵 Technical thread on protecting your most sensitive data:

---

**2/10**
Your AI conversations are extremely sensitive:

• Health questions
• Financial details
• Work secrets
• Personal thoughts
• The things you only ask AI

This data MUST be encrypted. Here's how we do it.

---

**3/10**
Step 1: Key Derivation

Your passphrase → scrypt → 256-bit key

Why scrypt?
• Memory-hard (requires 128MB RAM per attempt)
• GPU/ASIC resistant
• ~1 second on laptop, infeasible to brute force

Parameters: N=2^17, r=8, p=1

---

**4/10**
Step 2: Encryption

AES-256-GCM (Galois/Counter Mode)

Why GCM?
• Authenticated encryption (integrity + confidentiality)
• Single pass (fast)
• 96-bit nonce (never reused)
• 128-bit auth tag (tamper detection)

---

**5/10**
The encryption flow:

```
passphrase
    ↓
scrypt(pass, salt)
    ↓
256-bit key
    ↓
AES-GCM(plaintext, key, nonce)
    ↓
ciphertext + auth_tag
```

Key is NEVER stored. Derived fresh each time.

---

**6/10**
What's stored in the encrypted file:

```
┌─────────────────────────┐
│ Magic: "SAVESTATE"      │  ← Identify file type
│ Version: 1              │
│ Salt: 32 bytes          │  ← For key derivation
│ Nonce: 12 bytes         │  ← For AES-GCM
├─────────────────────────┤
│ Encrypted payload       │  ← Your actual data
├─────────────────────────┤
│ Auth tag: 16 bytes      │  ← Integrity check
└─────────────────────────┘
```

---

**7/10**
Zero-knowledge storage:

```
Your machine          Cloud
┌──────────┐         ┌──────────┐
│ plaintext│         │ encrypted│
│    ↓     │         │  blobs   │
│ encrypt  │────────▶│          │
│ locally  │         │ we can't │
└──────────┘         │ read it  │
                     └──────────┘
```

Even SaveState Cloud can't access your data.

---

**8/10**
Future security features (roadmap):

• YubiKey support
• Touch ID via Secure Enclave
• Shamir's Secret Sharing (split recovery key N-of-M ways)

But even without these, base security is strong.

---

**9/10**
We use libsodium via sodium-native:

• Battle-tested crypto library
• Used by Signal, Keybase, NaCl
• Professionally audited
• No homebrew crypto

We didn't invent new cryptography. We used proven primitives correctly.

---

**10/10**
Your AI knows your secrets.

We made sure only you can access the backup.

```bash
npx savestate init
```

Full architecture docs: https://savestate.dev/docs/architecture

Security questions? security@savestate.dev

We welcome audits. 🔐

---

## 🎯 Problem Awareness Thread (Alternative Angle)

**Thread Title:** The AI Data Crisis Nobody's Talking About

---

**1/8**
Unpopular opinion:

Your relationship with ChatGPT is more fragile than you think.

One account lockout. One policy change. One billing glitch.

Gone. All of it. 🧵

---

**2/8**
What you've built with your AI:

• Months of refined preferences
• Project context accumulated over hundreds of conversations  
• Custom instructions tuned through trial and error
• The AI that finally "gets" how you think

Try exporting that to another platform. I'll wait.

---

**3/8**
The current state of "portability":

ChatGPT: 24-48 hour export → unreadable JSON
Claude: Memory text dump (no conversations)
Gemini: Google Takeout (good luck)

No encryption. No restore. No cross-platform.

This is NOT backup. It's archaeology.

---

**4/8**
Real risks I've seen:

• Dev lost 2 years of coding context after "suspicious activity" flag
• Writer's account suspended during billing dispute
• Researcher's conversations vanished after platform "update"

These aren't hypotheticals. They're happening weekly.

---

**5/8**
The killer: you can't switch platforms.

Want to try Claude after years on ChatGPT?

Start over.

All that context? Gone.
All those preferences? Gone.
The AI that knows your projects? Gone.

Vendor lock-in by data fragmentation.

---

**6/8**
We backup:
• Photos (iCloud)
• Files (Time Machine)
• Passwords (1Password)
• Code (git)
• Notes (sync services)

The AI that knows our secrets?

Nothing.

---

**7/8**
This is fixable.

Encrypted backup that you control.
Cross-platform migration that actually works.
Scheduled snapshots that happen automatically.

Your AI identity doesn't have to be held hostage.

---

**8/8**
I built SaveState because this problem shouldn't exist.

Open source. Encrypted. Platform-agnostic.

Your AI data should belong to you.

https://savestate.dev
https://github.com/savestatedev/savestate

What AI platform are you most worried about losing? 👇

---

## 📌 Notes for Posting

**Best times to post:**
- Weekdays 9-11 AM EST (tech audience)
- Avoid weekends for launch threads

**Engagement strategy:**
- Reply to comments within first hour
- Quote tweet individual posts with additional context
- Pin the thread to profile during launch week

**Hashtags (use sparingly, 1-2 per tweet max):**
- #AI
- #OpenSource
- #DevTools
- #DataPrivacy

**Images to create:**
- Thread 1, Tweet 1: SaveState logo + "Time Machine for AI"
- Thread 1, Tweet 4: SAF format visualization
- Thread 1, Tweet 7: Encryption flow diagram
- Thread 2, Tweet 6: Zero-knowledge diagram
