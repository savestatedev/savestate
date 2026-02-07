# SaveState GitHub Actions

Official GitHub Actions for backing up and restoring AI agent state in your CI/CD workflows.

## Actions

### `savestate/backup` 
Backup your AI agent's configuration and state before deployments.

### `savestate/restore`
Restore agent state from a snapshot (useful for rollbacks).

## Quick Start

### Backup Before Deploy

```yaml
name: Deploy with Backup

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Backup agent state before deploying
      - name: Backup Agent State
        uses: savestatedev/savestate/.github/actions/backup@main
        with:
          api-key: ${{ secrets.SAVESTATE_API_KEY }}
          snapshot-name: 'pre-deploy-${{ github.sha }}'
          agent-dir: './agent'
      
      # Your deploy steps here...
      - name: Deploy
        run: ./deploy.sh
```

### Scheduled Backups

```yaml
name: Nightly Backup

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Backup Agent State
        uses: savestatedev/savestate/.github/actions/backup@main
        with:
          api-key: ${{ secrets.SAVESTATE_API_KEY }}
          snapshot-name: 'nightly-${{ github.run_id }}'
```

### Restore on Rollback

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      snapshot-id:
        description: 'Snapshot ID to restore'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Restore Agent State
        uses: savestatedev/savestate/.github/actions/restore@main
        with:
          api-key: ${{ secrets.SAVESTATE_API_KEY }}
          snapshot-id: ${{ github.event.inputs.snapshot-id }}
```

## Inputs

### Backup Action

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ | - | Your SaveState API key |
| `snapshot-name` | ❌ | `ci-{sha}` | Name for the snapshot |
| `agent-dir` | ❌ | `.` | Path to agent config directory |
| `adapter` | ❌ | `auto` | Platform adapter (openclaw, claude, openai, cursor, windsurf) |

### Restore Action

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ | - | Your SaveState API key |
| `snapshot-id` | ❌ | `latest` | Snapshot ID to restore |
| `snapshot-name` | ❌ | - | Snapshot name (alternative to ID) |
| `agent-dir` | ❌ | `.` | Path to restore to |
| `adapter` | ❌ | `auto` | Platform adapter |

## Outputs

### Backup Action

| Output | Description |
|--------|-------------|
| `snapshot-name` | The label of the created snapshot |

### Restore Action

| Output | Description |
|--------|-------------|
| `restored-from` | The snapshot ID or "latest" that was restored |

## Setup

1. Get your API key from [savestate.dev/dashboard](https://savestate.dev/dashboard)
2. Add `SAVESTATE_API_KEY` to your repository secrets
3. Use the actions in your workflows

## Support

- 📖 [Documentation](https://savestate.dev/docs)
- 🐛 [Report Issues](https://github.com/savestatedev/savestate/issues)
- 💬 [Discord Community](https://discord.gg/savestate)
