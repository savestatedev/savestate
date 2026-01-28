# Your AI Knows Everything About You. What's Your Backup Plan?

*Introducing SaveState — Time Machine for your AI identity*

---

## The Relationship You Didn't Know You Had

Think about your AI assistant for a moment.

It knows your writing style. Your preferences. The projects you're working on. The way you like things explained. Your pet peeves. Your recurring questions.

If you've been using ChatGPT, Claude, or Gemini for any length of time, your AI has built a detailed mental model of *you*. Custom instructions refined over months. Memories accumulated through hundreds of conversations. Tool configurations tuned to your workflow.

This isn't just data. It's a relationship.

And here's the uncomfortable truth: **none of it is backed up**.

## The Problem Nobody Talks About

What happens when:

- OpenAI changes their memory system (again)?
- You want to try Claude but don't want to start over?
- A service outage wipes your conversation history?
- You need to switch platforms for work?
- The API you built on gets deprecated?

Right now, the answer is: you lose everything and start over.

Your AI's understanding of you — accumulated over months of interaction — vanishes. You're back to explaining your preferences, rebuilding your custom instructions, re-establishing context.

It's like getting a new assistant every time something changes. And it happens more often than you think.

## Introducing SaveState

We built SaveState because we think your AI identity should belong to you.

```bash
# Install
npm install -g @savestate/cli

# Initialize (sets up encryption)
savestate init

# Capture your AI's current state
savestate snapshot

# Restore anytime
savestate restore latest

# Or migrate to a different platform
savestate migrate --from chatgpt --to claude
```

SaveState is **Time Machine for AI**. It captures, encrypts, and preserves your AI's understanding of you — so you never have to start over.

## How It Works

### 1. Extract Everything That Matters

SaveState pulls your AI identity from wherever it lives:

- **Custom instructions** and system prompts
- **Memories** the AI has learned about you
- **Conversation history** (where supported)
- **Tool configurations** and API setups
- **Projects** and knowledge bases

We support ChatGPT, Claude (web and API), Gemini, OpenAI Assistants, Moltbot, and any file-based agent system. More adapters are being added constantly.

### 2. Encrypt Before It Leaves Your Machine

Your AI knows sensitive things. SaveState treats that seriously.

- **AES-256-GCM** encryption with scrypt key derivation
- Your passphrase, your keys — we never see them
- Encryption happens locally, before any data moves
- Even if you use our cloud storage, we can't read your backups

### 3. Store Where You Want

- **Local filesystem** (free, default)
- **Our cloud** (Pro/Team — Cloudflare R2, encrypted at rest)
- **Your own S3/R2/Backblaze** (coming soon)
- **Dropbox/iCloud** (coming soon)

### 4. Restore or Migrate

Restore to the same platform when things go wrong. Or migrate to a different platform when you want to switch.

The SaveState Archive Format (SAF) is an open spec. Your backups aren't locked to us any more than they're locked to OpenAI or Anthropic.

## Features

- **🔐 End-to-end encryption** — AES-256-GCM, your keys only
- **📦 Open archive format** — No vendor lock-in, ever
- **⏰ Scheduled auto-backups** — Set it and forget it (Pro)
- **🔄 Cross-platform migration** — ChatGPT → Claude, etc.
- **📊 Incremental snapshots** — Like git, only stores what changed
- **🖥️ Web dashboard** — Manage backups from anywhere (Pro)
- **🔍 Diff between snapshots** — See what changed over time

## Pricing

**Free**: Local encrypted backups, all platform adapters, manual snapshots. Everything you need to protect your AI identity on your own machine.

**Pro ($9/month)**: Cloud storage (10GB), scheduled auto-backups, web dashboard, migration wizard, priority support. For people who want set-it-and-forget-it protection.

**Team ($29/month)**: 100GB cloud storage, shared team backups, audit logs, compliance features. For organizations managing multiple AI deployments.

## Why We Built This

AI assistants are becoming extensions of ourselves. They're not just tools — they're collaborators that learn and adapt to how we work.

But the platforms treat your AI relationship as their property. Your memories live on their servers. Your custom instructions are in their database. Your conversation history is their training data.

We think that's backwards.

**Your AI identity should be yours.** Portable. Backed up. Under your control.

SaveState makes that possible.

## Get Started

```bash
npm install -g @savestate/cli
savestate init
savestate snapshot
```

Your first backup takes about 30 seconds.

- **Website**: [savestate.dev](https://savestate.dev)
- **npm**: [@savestate/cli](https://www.npmjs.com/package/@savestate/cli)
- **GitHub**: [savestatedev/savestate](https://github.com/savestatedev/savestate)

---

*SaveState is open source (MIT license) and built in public. Star the repo if this resonates. We're just getting started.*
