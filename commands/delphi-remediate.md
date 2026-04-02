---
description: Execute remediation plan from a code review docket, then re-review to verify
allowed-tools: Agent, Read, Write, Edit, Bash, Glob, Grep
argument-hint: '<docket-path> [--max-iterations N] [--skip-optional] [--dry-run]'
---

# /delphi-remediate

Execute a code review remediation plan — implement all fixes, then re-review to verify.

## Parse arguments

Examine `$ARGUMENTS`:

**Docket path (required):**
The first non-flag argument is the path to the docket directory (e.g., `.deliberation/dockets/20260401-221710-review-dashboard-tsx`).

- If the path does not exist, error: "Docket not found at {path}."
- If `{path}/docket.json` does not exist, error: "No docket.json found in {path}. Is this a delphi docket directory?"
- If `{path}/remediation/plan.md` does not exist, error: "No remediation plan found. Run /delphi-review first to generate one."

**Optional flags:**
- `--max-iterations N` — Maximum fix-review cycles. Default: 3. Must be a positive integer.
- `--skip-optional` — Skip optional-tier remediation items. Only fix critical + recommended.
- `--dry-run` — Parse and display the plan without making edits or running re-review.

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:

```
/delphi-remediate — Execute remediation plan and verify with re-review

Usage:
  /delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx
  /delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --max-iterations 5
  /delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --skip-optional
  /delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --dry-run

Input:   Docket directory from /delphi-review
Output:  Fixed source files + verification re-review docket
```

---

## Phase 0: Parse and validate

### Step 0.1: Read docket metadata

Read `{docket-path}/docket.json`. Extract:
- `review_target.paths` — the files that were reviewed (these will be re-reviewed)
- `review_target.conventions` — conventions file path, or null
- `composition` — composition YAML path, or null
- `tone` — tone name, or null
- `outcome` — must be `"findings"` (if `"clean"`, exit: "This docket has no findings. Nothing to remediate.")
- `remediation.critical` — count of critical items
- `remediation.recommended` — count of recommended items
- `remediation.optional` — count of optional items

### Step 0.2: Read remediation plan

Read `{docket-path}/remediation/plan.md`. Parse the markdown into a structured item list.

**Parsing rules:**
- **Lint findings section** (`## Lint findings`): Skip — these are input context, not actionable items. Lint violations are addressed by the categorized items below.
- **Critical section** (`## Critical (must fix)`): Each `### N. {title}` is an item with priority `critical`.
- **Component replacements section** (`## Component replacements (Cartographer)`): Each entry that says "See Critical item #N" is a cross-reference — skip it, the critical item handles the fix. Only parse entries with independent actions.
- **Recommended section** (`## Recommended (should fix)`): Each `### N. {title}` is an item with priority `recommended`.
- **Optional section** (`## Optional (consider)`): Each `### N. {title}` is an item with priority `optional`.

For each item, extract:
- `id`: the sequential number within its priority tier
- `priority`: critical | recommended | optional
- `title`: the heading text
- `file`: from the **File:** field
- `lines`: from the **Lines:** field
- `action`: from the **Action:** field — this is the instruction you will follow to implement the fix
- `finding`: from the **Finding:** field

### Step 0.3: Apply filters

If `--skip-optional` is set, remove all items with priority `optional`.

Count remaining items by tier.

### Step 0.4: Output summary

Output: `Remediation: {N} critical, {M} recommended, {K} optional items from {docket-name}`

If `--dry-run`, output each item as:

```
  [{priority}] #{id}: {title}
    File: {file}
    Action: {action (first 120 chars)}...
```

Then exit: "Dry run complete. No files were modified."

---

## Phase 1: Execute fixes

Output: `  Iteration {current} of {max_iterations}`

Walk items in order: all critical items first, then recommended, then optional (if not skipped).

For each item:

### Step 1.1: Read current file state

Read the target file(s) listed in the item's `file` field. If multiple files are listed (e.g., `Dashboard.tsx` + `Dashboard.module.css`), read all of them.

### Step 1.2: Check if already resolved

If the code described in the `finding` field no longer exists in the file (because a prior item's fix already eliminated it), output:
`  [{priority}] #{id}: {title}... already resolved, skipping`
and move to the next item.

### Step 1.3: Implement the fix

Follow the `action` field as an implementation instruction. The action contains:
- Specific code to replace (e.g., "Replace `<button className={styles.dangerBtn}>` with `<Button danger size="small">`")
- Import changes (e.g., "Add `DatePicker` to antd imports")
- CSS deletions (e.g., "Delete `.dangerBtn` and `.dangerBtn:hover` CSS blocks entirely")
- Multi-file coordination (e.g., "Delete CSS class" + "Remove className reference in TSX")

Use the Edit tool to make targeted changes. Read the file first, identify the exact code to change, and apply the edit.

**Line number adjustment:** The `lines` field reflects line numbers from the ORIGINAL file at review time. After prior edits, line numbers will have shifted. Always read the current file and locate the code by content matching, not by line number alone.

### Step 1.4: Output progress

Output: `  [{priority}] #{id}: {title}... done`

---

## Phase 2: Re-review

Output: `  Running re-review...`

After all items are implemented, run a full code review on the same files with the same parameters.

### Step 2.1: Assemble review context

Read all files from `review_target.paths` (from docket.json). These are the same files that were originally reviewed, now with fixes applied.

Assemble the review artifact using the same format as `/delphi-review`:

````
## Code under review

### File: {relative path}
```{language}
{current file contents — post-fix, FULL AND UNABRIDGED}
```
````

If conventions were provided (`review_target.conventions` is not null), read the conventions file.

### Step 2.2: Invoke the review engine

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **mode:** `code-review`
- **review_artifact:** the assembled code content (post-fix)
- **review_files:** `review_target.paths` from docket.json
- **review_type:** `files`
- **diff_ref:** null (this is a file review, not a diff)
- **conventions:** the conventions file path and contents (or null)
- **composition:** the composition YAML path (or null — read and parse it if present)
- **tone:** the tone name (or null)

The engine creates a new docket in `.deliberation/dockets/` and runs the full review pipeline: lint pre-phase, Cartographer, all delegates, synthesis, remediation plan.

### Step 2.3: Output result

Output: `  Re-review: {new-docket-name}`

---

## Phase 3: Evaluate

Read the new docket's `{new-docket-path}/docket.json`.

### If outcome is "clean"

Output:

```
Remediation complete after {iteration_count} iteration(s). All findings resolved.
Final docket: .deliberation/dockets/{new-docket-name}/
```

Exit successfully.

### If outcome is "findings"

Read `{new-docket-path}/remediation/plan.md` to get the new findings count.

**If current iteration < max_iterations:**

Output: `  Re-review result: {total findings} findings remain`

Set the new docket path as the working docket. Loop back to Phase 0 Step 0.2 (read the new remediation plan) and continue to Phase 1 (execute fixes).

Output: `  Iteration {next} of {max_iterations}`

**If current iteration >= max_iterations:**

Output:

```
Max iterations ({max_iterations}) reached. {total findings} findings remain.
Remaining findings: .deliberation/dockets/{new-docket-name}/remediation/plan.md
```

Exit. The user decides what to do next.
