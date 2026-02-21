# Spec for Issue #94: Askable Echoes

Source: SoulCrab promoted idea (ideas/promoted/askable-echoes.md, 2026-02-19).

## Goal
- Provide an auditable, queryable trace of agent execution beyond I/O: tool invocations/results, state transitions, confidence/assumptions (where available), errors, and checkpoints.
- Primary use-cases: debugging, compliance/audit, learning from runs, reproducibility.

## Scope (MVP)
- Define an append-only "echo" event stream format stored alongside snapshots (encrypted like everything else).
- Capture at minimum: timestamp, run/session id, adapter, event type (tool_call/tool_result/message/checkpoint/error), payload (JSON), and optional tags.
- CLI: `savestate trace list`, `savestate trace show <run>`, `savestate trace export --format jsonl` (names TBD).

## Acceptance criteria
- Schema + SAF versioning documented.
- Works for at least 1 adapter end-to-end (capture -> snapshot -> restore -> export).
- Backwards compatible: if no trace present, nothing breaks.

## Notes
- Must not log raw secrets unless user opts in; support redaction hooks.
