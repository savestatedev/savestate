# SaveState — agent onboarding

Required floor (capability, install, MCP, auth, pay, 402+claim): https://savestate.dev/llms.txt

This file is the longer playbook. Encrypted portable memory for Claude Code, Cursor, Codex, and Clawdbot.

Local CLI is free. Cloud Pro is a card subscription ($9/mo). Agents cannot read email — use the claim URL. Do not wait for OAuth authorization-code or agent-native recurring MPP.

## Capability

Snapshot, search, and restore encrypted agent memory. Local MCP on stdio. Hosted MCP at `/api/mcp` for cloud-keyed clients. Scheduled backups and cloud storage require Pro.

## Preferred connect

1. Required floor: https://savestate.dev/llms.txt — self-contained capability, install, hosted MCP URL, auth, pay URL, 402+claim. Do not skip it.
2. This playbook: https://savestate.dev/agents.md
3. Hosted MCP: `https://savestate.dev/api/mcp` (streamable-http). Send `Authorization: Bearer ss_live_...`.
4. Bearer token comes from **card checkout + claim**, not an OAuth authorize URL and not MPP. Missing or bad key → **401**. Unpaid checkout → **402** with `pay_url` + `claim_url` on `POST /v1/keys`.
5. Registry name (if you publish `server.json`): `dev.savestate/memory`
6. Registry packet: https://savestate.dev/server.json
7. OpenAPI: https://savestate.dev/openapi.json

`/.well-known/mcp.json` is a leftover card. Prefer this file + hosted MCP. MCP well-known paths have been churning.

## Install (local CLI — free, no cloud key)

```bash
npm install -g @savestate/cli
savestate init
```

Do not call `/v1/keys` for Free. The local CLI does not need `ss_live_`.

Local stdio MCP (works without Pro):

```json
{
  "mcpServers": {
    "savestate": {
      "command": "npx",
      "args": ["-y", "@savestate/cli", "mcp"]
    }
  }
}
```

Claude Code: `~/.claude/settings.json`. Cursor: `~/.cursor/mcp.json`. Codex: `codex mcp add savestate -- npx -y @savestate/cli mcp`.

In-repo plugin packets (prep only — official marketplace submit needs David Hurley's account; there is no listing URL yet): `plugins/savestate-memory/`.

## Pay and claim a cloud key (agents)

You cannot read the inbox SaveState emails after checkout. Use the claim URL. Pay is a card subscription. Do not block on agent-native recurring MPP.

```http
POST https://savestate.dev/v1/keys
Content-Type: application/json

{}
```

Response is **HTTP 402**:

```json
{
  "error": "payment_required",
  "pay_url": "https://checkout.stripe.com/...",
  "claim_url": "https://savestate.dev/v1/keys/claims/<id>"
}
```

1. Complete `pay_url` (SaveState Pro, $9/month).
2. Poll `GET {claim_url}`.
   - `402` unpaid
   - `202` processing — webhook is minting
   - `200` `{ "api_key": "ss_live_..." }` — once
   - `409` already claimed
   - `410` expired
3. Call hosted MCP with `Authorization: Bearer ss_live_...`.
4. `401` = bad or missing key. `402` = unpaid.

Fulfillment is only the signed Stripe `checkout.session.completed` webhook. `success_url` does not mint keys.

## Human secondary

Same Pro: https://buy.stripe.com/aFa00j5E4ees8hf3kp2ZO00

Team ($29/mo): https://buy.stripe.com/8x27sLc2s4DSapn4ot2ZO01

Email still sends the key after a human Payment Link. Agents should use POST `/v1/keys` + claim.

## Auth

- Hosted MCP and cloud APIs: `Authorization: Bearer ss_live_...`
- Token issuance: POST `/v1/keys` → pay → claim. Not OAuth authorization-code. Not MPP.
- Local MCP passphrase: `SAVESTATE_MCP_PASSPHRASE` in-process only
- Protected-resource metadata: https://savestate.dev/.well-known/oauth-protected-resource

## Smithery

In-repo listing metadata: `smithery.yaml` at the repo root. No Glama or PulseMCP packets.
