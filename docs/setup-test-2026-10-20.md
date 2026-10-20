# Setup test, 2026-10-20

New-user pass through the published install path. Sources followed:

- README quick start (`npm install -g @savestate/cli`, then init, snapshot, list, restore)
- https://savestate.dev/docs and the matching pages in this repo (`site/docs/index.html`, `site/developers.html`, `site/docs/mcp.html`)
- https://savestate.dev/llms.txt (`npm install -g @savestate/cli`, then `npx -y @savestate/cli mcp`)

Nothing was published, tagged, or merged.

## Environment

Clean Node, not the Node already on the machine:

- Official tarball `https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.xz`, unpacked under `/tmp/ss-clean/node-v22.23.3-linux-x64`
- `node -v` printed `v22.23.3`
- `npm -v` printed `10.9.9`
- `PATH` put that Node first, then `/usr/bin` and `/bin`
- No `~/.npmrc`, no `~/.savestate`, and no global `@savestate/cli` before the install
- Project commands used `HOME=/tmp/ss-clean/home2`
- The global install itself used `HOME=/tmp/ss-clean/home`, which also had no SaveState config
- Terminal size for the CLI commands was 120 columns by 40 rows, so the spinners could finish
- Passphrase was the documented example `your-passphrase`

The worked example is a Claude Code project that already contains `CLAUDE.md`. Before `init`, this file was created at `~/my-ai-workspace/CLAUDE.md`:

```markdown
# Workspace

This project is a Claude Code workspace used to try SaveState.

Preference: cocktail recommendations should mention the glass.
```

## Result lines

- Install `@savestate/cli` from npm: PASS
- `init`: PASS
- Save a snapshot: PASS
- `list` (in the same guide): PASS
- Restore that snapshot: PASS
- Connect the MCP server: PASS

## 1. Install

Command:

```bash
npm install -g @savestate/cli
```

Exit code 0. Output:

```text
added 229 packages in 6s

64 packages are looking for funding
  run `npm fund` for details
npm notice
npm notice New major version of npm available! 10.9.9 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
```

The binary landed at `/tmp/ss-clean/node-v22.23.3-linux-x64/bin/savestate`.

```bash
savestate --version
```

Exit code 0. Output: `0.9.0`

```bash
npx @savestate/cli --version
```

Exit code 0. Output included spinner frames, then `0.9.0`, then the same npm upgrade notice as the install.

Installed `package.json` description: `Time Machine for AI. Backup, restore, and migrate your AI identity.`

## 2. Init

```bash
export SAVESTATE_PASSPHRASE="your-passphrase"
npx @savestate/cli init
```

Run in `~/my-ai-workspace`. Exit code 0. Elapsed 0.646 seconds. Spinner frames were on the same lines as the status text. Visible text:

```text
⚡ SaveState [U+2014] Time Machine for AI

⠋ Initializing SaveState...✔ Created .savestate/ directory
⠋ Detecting platform...✔ Detected platform: Claude Code

  Your snapshots will be encrypted with a passphrase.
  You can also set SAVESTATE_PASSPHRASE env var.


✓ SaveState initialized!

  Next steps:
  savestate snapshot      Capture your first snapshot
  savestate config        Configure storage & adapters
  savestate adapters      See available platform adapters
```

The sample on the getting started page and on `/developers` shows the "Created .savestate/ directory" and "Detected platform: Claude Code" lines. Those lines did appear. The sample does not show the banner or the "Next steps" block. The banner still says Time Machine for AI. The character between SaveState and Time Machine for AI is U+2014. It is written as `[U+2014]` above so this log does not embed that character.

`~/my-ai-workspace/.savestate/config.json` was written. `storage.options.path` is the absolute home directory `~/.savestate` (`/tmp/ss-clean/home2/.savestate`). `passphraseConfigured` is true. The passphrase itself is not in the file. `defaultAdapter` is `claude-code`.

## 3. Snapshot

```bash
npx @savestate/cli snapshot --label first
```

Exit code 0. Elapsed 1.006 seconds. Visible text:

```text
⠋ Extracting state via Claude Code adapter...✔ Full snapshot created!

  ID:         ss-2026-10-20T13-43-36-6w3qby
  Adapter:    Claude Code
  Type:       full
  Label:      first
  Files:      9 files in archive
  Archive:    1.1 KB
  Encrypted:  1.2 KB
  Storage:    local
  Status:     ✓ Encrypted & stored

  Restore with: savestate restore ss-2026-10-20T13-43-36-6w3qby
```

The getting started sample shows `Files: 10 files in archive` and `Status: Encrypted & stored`. This run printed 9 files, `✓ Encrypted & stored`, plus archive size, encrypted size, and a restore command. The developers sample omits the file count and also omits the check mark on the status line.

Archive file, 1206 bytes:

`~/.savestate/ss-2026-10-20T13-43-36-6w3qby.saf.enc`

Project index: `~/my-ai-workspace/.savestate/index.json`. It points at that filename. The archive is not inside the project `.savestate/` directory.

## 4. List

```bash
npx @savestate/cli list
```

Exit code 0. Elapsed 0.695 seconds. Visible text:

```text
📋 Snapshots
   Storage: local

  ID                             Date                  Adapter      Label        Size
  ───────────────────────────────────────────────────────────────────────────────────
  ss-2026-10-20T13-43-36-6w3qby  Oct 20, 13:43         claude-code  first      1.2 KB

  1 snapshot
```

