# SaveState Container Format v1

## Overview

The SaveState container is a single-file format for exporting/importing encrypted agent state. It bundles multiple payloads (personality, memory, history, config) with integrity verification.

## File Structure

```
┌─────────────────────────────────────────┐
│ Magic Header (16 bytes)                 │
│ "SAVESTATE" + version (1 byte)         │
├─────────────────────────────────────────┤
│ Manifest Length (4 bytes, LE)          │
├─────────────────────────────────────────┤
│ Manifest (JSON, UTF-8)                 │
│ - version, created, payloads[]         │
├─────────────────────────────────────────┤
│ Payload 1 (variable length)             │
├─────────────────────────────────────────┤
│ Payload 2 (variable length)             │
├─────────────────────────────────────────┤
│ ...                                     │
└─────────────────────────────────────────┘
```

## Magic Header

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 8 | Magic string: `"SAVESTATE"` |
| 8 | 1 | Format version (currently `1`) |
| 9 | 7 | Reserved (must be zeros) |

**Reader rule:** Reject unknown major versions (e.g., version 2+ when expecting 1.x).

## Manifest

JSON object with the following structure:

```json
{
  "formatVersion": 1,
  "created": "2026-03-04T12:00:00Z",
  "agentId": "agent-123",
  "encryption": {
    "algorithm": "AES-256-GCM",
    "keyDerivation": "Argon2id"
  },
  "payloads": [
    {
      "name": "personality",
      "contentType": "application/json",
      "byteLength": 1234,
      "sha256": "abc123..."
    },
    {
      "name": "memory",
      "contentType": "application/json",
      "byteLength": 5678,
      "sha256": "def456..."
    }
  ]
}
```

### Required Fields

- `formatVersion` (integer): Must be 1 for v1
- `created` (ISO 8601 timestamp): Export time
- `payloads` (array): At least one payload

### Payload Fields

Each payload must have:
- `name` (string): Identifier (personality, memory, history, config, tools)
- `contentType` (string): MIME type
- `byteLength` (integer): Size in bytes
- `sha256` (string): Hex-encoded hash for integrity

### Optional Fields

- `agentId` (string): Agent identifier
- `encryption` (object): Encryption metadata
- `description` (string): Human-readable description

## Payload Names

| Name | Description | Content-Type |
|------|-------------|--------------|
| personality | Agent personality/prompt | application/json |
| memory | Agent memory/state | application/json |
| history | Conversation history | application/json |
| config | Tool/API configuration | application/json |
| tools | Tool definitions | application/json |

## Compatibility Policy

1. **Major version** (x.0): Breaking changes - readers must reject
2. **Minor version** (1.x): Backward-compatible additions - readers may ignore unknown fields
3. **Patch version** (1.0.x): Bug fixes only

**Upgrade strategy:** Future versions may add new payload types. Readers should gracefully handle unknown payload names.

## Integrity Verification

1. Read manifest, verify `formatVersion` is supported
2. For each payload, verify `sha256` matches content
3. If encrypted, verify decryption succeeded (authentication tag)

## Example

See `test/fixtures/container-v1-minimal.json` for a minimal manifest example.
