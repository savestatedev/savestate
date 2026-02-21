# Issue: [Feature] Askable Echoes (Spec #94)

## Gap Analysis (Current vs MVP)

### Already in place
- `trace` schema/types exist with required core fields (`timestamp`, `run_id`, `adapter`, `event_type`, `payload`, optional `tags`) in `src/trace/types.ts`.
- Append-style local ledger exists (`.savestate/traces/index.json` + `runs/*.jsonl`) via `TraceStore.appendEvent` in `src/trace/store.ts`.
- SAF pack/unpack includes optional trace payload (`trace/index.json`, `trace/runs/*.jsonl`) in `src/format.ts`.
- Backward compatibility exists when trace is absent (`unpackTrace` returns `undefined`; tested in `src/trace/__tests__/format.test.ts`).
- CLI commands exist and are wired: `savestate trace list|show|export --format jsonl` (`src/commands/trace.ts`, `src/cli.ts`).
- One adapter path exists end-to-end for trace persistence in snapshot/restore: Clawdbot reads/writes trace ledger (`src/adapters/clawdbot.ts`) with tests in `src/adapters/__tests__/clawdbot-trace.test.ts`.
- Secret redaction defaults on in `TraceStore`; custom redaction hook supported (`redactionHook`).

### Gaps to close for acceptance confidence
1. **Schema + SAF versioning documentation is incomplete**
- Trace layout and schema are implemented but not documented in SAF docs/README/CONCEPT in a versioned way.
- `SAF_VERSION` remains `0.1.0` despite SAF structure expansion; explicit compatibility/versioning policy for optional `trace/` is not documented.

2. **“Capture” path is under-specified for adapter runtime events**
- Current adapter integration mostly snapshots/restores an existing local ledger.
- No explicit contract documenting where/how adapters emit `tool_call/tool_result/message/checkpoint/error` during live runs.

3. **End-to-end acceptance test coverage is partial**
- Existing tests cover store behavior, format packing, and Clawdbot extract/restore.
- Missing a single integration test that proves: capture event -> snapshot archive -> restore -> CLI export output.

4. **Auditability hardening is not explicit**
- Append semantics exist, but no documented tamper-evidence/integrity guarantees for local trace ledger.
- Runtime validation for malformed JSONL events/index is minimal.

## Prioritized Plan

### P0 (Required for MVP sign-off)
1. **Document trace schema + SAF embedding + versioning**
- Add a short “Askable Echoes / trace” SAF section (paths, JSONL format, required fields, schema version).
- Define SAF compatibility note for optional `trace/` presence.
- Decide and document whether `SAF_VERSION` changes for this addition; if unchanged, document why.

2. **Define adapter capture contract (MVP minimum)**
- Specify minimal adapter/runtime contract for writing events (event types, required fields, timestamp format, run/session id semantics).
- Clarify that confidence/assumptions/state-transition details are payload conventions where available.

3. **Add end-to-end validation scenario (at least one adapter)**
- Add integration test (Clawdbot path) proving:
  - event capture to local trace store,
  - inclusion in encrypted snapshot,
  - restoration back to local ledger,
  - export via trace API/command path as JSONL.

### P1 (Strongly recommended)
1. **Redaction policy clarity**
- Document default redaction behavior, opt-in raw-secret mode, and redaction-hook precedence.
- Add tests for hook behavior + edge key patterns to avoid accidental secret leakage.

2. **Robustness for malformed trace artifacts**
- Validate/guard corrupted `trace/index.json` or invalid run JSONL entries with actionable errors and non-breaking behavior where possible.

### P2 (Post-MVP hardening)
1. **Audit integrity enhancements**
- Evaluate hash-linking or signatures per run for tamper-evident trace chains.
- Decide whether local ledger requires integrity verification beyond SAF encryption boundary.

2. **Query UX improvements**
- Consider filters (`--run`, `--event-type`, `--tag`, time range) for audit workflows.

## Clarifying Questions
1. Should local `.savestate/traces` be plaintext (current) and only encrypted once inside `.saf.enc`, or must local trace-at-rest encryption also be in MVP?
2. Do we want to bump `SAF_VERSION` for optional `trace/` addition, or keep current version and formalize backward-compatible optional sections?
3. For “capture -> snapshot -> restore -> export,” is programmatic `TraceStore.appendEvent` acceptable as the capture source for MVP, or is adapter-runtime auto-instrumentation required?
4. Should confidence/assumption/state-transition payload keys be standardized now (e.g., `confidence`, `assumptions[]`, `state_transition`) or deferred?

STATUS: COMPLETE
