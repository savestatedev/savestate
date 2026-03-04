# SaveState Container v1 (SSC/1)

This document defines the **SaveState Container v1** on-disk format — a deterministic, versioned, single-file container that packages one or more named payload blobs along with a JSON manifest.

This spec is intended to be the foundation for follow-on work (container writers/readers, `.saf.enc` encryption envelope, diffing, and future migrations).

> Naming
>
> - **SSC/1**: SaveState Container **major version 1**.
> - The container file is typically stored as `*.ssc` (unencrypted) or wrapped in an encryption envelope (e.g. `*.ssc.enc`).

---

## Goals

- **Deterministic exports**: same logical snapshot → identical byte layout (given identical payload bytes and manifest fields).
- **Self-describing**: manifest includes **content addressing** (sha256) + sizes for each payload.
- **Forward/backward compatibility**: clear rules for readers/writers across versions.
- **Streaming friendly**: payloads are stored as a single contiguous file; readers can seek to offsets.

## Non-goals

- Defining the schemas of adapter-specific payloads (that’s handled in separate specs).
- Defining encryption/KDF parameters (envelope spec; see “Encryption envelope” below).

---

## File overview

An SSC/1 file is:

```
+-------------------------------+
| Header (fixed size)           |
+-------------------------------+
| Manifest JSON (UTF-8 bytes)   |
+-------------------------------+
| Payload blob #1 (raw bytes)   |
+-------------------------------+
| Payload blob #2 (raw bytes)   |
+-------------------------------+
| ...                           |
+-------------------------------+
```

All multi-byte integers are **little-endian**.

---

## Header (SSC/1)

Fixed size: **48 bytes**.

| Offset | Size | Type | Name | Description |
|---:|---:|---|---|---|
| 0  | 8  | bytes | `magic` | ASCII `SSCNTRv1` |
| 8  | 2  | u16 | `major` | `1` |
| 10 | 2  | u16 | `minor` | `0` (additive, backwards compatible) |
| 12 | 4  | u32 | `manifestByteLength` | Byte length of the manifest section |
| 16 | 32 | bytes | `manifestSha256` | Raw 32-byte SHA-256 digest of the manifest bytes |

### Magic

`magic` MUST be exactly the 8-byte ASCII string:

```
SSCNTRv1
```

Readers MUST reject files with a different magic.

---

## Manifest (JSON)

Immediately after the header, the file contains `manifestByteLength` bytes of UTF-8 JSON.

- Writers SHOULD format JSON deterministically (e.g. `JSON.stringify(obj, null, 2) + "\n"`).
- Readers MUST verify `manifestSha256` matches the manifest byte sequence.

### Manifest schema (v1.0.0)

Top-level object:

```json
{
  "formatVersion": "1.0.0",
  "createdAt": "2026-03-04T23:06:00.000Z",
  "payloads": [
    {
      "name": "identity/personality.md",
      "contentType": "text/markdown",
      "byteLength": 29,
      "sha256": "...lowercase hex...",
      "offset": 690,
      "schemaVersion": "optional"
    }
  ],
  "meta": { "any": "json" }
}
```

#### Required fields

- `formatVersion` (string): MUST be `"1.0.0"` for SSC/1.
- `payloads` (array): list of payload manifest entries.

#### Optional fields

- `createdAt` (ISO-8601 string)
- `meta` (object): free-form metadata; readers MUST ignore unknown keys.

### Payload manifest entry

Each entry in `payloads` MUST include:

- `name` (string): stable identifier (recommended to use POSIX-style paths, e.g. `memory/core.json`).
- `contentType` (string): MIME-like content type.
- `byteLength` (number): byte length of the payload blob.
- `sha256` (string): lowercase hex SHA-256 of the payload blob.
- `offset` (number): byte offset from start of the file where the payload begins.

Optional:

- `schemaVersion` (string): payload schema version (implementation-defined).

### Offsets / layout rules

- Payload byte ranges MUST NOT overlap.
- Payload blobs SHOULD be stored **contiguously** in the same order as `payloads`.
- Writers SHOULD sort payloads by `name` for deterministic output.

---

## Compatibility policy

### Major/minor

- Readers MUST reject unknown `major` values.
- Readers SHOULD accept higher `minor` values **as long as** the header layout is unchanged and the reader can still parse required fields.

### Manifest `formatVersion`

- Readers MUST reject unknown **major** versions in `formatVersion` (e.g. `"2.0.0"`).
- Readers SHOULD accept unknown **minor/patch** versions of `formatVersion` if:
  - required fields are present, and
  - unknown fields are ignored.

### Unknown payloads

Readers MAY ignore payloads they don’t recognize, provided required payloads for the caller’s use-case are present.

---

## Integrity

SSC/1 provides integrity via:

- `manifestSha256`: detects manifest corruption/tampering.
- per-payload `sha256`: detects payload corruption/tampering.

> Note: If SSC/1 is wrapped in an authenticated encryption envelope (e.g. AES-GCM), the envelope additionally provides whole-file authentication.

---

## Encryption envelope (informative)

SSC/1 is designed to be wrapped by an encryption envelope such as:

```
<encrypted bytes> = Encrypt( <ssc bytes> )
```

Where encryption parameters (KDF, cipher, nonce, salt, etc.) are specified elsewhere.

---

## Minimal fixture

A minimal SSC/1 fixture is checked into the repo:

- `src/__tests__/fixtures/container-v1/minimal.ssc`
- `src/__tests__/fixtures/container-v1/minimal.manifest.json`

This fixture is used for regression tests to ensure future readers remain compatible.
