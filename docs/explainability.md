# Retrieval Explainability: "Why This Memory?" Inspector

> **Transparency for AI Memory Retrieval**

SaveState now provides full transparency into why specific memories are selected during retrieval. No more "black box" — every decision is explainable.

## Quick Start

```bash
# Explain why a specific memory would be selected
savestate memory explain <memory-id>

# Explain with a specific query context
savestate memory explain <memory-id> --query "project deadline"

# Output formats
savestate memory explain <memory-id> --format human   # (default) Rich terminal output
savestate memory explain <memory-id> --format json    # Machine-readable JSON
savestate memory explain <memory-id> --format markdown # Documentation-friendly
```

## What You Get

### 1. Composite Score (0-100%)

A single number summarizing how likely this memory is to be retrieved. Higher scores mean higher priority in retrieval results.

### 2. Score Breakdown

Every factor contributing to the final score, with weights and explanations:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Relevance** | 40% | Content similarity to the query |
| **Recency** | 25% | How recent the memory is (exponential decay) |
| **Tier** | 15% | Memory tier boost (L1 > L2 > L3) |
| **Access** | 10% | Recent access frequency |
| **Pinned** | 10% | Manual pin status |

### 3. Source Trace

Where did this memory come from?

- **Origin Snapshot** — The snapshot where this memory first appeared
- **Adapter** — Which platform adapter captured it
- **Platform** — Source platform (ChatGPT, Claude, OpenClaw, etc.)
- **Source Type** — conversation, manual, import, or system
- **Snapshot Chain** — Full history of snapshots containing this memory

### 4. Policy Path

Which configuration rules affected this memory:

- **Tier Assignment** — Why it's in L1/L2/L3
- **Context Inclusion** — Whether it's included in agent context
- **Pin Protection** — If pinned, when and why
- **Age Warnings** — Approaching automatic demotion threshold
- **Promotion/Demotion History** — Manual tier changes

## Example Output

```
════════════════════════════════════════════════════════════════════════════════
🔍 Memory Retrieval Explanation
   ID: mem-abc123
════════════════════════════════════════════════════════════════════════════════

📊 Composite Score: 78%
🔑 Top factors: relevance and tier
📁 Tier: L1 📌 Pinned
📋 Active policies: tier-assignment, context-inclusion, pin-protection

────────────────────────────────────────────────────────────────────────────────
📊 SCORE BREAKDOWN
────────────────────────────────────────────────────────────────────────────────
  relevance    ████████░░ 85%  × 0.40 = 34%
               └─ Content similarity to query "project deadline": 85%
  recency      ██████░░░░ 62%  × 0.25 = 16%
               └─ Memory age: 5 days. Recency score: 62%
  tier         ██████████ 100% × 0.15 = 15%
               └─ Memory tier: L1. Short-term buffer (fastest access, included in context)
  access       ████████░░ 80%  × 0.10 =  8%
               └─ Last accessed: 2/25/2026, 3:45:00 PM
  pinned       ██████████ 100% × 0.10 = 10%
               └─ 📌 Pinned since 2/20/2026, 9:00:00 AM

  COMPOSITE    ████████░░ 78%

────────────────────────────────────────────────────────────────────────────────
🔗 SOURCE TRACE
────────────────────────────────────────────────────────────────────────────────
  Origin:    snap-initial-2026-01-15
  Created:   1/15/2026, 10:30:00 AM
  Adapter:   openclaw-adapter
  Platform:  openclaw
  Source:    conversation (conv-xyz789)
  Chain:     3 snapshots

────────────────────────────────────────────────────────────────────────────────
📋 POLICY PATH
────────────────────────────────────────────────────────────────────────────────
  ✅ tier-assignment (tier)
     └─ Assigned to tier L1 (Short-term buffer)
  ✅ context-inclusion (tier)
     └─ L1 memories are included in agent context by default
  🚀 pin-protection (pin)
     └─ Memory is pinned; protected from automatic demotion
        Applied: 2/20/2026, 9:00:00 AM

════════════════════════════════════════════════════════════════════════════════
```

## JSON Output

For programmatic access:

```json
{
  "memoryId": "mem-abc123",
  "compositeScore": 0.78,
  "scoreBreakdown": {
    "relevanceScore": 0.85,
    "recencyWeight": 0.62,
    "tierBoost": 1.0,
    "accessBoost": 0.8,
    "pinnedBoost": 1.0,
    "factors": [
      {
        "name": "relevance",
        "value": 0.85,
        "weight": 0.4,
        "contribution": 0.34,
        "explanation": "Content similarity to query \"project deadline\": 85%"
      }
      // ... additional factors
    ]
  },
  "sourceTrace": {
    "originSnapshotId": "snap-initial-2026-01-15",
    "originTimestamp": "2026-01-15T10:30:00.000Z",
    "adapter": "openclaw-adapter",
    "platform": "openclaw",
    "currentSnapshotId": "snap-current",
    "snapshotChain": ["snap-initial-2026-01-15", "snap-2026-02-01", "snap-current"],
    "sourceId": "conv-xyz789",
    "sourceType": "conversation"
  },
  "policyPath": [
    {
      "policyName": "tier-assignment",
      "ruleType": "tier",
      "action": "include",
      "reason": "Assigned to tier L1 (Short-term buffer)"
    }
  ],
  "summary": "📊 Composite Score: 78%\n🔑 Top factors: relevance and tier\n📁 Tier: L1 📌 Pinned"
}
```

## Scoring Algorithm

The composite score is calculated as a weighted sum:

```
score = (relevance × 0.40) + (recency × 0.25) + (tier × 0.15) + (access × 0.10) + (pinned × 0.10)
```

### Recency Decay

Recency uses exponential decay with approximately:
- **Today**: ~100%
- **7 days**: ~86%
- **30 days**: ~55%
- **90 days**: ~17%

### Tier Boosts

| Tier | Boost | Description |
|------|-------|-------------|
| L1 | 100% | Short-term buffer — current session |
| L2 | 70% | Working set — recent + pinned |
| L3 | 40% | Archive — searchable but not in context |

### Access Boost

| Last Access | Boost |
|-------------|-------|
| Today | 100% |
| < 7 days | 80% |
| < 30 days | 50% |
| > 30 days or never | 30% |

## Use Cases

### Debugging Retrieval Issues

```bash
# Why isn't this memory being retrieved?
savestate memory explain mem-important --query "my search query"
# → Shows low relevance score, explains why
```

### Auditing Memory Policies

```bash
# Why was this memory demoted?
savestate memory explain mem-old
# → Shows policy path with demotion history
```

### Understanding Memory Provenance

```bash
# Where did this memory come from?
savestate memory explain mem-mystery --include-trace
# → Full source trace with snapshot chain
```

## API Integration

The explainability system is also available programmatically:

```typescript
import { explainMemory, formatExplanationHuman } from '@savestate/cli';

const explanation = explainMemory(memoryEntry, snapshot, {
  query: 'search query',
  includeTraceHistory: true,
  format: 'json',
});

// Or format for display
console.log(formatExplanationHuman(explanation));
```

## Related Commands

- `savestate memory list` — List memories with tier information
- `savestate memory promote <id>` — Promote memory to higher tier
- `savestate memory demote <id>` — Demote memory to lower tier
- `savestate memory pin <id>` — Pin memory (prevent auto-demotion)
- `savestate search <query>` — Search across all snapshots

---

*Transparency builds trust. Every retrieval decision is now explainable.*
