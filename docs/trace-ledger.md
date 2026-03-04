# Askable Echoes: Trace Ledger

SaveState can optionally capture an **append-only trace ledger** (“Askable Echoes”) for agent runs.

This is meant to be **auditable** and **queryable** beyond plain chat I/O: tool calls/results, checkpoints, errors, and other state transitions.

## On-disk format (local)

SaveState maintains a local trace store under:

- `~/.savestate/traces/`
  - `index.json` — run index
  - `runs/*.jsonl` — one JSONL file per run

Each JSONL line is a single `TraceEvent` object (JSON).

## Snapshot format (SAF)

When present, trace data is stored **inside the encrypted SAF archive** under:

- `trace/index.json`
- `trace/runs/*.jsonl`

If these files are missing, snapshots remain **backwards compatible** and restore works normally.

## Schema versioning

Trace files are versioned independently from the SAF container:

- SAF version: `manifest.json.version`
- Trace schema version: `trace/index.json.schema_version`

Current trace schema version is defined in code as `TRACE_SCHEMA_VERSION`.

## TraceEvent schema (v1)

Each event has the following fields:

```json
{
  "timestamp": "2026-02-21T10:00:00.000Z",
  "run_id": "run-123",
  "adapter": "clawdbot",
  "event_type": "tool_call",
  "payload": { "any": "json" },
  "tags": ["optional", "strings"]
}
```

- `timestamp` — ISO 8601
- `run_id` — run/session identifier
- `adapter` — adapter id (e.g. `clawdbot`)
- `event_type` — one of:
  - `tool_call`
  - `tool_result`
  - `message`
  - `checkpoint`
  - `error`
- `payload` — arbitrary JSON (implementation-defined per adapter/tooling)
- `tags` — optional list of strings

## Run index schema

`trace/index.json` stores an index of runs for quick listing:

```json
{
  "schema_version": 1,
  "runs": [
    {
      "run_id": "run-123",
      "adapter": "clawdbot",
      "file": "run-run-123.jsonl",
      "event_count": 42,
      "started_at": "2026-02-21T10:00:00.000Z",
      "updated_at": "2026-02-21T10:10:00.000Z",
      "tags": ["optional"]
    }
  ]
}
```

## Redaction / secrets

By default, SaveState applies a conservative redaction pass before persisting events (configurable in code via `TraceStore`):

- Keys matching common secret patterns (e.g. `token`, `api_key`, `authorization`, `passphrase`, `secret`) are replaced with `"[REDACTED]"`.
- Adapters may also provide a custom redaction hook.

**Important:** Do not log raw secrets into the trace unless you explicitly opt in.

## CLI

- `savestate trace list`
- `savestate trace show <run_id>`
- `savestate trace export [--run <id>] --format jsonl`
