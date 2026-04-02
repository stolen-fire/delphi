# Synthesis rules (engine logic)

Synthesis is performed by the engine, NOT by a subagent. The engine categorizes challenge-response pairs using structural markers. Do not apply judgment — check for marker presence.

## Core synthesis steps

### Step 1: Read all response files

Read every file in `{docket-path}/responses/round-{N}/`.

### Step 2: Categorize each challenge-response pair

For each challenge directed at a delegate, find the corresponding response and categorize using the challenge-response categorization rules at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md`.

### Step 3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables with categorization results.
Write to `{docket-path}/synthesis/round-{N}.md`.

### Step 4: Determine round outcome

- ALL settled (including with dissent): **ratified**
- ANY contested AND current round < max_rounds: **proceed to next round**
- ANY contested AND current round >= max_rounds:
  - `human_deferral: true`: **deferred**
  - `human_deferral: false`: **forced** (proposer's/participant's position wins)
- ANY vetoed: **vetoed**

## Verification coverage map (standard mode)

If a verification log exists at `{docket-path}/verification-log.md`:

1. Read the verification log
2. Read the latest synthesis or decision document
3. Identify all factual claims — statements that assert something about evidence, documents, dates, amounts, or events (NOT legal arguments or analytical conclusions)
4. Cross-reference each factual claim against the verification log
5. Append a coverage summary to the verification log:
   - Count of factual claims
   - Count verified (confirmed + refuted + inconclusive)
   - Count not checked
   - List each unchecked claim with its source reference
6. Append a brief verification coverage line to the synthesis output:

```
## Verification coverage
Factual claims: {N} | Verified: {M} ({confirmed} confirmed, {refuted} refuted, {inconclusive} inconclusive) | Not checked: {N-M}
```

## Citation coverage map (code review mode)

After all delegates complete, build a citation coverage map:

1. **Extract citations:** From ALL delegate output files (position, challenges, compliance report, responses), extract every `[CITE: filename, line]` and `[CITE: filename, line-range]` marker. Normalize filenames to match `code-under-review/` contents.

2. **Build coverage map:** For each file in `code-under-review/`, read the file and record its total line count. Mark each line as "cited" if any delegate's citation covers it (exact line or within a cited range).

3. **Identify gaps:** Find contiguous ranges of 10+ uncited lines in any file. These are coverage gaps — sections no delegate examined.

4. **Report gaps in synthesis:** For each coverage gap, add a row to the synthesis:

   | Point | Challenger | Issue | Status |
   |-------|-----------|-------|--------|
   | Lines {start}-{end} of {filename} | (none) | Coverage gap — no delegate cited these lines | Unreviewed |

5. **Output coverage stats:**
   ```
     Coverage: {N} files, {total_lines} lines, {cited_lines} cited ({pct}%), {gap_count} gaps ({gap_lines} uncited lines)
   ```

   If coverage is 100% (no gaps of 10+ lines):
   ```
     Coverage: {N} files, {total_lines} lines — full coverage
   ```

   Coverage gaps are reported honestly in the review output. The engine does NOT attempt to audit gaps itself — that is delegate work, not orchestrator work.

## Response completeness check

Before proceeding to synthesis, verify that every delegate in the challenge map produced a response file:

1. For each delegate that appears as a challenge target:
   - Check that `{docket-path}/responses/round-{N}/{role_name}.md` exists
   - If missing: this delegate was challenged but did not respond

2. If ANY response files are missing:
   - Output warning: `  ⚠ Missing responses: {list of role names}`
   - Treat every challenge directed at a non-responding delegate as **Contested (unaddressed)**
   - Do NOT halt the deliberation — proceed to synthesis with contested markers

This check catches the failure mode where a delegate is incorrectly excluded from response routing — the downstream effect is contested points that force a Round 2, rather than silent premature settlement.
