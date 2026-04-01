# Code Review Coverage Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three protocol gaps that caused Delphi code review to lose on recall (83%) to a vanilla single-agent review (89%), despite having 4 specialized delegates.

**Architecture:** Three changes to the code review protocol in the main engine skill:

1. **Full code, always.** The engine MUST embed FULL, UNABRIDGED source code in every dispatch prompt. NEVER abbreviate, truncate, or condense. Opus 4.6 has a 1M context window — a few hundred lines of source code is trivially small. Additionally, provide file paths to `code-under-review/` so delegates can re-read via Read tool for precise line-number verification. The root cause of the recall gap was the engine abbreviating code in dispatch prompts. This is a hard rule: any abbreviation or condensation of code under review is a protocol violation.

2. **Challengers review code independently before seeing the Advocate's position.** The Advocate's position is NOT included in the challenger's dispatch prompt. Instead, challengers receive the full code + a file path to the Advocate's position in the docket. They read the code, form their own assessment, THEN read the position and challenge it. This is structural enforcement — not an instruction to "read code first" while the position sits in the same prompt.

3. **Coverage verification before synthesis.** The engine builds a citation coverage map from all delegate outputs. Any file section with 10+ uncited lines is a coverage gap. Gaps are flagged in the synthesis output. This is detection — if delegates missed a section, the review reports it honestly rather than pretending full coverage.

**Tech Stack:** Pure Markdown skill files. No build, test, or lint. Verification is re-running `/delphi-review` against the same test fixtures and scoring against the violation manifest.

**Design constraint:** All delegates run on Opus 4.6 with 1M context. There is zero reason to condense, abbreviate, or summarize any input. Anything that reduces the fidelity of what delegates see is contributing to the very problem we are fixing.

---

### File map

| File | Action | Responsibility |
|------|--------|---------------|
| `skills/delphi/SKILL.md` | Modify lines 1246-1268 | Phase 0.5: add file paths to proposition (keep full code) |
| `skills/delphi/SKILL.md` | Modify lines 1286-1317 | Phase 1: add anti-abbreviation rule + file paths for Read tool |
| `skills/delphi/SKILL.md` | Modify lines 1327-1365 | Phase 2: Critic — structural independent review (position excluded from prompt) |
| `skills/delphi/SKILL.md` | Modify lines 1375-1424 | Phase 3: Maintainer — same structural independent review |
| `skills/delphi/SKILL.md` | Modify lines 1440-1465 | Phase 4: Enforcer — full code + coverage mandate |
| `skills/delphi/SKILL.md` | Insert after line 1570 | New Phase 6.1b: coverage verification (detection only) |
| `skills/code-review-deliberation/SKILL.md` | Modify lines 26-48 | Update dispatch contract + anti-abbreviation rule + coverage |

---

### Task 1: Add anti-abbreviation rule + file paths to proposition

The root cause of the recall gap was the engine abbreviating code when assembling dispatch prompts. Fix: add an explicit anti-abbreviation rule to the engine, and add file paths to the proposition so delegates can also use the Read tool to verify line numbers against `code-under-review/`. The proposition KEEPS the full embedded code — it does not get slimmed.

**Files:**
- Modify: `skills/delphi/SKILL.md:1246-1268`

- [ ] **Step 1: Replace Phase 0.5 proposition content**

Find this block (lines 1246-1268):

````markdown
### Step 0.5: Write proposition

Write `{docket-path}/proposition.md`:

```
# Code Review Proposition

**Review type:** {files | diff}
**Files:** {comma-separated list of file paths}
**Conventions:** {conventions file path, or "none"}

## Proposition

Review the following code for quality, correctness, maintainability, and
convention compliance. The Advocate will defend the implementation. The
Critic will challenge its correctness and robustness. The Maintainer will
evaluate its comprehensibility and modification safety.
{If conventions: "The Enforcer will audit against stated conventions."}

## Code under review

{review_artifact content — the assembled code/diff}
```
````

Replace with:

````markdown
### Step 0.5: Write proposition

Write `{docket-path}/proposition.md`:

