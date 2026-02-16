# Migration Wizard Documentation

SaveState's Migration Wizard helps you move your AI identity between platforms — your instructions, memories, files, and custom configurations all transfer seamlessly.

## Quick Links

| Document | Description |
|----------|-------------|
| [Getting Started](./getting-started.md) | Prerequisites, installation, and quick start |
| [ChatGPT → Claude](./chatgpt-to-claude.md) | Step-by-step ChatGPT to Claude migration |
| [Claude → ChatGPT](./claude-to-chatgpt.md) | Step-by-step Claude to ChatGPT migration |
| [Compatibility Guide](./compatibility-guide.md) | What migrates, adapts, and limitations |
| [Troubleshooting](./troubleshooting.md) | Common errors and solutions |
| [FAQ](./faq.md) | Frequently asked questions |

## Supported Migrations

| From | To | Status |
|------|----|--------|
| ChatGPT | Claude | ✅ Fully supported |
| Claude | ChatGPT | ✅ Fully supported |
| ChatGPT | Gemini | 🔜 Coming soon |
| Claude | Gemini | 🔜 Coming soon |

## Quick Start

```bash
# Install SaveState
npm install -g savestate

# Initialize
savestate init

# Migrate!
savestate migrate --from chatgpt --to claude
```

## Features

- **🔐 Encrypted** — Your data is encrypted throughout the process
- **📦 No API keys** — Works with data exports, not API access  
- **🔄 Bidirectional** — Migrate in either direction
- **⏸️ Resumable** — Interrupted migrations can be continued
- **👀 Preview mode** — See what will happen with `--dry-run`

## Need Help?

- [Troubleshooting Guide](./troubleshooting.md)
- [FAQ](./faq.md)
- [GitHub Issues](https://github.com/savestatedev/savestate/issues)
