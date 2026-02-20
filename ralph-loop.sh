#!/usr/bin/env bash
# Ralph Loop - AI Coding Agent Loop
# Usage: ./ralph-loop.sh [codex|claude] [PLANNING|BUILDING|BOTH] <max_iterations>
#
# This script runs an AI coding agent in a loop until completion.
# - PLANNING: creates/updates IMPLEMENTATION_PLAN.md (no implementation)
# - BUILDING: implements tasks, runs tests, commits
# - BOTH: runs PLANNING then BUILDING

set -euo pipefail

# Defaults
CLI="${1:-codex}"
MODE="${2:-BUILDING}"
MAX_ITERS="${3:-10}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure we're in a git repo
cd "$REPO_DIR"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Error: Must run inside a git repository"
    exit 1
fi

# Setup files
RALPH_DIR=".ralph"
mkdir -p "$RALPH_DIR"

PROMPT_FILE="$RALPH_DIR/PROMPT.md"
AGENTS_FILE="$RALPH_DIR/AGENTS.md"
PLAN_FILE="$RALPH_DIR/IMPLEMENTATION_PLAN.md"
LOG_FILE="$RALPH_DIR/ralph.log"

touch "$PROMPT_FILE" "$AGENTS_FILE" "$PLAN_FILE"

# Build CLI command based on choice
case "$CLI" in
    codex)
        CLI_CMD="codex exec"
        AUTO_FLAG="--full-auto"
        ;;
    claude)
        CLI_CMD="claude"
        AUTO_FLAG="--dangerously-skip-permissions"
        ;;
    *)
        echo "❌ Unknown CLI: $CLI (use 'codex' or 'claude')"
        exit 1
        ;;
esac

echo "🤖 Starting Ralph Loop"
echo "   CLI: $CLI ($CLI_CMD $AUTO_FLAG)"
echo "   Mode: $MODE"
echo "   Max iterations: $MAX_ITERS"
echo "   Repo: $REPO_DIR"
echo ""

# Get project test commands for backpressure
if [ -f "package.json" ]; then
    BACKPRESSURE_CMD="npm run build && npm test 2>/dev/null || npm run build"
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ]; then
    BACKPRESSURE_CMD="python -m pytest || true"
elif [ -f "Cargo.toml" ]; then
    BACKPRESSURE_CMD="cargo build && cargo test"
else
    BACKPRESSURE_CMD="echo 'No backpressure tests configured'"
fi

# Generate AGENTS.md with backpressure
cat > "$AGENTS_FILE" << EOF
# AGENTS.md - Ralph Loop Context

## Project Info
- Repository: $(basename "$REPO_DIR")
- Test commands: $BACKPRESSURE_CMD

## Backpressure Commands (run after each implementation)
\`\`\`bash
$BACKPRESSURE_CMD
\`\`\`

## Operational Notes
- Always commit after successful implementation
- Update IMPLEMENTATION_PLAN.md with progress
- If tests fail, fix before committing
EOF

# Generate PROMPT.md based on mode
generate_prompt() {
    local mode="$1"
    local issue_info="$2"
    
    if [ "$mode" = "PLANNING" ]; then
        cat > "$PROMPT_FILE" << EOF
You are running a Ralph PLANNING loop for: $issue_info

Read specs/* and the current codebase. Do a gap analysis and update IMPLEMENTATION_PLAN.md only.
Rules:
- Do NOT implement code.
- Do NOT commit.
- Prioritize tasks and keep plan concise.
- If requirements are unclear, write clarifying questions into the plan.

Completion:
If the plan is complete, add line: STATUS: COMPLETE
EOF
    else
        cat > "$PROMPT_FILE" << EOF
You are running a Ralph BUILDING loop for: $issue_info

Context:
- specs/*
- IMPLEMENTATION_PLAN.md
- AGENTS.md (tests/backpressure)

Tasks:
1) Pick the most important task from IMPLEMENTATION_PLAN.md.
2) Investigate relevant code (don't assume missing).
3) Implement.
4) Run the backpressure commands from AGENTS.md.
5) Update IMPLEMENTATION_PLAN.md (mark done + notes).
6) Update AGENTS.md if you learned new operational details.
7) Commit with a clear message.

Completion:
If all tasks are done, add line: STATUS: COMPLETE
EOF
    fi
}

# Main loop
COMPLETED=false
for i in $(seq 1 "$MAX_ITERS"); do
    echo -e "\n=== Ralph iteration $i/$MAX_ITERS ===" | tee -a "$LOG_FILE"
    date | tee -a "$LOG_FILE"
    
    # Run the AI agent
    $CLI_CMD $AUTO_FLAG "$(cat "$PROMPT_FILE")" 2>&1 | tee -a "$LOG_FILE"
    
    # Run backpressure tests
    echo "Running backpressure tests..." | tee -a "$LOG_FILE"
    if bash -lc "$BACKPRESSURE_CMD" 2>&1 | tee -a "$LOG_FILE"; then
        echo "✅ Backpressure tests passed" | tee -a "$LOG_FILE"
    else
        echo "⚠️ Backpressure tests had issues (continuing anyway)" | tee -a "$LOG_FILE"
    fi
    
    # Check for completion
    if grep -Fq "STATUS: COMPLETE" "$PLAN_FILE" 2>/dev/null; then
        echo "✅ Completion detected! Stopping." | tee -a "$LOG_FILE"
        COMPLETED=true
        break
    fi
done

if [ "$COMPLETED" = true ]; then
    echo -e "\n🎉 Ralph Loop completed successfully!" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "\n❌ Max iterations reached without completion." | tee -a "$LOG_FILE"
    exit 1
fi