```
# Code Review Proposition

**Review type:** {files | diff}
**Files:** {comma-separated list of file paths}
**Conventions:** {conventions file path, or "none"}
**Code snapshot:** `{docket-path}/code-under-review/`

## Proposition

Review the following code for quality, correctness, maintainability, and
convention compliance. The Advocate will defend the implementation. The
Critic will challenge its correctness and robustness. The Maintainer will
evaluate its comprehensibility and modification safety.
{If conventions: "The Enforcer will audit against stated conventions."}

## Files to review

{for each file in code-under-review/:}
- `{docket-path}/code-under-review/{filename}` (source: `{original-path}`)
{/for}

## Code under review

{review_artifact content — the assembled code/diff, FULL AND UNABRIDGED}
```

**Anti-abbreviation rule:** The code embedded above MUST be the COMPLETE, UNABRIDGED source of every file. The engine MUST NOT truncate, abbreviate, condense, summarize, or use `[...]` placeholders for any section. Every line of every file must appear exactly as it does in the source. Opus 4.6 has a 1M context window — there is no reason to abbreviate.

The `code-under-review/` file paths are also provided so delegates can use the Read tool to verify line numbers against the snapshot files.
````

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: add anti-abbreviation rule + file paths to proposition

Engine MUST embed FULL, UNABRIDGED code in proposition. NEVER truncate
or condense. Also provides file paths to code-under-review/ so delegates
can verify line numbers via Read tool."
```

---

### Task 2: Advocate dispatch — read files via Read tool

Update Phase 1 so the Advocate reads source files directly instead of relying on embedded code in the proposition.

**Files:**
- Modify: `skills/delphi/SKILL.md:1286-1317`

- [ ] **Step 1: Replace Phase 1.1 dispatch assembly**

Find this block (lines 1286-1317):

````markdown
### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the Advocate's dispatch prompt:

```
You are the Advocate in this code review.

## Your role
You read the code under review, understand what it does, and defend the
implementation choices. Argue like an engineering design doc — direct
assertions backed by evidence from the actual code.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Conventions
{if conventions provided: contents of conventions file}
{if no conventions: "No conventions file provided. Evaluate against general best practices."}

## Output format
Follow this template exactly:
{contents of position template}

Write "# Position: advocate" as your heading.

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/advocate.md

Do not write to any other path. Do not output anything else.
```
````

Replace with:

````markdown
### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the Advocate's dispatch prompt:

```
You are the Advocate in this code review.

## Your role
You read the code under review, understand what it does, and defend the
implementation choices. Argue like an engineering design doc — direct
assertions backed by evidence from the actual code.

{if composition provides custom advocate prompt:}
{composition advocate prompt}
{/if}

[TONE BLOCK]

## Review context
{contents of proposition.md — contains review metadata, file list, AND full unabridged code}

## Line number verification
The code is embedded above in the proposition. You may also use the Read
tool on the files in `code-under-review/` to verify line numbers. Your
[CITE: filename, line] markers must reference the actual source line numbers.

{if conventions provided:}
## Conventions
{contents of conventions file — FULL, not a path}
{/if}

## Output format
Follow this template exactly:
{contents of position template}

Write "# Position: advocate" as your heading.

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/advocate.md

Do not write to any other path. Do not output anything else.
```
````

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: Advocate reads source files via Read tool

Instead of reading code embedded in proposition.md, the Advocate
now reads files from code-under-review/ via the Read tool."
```

---

### Task 3: Critic dispatch — independent code review before challenging

The critical change: challengers currently only see the code through the Advocate's lens. The Critic now reads the code independently FIRST, forms its own assessment, then reads and challenges the Advocate's position.

**Files:**
- Modify: `skills/delphi/SKILL.md:1327-1365`

- [ ] **Step 1: Replace Phase 2.1 dispatch assembly**

Find this block (lines 1327-1365):

````markdown
## Review Phase 2: Critic challenge

Output progress: `  Critic challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

Assemble the Critic's dispatch prompt:

```
You are the Critic in this code review. Your capability is challenge_all.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: advocate"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

Note: In code review mode, adapt the template sections to code concerns:
- "Weakest claim" → the least-supported defense of a code choice
- "Untested assumption" → an assumption about correctness, performance, or behavior
- "Failure scenario" → a concrete scenario where this code breaks

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-critic.md

Do not write to any other path. Do not output anything else.
```
````

Replace with:

````markdown
## Review Phase 2: Critic challenge

Output progress: `  Critic challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

Assemble the Critic's dispatch prompt:

