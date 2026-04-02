# Design Spec: `/delphi-remediate` — Remediation Executor

**Date:** 2026-04-02
**Status:** Approved
**Origin:** Testing `/delphi-review` against Ant Design benchmark (Steinle research). The review produces an actionable remediation plan, but executing it is manual. This command closes the loop — fix everything, then prove correctness with a full re-review.

---

## Problem

`/delphi-review` produces a prioritized remediation plan with exact file paths, line numbers, and fix actions. Today, implementing those fixes is a manual process — the user reads the plan, tells CC what to fix, and optionally re-runs the review. This gap means:

1. Fixes happen piecemeal and may be incomplete
2. There is no automated verification that all findings were resolved
3. New issues introduced by fixes are not caught until someone manually re-reviews

## Solution

A new command, `/delphi:delphi-remediate`, that reads a docket's remediation plan, implements all fixes sequentially, then runs a full `/delphi-review` to verify. If the re-review finds new issues, it loops — fix and re-review until clean or max iterations reached.

## Command Interface

**Command file:** `commands/delphi-remediate.md`
**Argument:** `<docket-path>` — path to the docket directory

**Optional flags:**
- `--max-iterations N` — safety valve, default 3
- `--skip-optional` — fix only critical + recommended items, skip optional tier
- `--dry-run` — parse and display the plan without making edits

**Examples:**
```
/delphi:delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx
/delphi:delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --max-iterations 5
/delphi:delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --skip-optional
/delphi:delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --dry-run
```

## Execution Flow

### Phase 0: Parse and validate

1. Read `{docket-path}/docket.json` — extract review metadata:
   - `review_target.paths` — files to re-review
   - `review_target.conventions` — conventions file path (or null)
   - `composition` — composition YAML path (or null)
   - `tone` — tone name (or null)
2. Read `{docket-path}/remediation/plan.md` — parse into structured items:
   - Each item: `{ id, priority, file, lines, action, finding, source }`
   - Priority tiers: critical, recommended, optional
3. Validate:
   - Docket directory exists
   - `docket.json` exists and has `mode: "code-review"`
   - `remediation/plan.md` exists and contains at least one item
   - If any validation fails, exit with a descriptive error message
4. Output: `Remediation: {N} critical, {M} recommended, {K} optional items from {docket-name}`

### Phase 1: Execute fixes

Walk items in priority order: critical → recommended → optional.
If `--skip-optional` is set, stop after recommended.

For each item:
1. Read the target file(s) at their current state
2. Implement the fix described in the item's Action field
3. If the item spans multiple files (e.g., delete CSS class + remove reference in TSX), edit both
4. Output progress: `  [{priority}] #{id}: {short description}... done`

The engine (CC) implements fixes directly — no subagents. The remediation plan's Action field contains specific enough instructions (exact component replacements, import changes, CSS deletions) for the engine to execute.

If an item's target lines have already been modified by a prior item (overlap), the engine reads the current file state and adapts. If the fix is already resolved (e.g., a prior replacement eliminated the issue), skip with: `  [{priority}] #{id}: {short description}... already resolved, skipping`

### Phase 2: Re-review

After all items are executed:
1. Invoke the review engine with the same parameters from `docket.json`:
   - Same file paths
   - Same composition (if present)
   - Same conventions (if present)
   - Same tone (if present)
2. This is a full `/delphi-review` — lint pre-phase, Cartographer, all delegates, synthesis, remediation plan
3. A new docket is created in `.deliberation/dockets/`
4. Output: `  Re-review: {new-docket-name}`

### Phase 3: Evaluate

Read the new docket's `docket.json`:

- If `outcome: "clean"` → exit successfully
  - Output: `Remediation complete after {N} iteration(s). All findings resolved.`
  - Output: `Final docket: .deliberation/dockets/{new-docket-name}/`

- If `outcome: "findings"` → check iteration count
  - If under `--max-iterations`: loop back to Phase 1 with the new remediation plan
    - Output: `  Re-review result: {M} findings remain`
    - Output: `  Iteration {N+1} of {max}`
  - If at max: stop and report
    - Output: `Max iterations ({max}) reached. {M} findings remain.`
    - Output: `Remaining findings: .deliberation/dockets/{new-docket-name}/remediation/plan.md`

### Progress Output Example

```
Remediation: 15 critical, 6 recommended, 3 optional from 20260401-221710-review-dashboard-tsx
  Iteration 1 of 3
  [critical] #1: Fix imports — remove internal paths... done
  [critical] #2: Replace StatCard with Card + Statistic... done
  [critical] #3: Replace progress bar with Progress... done
  ...
  [recommended] #1: Rename MetricCard/StatCard... done
  ...
  [optional] #1: Rename filterOpen to isFilterModalOpen... done
  ...
  Re-review: 20260401-223045-review-dashboard-tsx
  Re-review result: 2 findings remain

  Iteration 2 of 3
  [critical] #1: Fix token reference in Layout.Header... done
  [critical] #2: Add missing DatePicker import... done
  Re-review: 20260401-224112-review-dashboard-tsx
  Re-review result: clean

Remediation complete after 2 iterations. All findings resolved.
Final docket: .deliberation/dockets/20260401-224112-review-dashboard-tsx/
```

## Edge Cases

### Cross-file dependencies
Items are executed in plan order (critical first). The remediation plan already sequences items logically — import fixes before component replacements, TSX changes before CSS deletions. The engine reads current file state before each item, so natural ordering handles dependencies.

### Overlapping items
Some items touch the same lines (e.g., replacing StatCard eliminates the Typography.Title fix for the `<h3>` inside it). The engine reads the current file state before each item. If a prior fix already resolved the issue, the engine skips with a message.

### Re-review surfaces new findings
The re-review is adversarial from scratch. Fixes may introduce new issues (wrong import, incorrect prop usage). These become new remediation items in the next iteration. This is by design — the loop converges toward clean.

### Max iterations safety valve
Default 3. Prevents infinite loops where fixes keep introducing new issues. At max, the command stops and reports remaining findings. The user decides what to do next.

### Dry run
`--dry-run` parses the plan and outputs the item list with priorities and actions. No files are edited. No re-review runs.

## What This Command Does NOT Do

- **Does not commit.** The user reviews changes and commits when satisfied.
- **Does not run subagents for fixes.** The engine makes all edits directly for predictability.
- **Does not modify the original docket.** Each re-review creates a new docket. The chain of dockets is the audit trail.
- **Does not skip the full re-review.** Every iteration gets a complete adversarial review. No shortcuts.

## File Structure

One new file added to the plugin:

```
D:\Projects\delphi\
  commands\
    delphi.md              (existing)
    delphi-review.md       (existing)
    delphi-audit.md        (existing)
    delphi-remediate.md    (new)
```

No new agents, skills, protocols, or templates. The command reads existing docket structure and calls back into the review engine via `${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

## Future Optimizations (not in scope)

- **PostToolUse lint hook:** Real-time lint feedback during fix execution, so the engine self-corrects before moving to the next item
- **Grouped execution by file:** Batch all items for a single file into one editing pass
- **Subagent-per-file parallelism:** Dispatch file-level fix subagents in parallel for multi-file reviews
- **Targeted per-item verification:** Lightweight checks between items (re-run lint, grep for removed patterns) to catch regressions early without a full re-review
- **Integration with harmonia-pipeline:** Remediation as a pipeline step that triggers automatically after review