The getting started sample before this test used columns `ID`, `PLATFORM`, `SIZE`, `DATE` and an ISO date. The command prints `ID`, `Date`, `Adapter`, `Label`, `Size`, and a local time.

## 5. Restore

`CLAUDE.md` was edited so the preference line said the recommendations should be deleted from the file. Then:

```bash
npx @savestate/cli restore latest
```

Exit code 0. Elapsed 1.03 seconds. Visible text:

```text
🔄 Restoring from snapshot: latest

⠋ Retrieving and decrypting snapshot...✔ Restore complete!

  Snapshot:      ss-2026-10-20T13-43-36-6w3qby
  Timestamp:     2026-10-20T13:43:36.789Z
  Platform:      claude-code
  Adapter:       claude-code
  Label:         first
  Identity:      ✓ restored
  Memory:        0 entries restored
  Conversations: 0 indexed

  ✓ Your AI state has been restored.
  Existing files were backed up with .bak extension.
```

After restore, `CLAUDE.md` matched the file that was snapshotted. `CLAUDE.md.bak` held the edited text. The guide's claims about those two files are right.

The sample omits snapshot id, timestamp, platform, adapter, and label. It prints `Identity: restored` and `Your AI state has been restored.` without the check marks this run printed.

## 6. MCP

Docs used:

- `site/docs/mcp.html`: Claude Code block in `~/.claude/settings.json`, and the Cursor block in `~/.cursor/mcp.json`
- llms.txt: `npx -y @savestate/cli mcp`

Both config files were written exactly as those samples, including `SAVESTATE_MCP_PASSPHRASE` set to `your-passphrase-here` in the Claude Code file. Claude Code and Cursor are not installed here, so they were not restarted. The process those configs start was started directly.

```bash
npx -y @savestate/cli mcp
```

Working directory: `~/my-ai-workspace`. Environment included `SAVESTATE_MCP_PASSPHRASE=your-passphrase-here`.

For the first two seconds, stdout was empty. stderr was:

```text
SaveState MCP server running on stdio
```

A stdio client from `@modelcontextprotocol/sdk` `1.32.1` (the copy installed with `@savestate/cli@0.9.0`) then called `connect` and `listTools`. That succeeded.

`serverInfo` from the handshake:

```json
{"name":"savestate","version":"0.5.0"}
```

Tools returned, 4 names:

- `savestate_snapshot`
- `savestate_restore`
- `savestate_list`
- `savestate_status`

`site/docs/mcp.html` also lists `savestate_search_snapshots`, `savestate_stats`, the `savestate_memory_*` tools, and the OpenMemory-compatible names. Those names were not in this server's `tools/list` result. They are registered in the current repo source (`src/mcp/server.ts`). npm `0.9.0` does not expose them. The MCP page was left as it is, because it matches that source and `0.9.0` cannot be replaced until `0.9.1` is published.

## Names

Expected registry name: `io.github.savestatedev/memory`

| Where | Field | Value |
| --- | --- | --- |
| Repo `package.json` (`@savestate/cli` `0.9.1`) | `mcpName` | `io.github.savestatedev/memory` |
| Repo `server.json` | `name` | `io.github.savestatedev/memory` |
| Repo `site/server.json` | `name` | `io.github.savestatedev/memory` |
| Installed `@savestate/cli@0.9.0` `package.json` | `mcpName` | absent |
| `npm view @savestate/cli mcpName` | stdout | empty, exit code 0 |
| `npm view @savestate/cli@0.9.0 mcpName` | stdout | empty, exit code 0 |
| `npm view @savestate/cli version` | stdout | `0.9.0` |

`npm view @savestate/cli@0.9.0 --json` has no `mcpName` key. Latest version on npm is `0.9.0`. Versions listed stop at `0.9.0`.

The repo `mcpName` matches `server.json` `name`. No name edit was required. The published `0.9.0` package has no `mcpName`, and that tarball cannot be changed by a later edit. The repo field is already the expected name for a future `0.9.1` publish.

The connected `0.9.0` process reports `serverInfo.name` `savestate`, which is the runtime handshake name, not the `mcpName` field.

## What the docs got wrong

Fixed in this change, because the sentences disagreed with both the published CLI and the current source (`storage.options.path` defaults to `~/.savestate`):

- `site/docs/index.html` said local snapshots are stored under the project `.savestate/` directory and not in a home-directory vault. The archive from this run is `~/.savestate/<id>.saf.enc`. Project `.savestate/` holds `config.json` and `index.json`.
- `site/docs/index.html` list sample used columns `PLATFORM`, `SIZE`, and `DATE`. The command prints `Date`, `Adapter`, `Label`, and `Size`.
- `site/developers.html` said local archives stay in the project `.savestate/` directory.
- `site/docs/storage.html` said the default location is `~/.savestate/snapshots/`. `init` sets the path to `~/.savestate`, and the archive file is stored directly there. The storage page's config example already showed `"path": "~/.savestate"`.

Recorded above and not edited:

- Init, snapshot, and restore samples leave out lines the CLI prints (banner, next steps, sizes, restore hint, snapshot metadata, check marks).
- The snapshot sample's `10 files` and `Encrypted & stored` (no check mark) do not match this run (`9 files`, `✓ Encrypted & stored`).
- MCP tool list on the docs page is ahead of published `0.9.0`.