```
You are the Critic in this code review. Your capability is challenge_all.

{if composition provides custom critic prompt:}
{composition critic prompt}
{/if}

[TONE BLOCK]

## Review context
{contents of proposition.md — contains review metadata, file list, AND full unabridged code}

{if this delegate has grounding:}
## Grounding
{contents of grounding file — FULL}
{/if}

## Independent code review

Read the code above. Form your OWN assessment of violations and weaknesses
BEFORE reading the Advocate's position. Then use the Read tool to read
the Advocate's position from the docket:

  Read: `{docket-path}/positions/round-1/advocate.md`

Challenge it — paying special attention to violations or concerns the
Advocate MISSED, MINIMIZED, or MISCHARACTERIZED.

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: advocate"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

Note: In code review mode, adapt the template sections to code concerns:
- "Weakest claim" → the least-supported defense of a code choice
- "Untested assumption" → an assumption about correctness, performance, or behavior
- "Failure scenario" → a concrete scenario where this code breaks

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-critic.md

Do not write to any other path. Do not output anything else.
```
````

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: Critic reads code independently before challenging

Critic now reads source files via Read tool and forms independent
assessment BEFORE reading the Advocate's position. Finds violations
the Advocate missed, not just weaknesses in the Advocate's claims."
```

---

### Task 4: Maintainer dispatch — same independent review pattern

Apply the same independent-review-first pattern to the Maintainer.

**Files:**
- Modify: `skills/delphi/SKILL.md:1375-1424`

- [ ] **Step 1: Replace Phase 3.1 dispatch assembly**

Find this block (lines 1375-1424):

````markdown
## Review Phase 3: Maintainer challenge

Output progress: `  Maintainer challenge...`

### Step 3.1: Assemble dispatch package

Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

**Anti-anchoring: Do NOT read or include the Critic's challenges.**

Assemble the Maintainer's dispatch prompt:

```
You are the Maintainer in this code review. You read code as someone who
will inherit it in 6 months with no access to the original author.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

## Output format
Structure your challenges under this exact header:

## Challenges to: advocate

### Naming and clarity
[Are names self-documenting? Flag anything that requires reading the body
to understand the name.]

### Abstraction quality
[Are abstractions justified? Is there unnecessary indirection or missing
extraction?]

### Modification safety
[What would you be afraid to touch? Where are hidden coupling points?]

