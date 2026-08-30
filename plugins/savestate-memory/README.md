# SaveState Memory plugin packet

In-repo install packet for Cursor, Claude Code, and ChatGPT/Codex.

**Official marketplace submit needs David Hurley's account.** These files are prep. Do not invent a listing URL. There is none yet.

- Registry name: `dev.savestate/memory`
- Playbook: https://savestate.dev/agents.md
- Hosted MCP: https://savestate.dev/api/mcp
- Local: `npx -y @savestate/cli mcp`
- Pay: `POST /v1/keys` → 402 `pay_url` + `claim_url` (card subscription, not MPP)

## Files

| Path | Client |
| --- | --- |
| `plugin.json` + `mcp.json` | Agent Plugins 1.0 (portable) |
| `.cursor-plugin/plugin.json` | Cursor |
| `.claude-plugin/plugin.json` + `.mcp.json` | Claude Code |
| `.codex-plugin/plugin.json` + `.mcp.json` | ChatGPT / Codex |

Repo-local catalogs (path sources only): `.cursor-plugin/marketplace.json`, `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`.
