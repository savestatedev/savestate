# SaveState — agent onboarding

Encrypted portable memory for Claude Code, Cursor, Codex, and Clawdbot.

Local CLI is free. A cloud API key is Pro only ($9/mo). This file is the pay-and-connect path. Email is extra, not delivery.

## 1. Capability

Snapshot, search, and restore encrypted agent memory. MCP server on stdio. Cloud storage and scheduled backups require Pro.

## 2. Install (free, no cloud key)

```bash
npm install -g @savestate/cli
savestate init
```

Do not call `/v1/keys` for Free. The local CLI does not need `ss_live_`.

## 3. Connect MCP

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

Server card: https://savestate.dev/.well-known/mcp.json
OpenAPI: https://savestate.dev/openapi.json

## 4. Pay and claim a cloud key (agents)

You cannot read the inbox SaveState emails after checkout. Use the claim URL.

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

1. Open or complete `pay_url` (SaveState Pro, $9/month).
2. Poll `GET {claim_url}`.
   - `402` unpaid — pay is not done
   - `202` processing — paid; webhook is minting
   - `200` `{ "api_key": "ss_live_..." }` — store it; this is once
   - `409` already claimed
   - `410` expired
3. Use `Authorization: Bearer ss_live_...` on cloud APIs.
4. `401` means a bad key. `402` means unpaid.

Fulfillment is only the signed Stripe `checkout.session.completed` webhook. Do not treat `success_url` as issuance.

## 5. Human secondary

Same Pro, if a human is present: https://buy.stripe.com/aFa00j5E4ees8hf3kp2ZO00

Team ($29/mo): https://buy.stripe.com/8x27sLc2s4DSapn4ot2ZO01

After a human Payment Link, email still sends the key. Agents should still use POST `/v1/keys` + claim.

## 6. Auth reminder

- 401 = bad or missing key
- 402 = unpaid (`pay_url` + `claim_url` required)
- Local MCP passphrase stays in-process (`SAVESTATE_MCP_PASSPHRASE`)