### Missing context
[What would a new developer need to know that isn't in the code?]

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-maintainer.md

Do not write to any other path. Do not output anything else.
```
````

Replace with:

````markdown
## Review Phase 3: Maintainer challenge

Output progress: `  Maintainer challenge...`

### Step 3.1: Assemble dispatch package

Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

**Anti-anchoring: Do NOT read or include the Critic's challenges.**

Assemble the Maintainer's dispatch prompt:

```
You are the Maintainer in this code review. You read code as someone who
will inherit it in 6 months with no access to the original author.

{if composition provides custom maintainer prompt:}
{composition maintainer prompt}
{/if}

[TONE BLOCK]

## Review context
{contents of proposition.md — contains review metadata, file list, AND full unabridged code}

## Read as a new maintainer

Read the code above as someone who will own it in 6 months. Note what
confuses you, what you'd be afraid to touch, and what context is missing.

Then use the Read tool to read the Advocate's position from the docket:

  Read: `{docket-path}/positions/round-1/advocate.md`

Challenge it based on your independent reading.

## Output format
Structure your challenges under this exact header:

## Challenges to: advocate

### Naming and clarity
[Are names self-documenting? Flag anything that requires reading the body
to understand the name.]

### Abstraction quality
[Are abstractions justified? Is there unnecessary indirection or missing
extraction?]

### Modification safety
[What would you be afraid to touch? Where are hidden coupling points?]

### Missing context
[What would a new developer need to know that isn't in the code?]

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-maintainer.md

Do not write to any other path. Do not output anything else.
```
````

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: Maintainer reads code independently before challenging

Same pattern as Critic: reads source files via Read tool, forms
independent assessment, then challenges the Advocate's position."
```

---

### Task 5: Enforcer dispatch — file reading + coverage mandate

The biggest recall fix. The Enforcer currently receives code embedded in the dispatch prompt, but the engine abbreviates it. Fix: embed the FULL, UNABRIDGED code (same anti-abbreviation rule) plus an explicit coverage mandate requiring citations spanning every section of every file.

**Files:**
- Modify: `skills/delphi/SKILL.md:1434-1465`

- [ ] **Step 1: Replace Phase 4.1 dispatch assembly**

Find this block (lines 1434-1465):

````markdown
## Review Phase 4: Enforcer compliance report (conditional)

**Skip this phase entirely if no conventions were provided.**

Output progress: `  Enforcer compliance check...`

### Step 4.1: Assemble dispatch package

Read the compliance report template from `${CLAUDE_PLUGIN_ROOT}/templates/compliance-report.md`.

Assemble the Enforcer's dispatch prompt:

```
You are the Enforcer in this code review. You audit code against conventions.

[TONE BLOCK]

## Code under review
{review_artifact content — the assembled code/diff}

## Conventions to enforce
{contents of conventions file}

## Output format
Follow this template exactly:
{contents of compliance report template}

## CRITICAL: Write your output to this exact file path
Write your complete compliance report to: {docket-path}/compliance/enforcer-report.md

Do not write to any other path. Do not output anything else.
```
````

Replace with:

````markdown
## Review Phase 4: Enforcer compliance report (conditional)

**Skip this phase entirely if no conventions were provided.**

Output progress: `  Enforcer compliance check...`

### Step 4.1: Assemble dispatch package

Read the compliance report template from `${CLAUDE_PLUGIN_ROOT}/templates/compliance-report.md`.

Assemble the Enforcer's dispatch prompt:

```
You are the Enforcer in this code review. You audit code against conventions.

{if composition provides custom enforcer prompt:}
{composition enforcer prompt}
{/if}

[TONE BLOCK]

## Code under review

{review_artifact content — FULL AND UNABRIDGED, every line of every file}

## Files for line-number verification

You may also use the Read tool on these snapshot files to verify line numbers:
{for each file in code-under-review/:}
- `{docket-path}/code-under-review/{filename}`
{/for}

## Coverage mandate

Your compliance report MUST demonstrate coverage of every file section.
For each convention, cite specific [CITE: filename, line] markers.

CRITICAL: Check every line range of every file. If a file has 75 lines,
you must have citations spanning from the top to the bottom — not just
the first 50 lines. Convention violations in the last third of a file
are just as important as violations in the first third.

In the "Failed conventions summary" table, every failure MUST cite the
specific file and line number. Vague findings without line references are
audit failures.

## Conventions to enforce

{contents of conventions file — FULL}

## Output format
Follow this template exactly:
{contents of compliance report template}

## CRITICAL: Write your output to this exact file path
Write your complete compliance report to: {docket-path}/compliance/enforcer-report.md

Do not write to any other path. Do not output anything else.
```
````

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: Enforcer reads files via Read tool + coverage mandate

Enforcer now reads source files directly instead of from embedded
prompt content. Adds explicit coverage mandate requiring citations
spanning every section of every file, not just the first N lines."
```

---

### Task 6: Add coverage verification step to synthesis

New engine step between reading delegate outputs and categorizing challenge-response pairs. The engine builds a citation coverage map and REPORTS gaps — detection only. The engine does not attempt to audit gaps itself (it's an orchestrator, not a convention expert).

**Files:**
- Modify: `skills/delphi/SKILL.md` — insert after current Step 6.1 (line ~1570)

- [ ] **Step 1: Insert Step 6.1b after the existing Step 6.1**

Find this block (around lines 1564-1570):

```markdown
### Step 6.1: Read all files

Read `{docket-path}/responses/round-1/advocate.md`.
If Enforcer ran: read `{docket-path}/compliance/enforcer-report.md`.

### Step 6.2: Categorize challenge-response pairs
```

Insert between Step 6.1 and Step 6.2:

```markdown
### Step 6.1b: Verify citation coverage

Build a citation coverage map to catch file sections that all delegates skipped.

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

   If coverage is 100% (no gaps of 10+ lines), output:
   ```
     Coverage: {N} files, {total_lines} lines — full coverage
   ```

   Coverage gaps are reported honestly in the review output. The engine does NOT attempt to audit gaps itself — that is delegate work, not orchestrator work. If gaps exist, the review output says so and the user decides whether to re-run.
```

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: add coverage verification step to code review synthesis

Engine builds a citation coverage map after all delegates complete.
Gaps of 10+ uncited lines are reported in the synthesis. Detection
only — engine reports honestly, does not attempt self-audit."
```

---

### Task 7: Update protocol reference

Update the code-review-deliberation protocol reference to document the new dispatch contract and coverage verification.

**Files:**
- Modify: `skills/code-review-deliberation/SKILL.md:26-48`

- [ ] **Step 1: Replace dispatch contract table and rules**

Find this block (lines 26-48):

```markdown
## Delegate dispatch rules

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Code + conventions | Position defending the code |
| `challenger` | Challenge | Code + participant position | `## Challenges to: advocate` |
| `auditor` | Independent | Code + grounding file | Compliance report |

### Sequential dispatch order (quick-path)

1. Advocate (participant) — reads code, writes position
2. Critic (challenger) — reads code + advocate position, writes challenges
3. Maintainer (challenger) — reads code + advocate position (NOT critic), writes challenges
4. Enforcer (auditor, conditional) — reads code + conventions, writes compliance report
5. Advocate (participant) — responds to Critic + Maintainer challenges
6. Engine — synthesis + remediation plan

### Anti-anchoring

- Critic and Maintainer each read the Advocate's position independently
- Neither challenger reads the other's challenges
- Enforcer reads only the code and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal
```

Replace with:

```markdown
## Delegate dispatch rules

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | File paths (reads via Read tool) + conventions | Position defending the code |
| `challenger` | Challenge | File paths (reads via Read tool) + participant position | `## Challenges to: advocate` |
| `auditor` | Independent | File paths (reads via Read tool) + grounding file | Compliance report |

All delegates read source files from `{docket-path}/code-under-review/` using the Read tool. Code is NEVER embedded in dispatch prompts. This ensures identical line numbers across all delegates and eliminates truncation.

### Sequential dispatch order (quick-path)

1. Advocate (participant) — reads files via Read tool, writes position
2. Critic (challenger) — reads files independently, THEN reads advocate position, writes challenges
3. Maintainer (challenger) — reads files independently, THEN reads advocate position (NOT critic), writes challenges
4. Enforcer (auditor, conditional) — reads files via Read tool + conventions, writes compliance report with coverage mandate
5. Advocate (participant) — responds to Critic + Maintainer challenges
6. Engine — coverage verification + synthesis + remediation plan

### Anti-anchoring

- Challengers read source files and form independent assessments BEFORE reading the Advocate's position
- Neither challenger reads the other's challenges
- Enforcer reads only the files and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal

### Coverage verification

After all delegates complete, the engine builds a citation coverage map. Any contiguous range of 10+ lines with zero citations from any delegate is a coverage gap. The engine scans gaps against conventions and adds findings to the synthesis. This prevents the failure mode where all delegates skip the same file section.

### Enforcer coverage mandate

The Enforcer must cite findings (pass, fail, or N/A) spanning every section of every reviewed file. Coverage that drops off partway through a file is an audit failure. The dispatch prompt explicitly instructs: "Check every line range of every file."
```

- [ ] **Step 2: Commit**

```bash
git add skills/code-review-deliberation/SKILL.md
git commit -m "docs: update protocol reference for file-reading + coverage

Documents new dispatch contract: delegates read files via Read tool,
challengers do independent review first, Enforcer has coverage mandate,
engine runs coverage verification before synthesis."
```

---

### Task 8: Verify — re-run review and score

Re-run `/delphi-review` against the same test fixtures and score against the violation manifest to measure improvement.

**Files:**
- Test fixtures: `src/components/Dashboard.tsx`, `src/components/Dashboard.module.css`
- Composition: `compositions/antd-design-review.yml`
- Conventions: `.docs/antd-v6-conventions.md`
- Scoring reference: `.deliberation/dockets/20260331-191253-review-dashboard-tsx/scorecard.md`

- [ ] **Step 1: Run the review with updated protocol**

```
/delphi-review --config compositions/antd-design-review.yml --conventions .docs/antd-v6-conventions.md src/components/Dashboard.tsx src/components/Dashboard.module.css
```

- [ ] **Step 2: Score against manifest**

Compare the new docket's delegate outputs against the 46-violation manifest. Target:
- TSX recall: 30/30 (was 29/30)
- CSS recall: 16/16 (was 9-13/16)
- Total: 46/46 (was 38-42/46)
- Higher-order findings: >= 15 (was 15)
- Coverage gaps: 0 (was: Enforcer skipped CSS lines 50-74)

- [ ] **Step 3: Write comparison scorecard**

Save to `.deliberation/dockets/{new-docket}/scorecard-v2.md` with side-by-side comparison against v1 and vanilla CC.
