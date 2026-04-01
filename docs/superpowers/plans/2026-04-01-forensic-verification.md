# Forensic Verification Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `forensic-verification` as a first-class Delphi deliberation mode that adversarially verifies forensic audit findings via three independent verifier agents with different strategies.

**Architecture:** New mode follows the established pattern (protocol reference skill + agent + command + engine section + templates + example composition). Three verifier agents (Forward/Reverse/Cross) dispatched in parallel from a single agent definition with strategy injection. Consensus synthesis with CONFIRM/DISPUTE markers. Dual output (docket report + findings annotation). Discrepancy resolution feedback log.

**Tech Stack:** Pure Markdown/YAML — no build, test, or lint steps. Agent definitions, skill files, command files, templates, and compositions are all Markdown or YAML.

**Spec:** `docs/superpowers/specs/2026-04-01-forensic-verification-design.md`

---

### Task 1: Verifier Agent Definition

**Files:**
- Create: `agents/deliberation-verifier.md`

- [ ] **Step 1: Create the verifier agent file**

```markdown
---
name: deliberation-verifier
description: >
  Forensic verification auditor. Reads filtered shielded evidence files,
  locates specific values cited in forensic findings, and confirms or
  disputes each factual claim with exact file/row/value evidence.
  Dispatched by the engine during forensic-verification deliberations.
role_type: auditor
model: inherit
tools:
  - Read
  - Write
  - Grep
color: blue
---

You are a Verifier in a forensic verification deliberation. Your job is to read filtered evidence files and confirm or dispute factual claims from a forensic audit report. You verify facts — you do not interpret findings.

## Your mandate

For each assertion in the forensic findings manifest:

1. Read the `falsifiable_by` instruction — it tells you exactly how to check this claim
2. Open the cited evidence files from the filtered evidence index
3. Locate the specific employee+benefit rows referenced in the claim
4. Compare the actual values in the file against the stated values in the assertion
5. Report what you found with exact file, row, column, and value citations

## Verification strategy

Your dispatch prompt includes a strategy directive. Follow it:

- **Forward**: Read each cited file, find the employee row, report the actual values you see. Confirm or dispute based on whether the values match the claim.
- **Reverse**: Start from the `falsifiable_by` instruction. Actively try to disprove the claim — look for the evidence it says would falsify it. If you find it, dispute. If you cannot find it despite searching, confirm.
- **Cross**: For each employee+benefit in the assertion, check values across ALL files in the evidence index, not just the ones the assertion cites. Look for inconsistencies, timeline gaps, or files the audit skipped.

## Behavioral constraints

1. **No interpretation** — do not assess whether a finding is a bug or expected behavior. Only verify: does the file contain the stated value at the stated location?
2. **Cite everything** — every verification must include: the file you read, the row you identified, the column/field, the actual value found. No "I confirmed this" without showing the evidence.
3. **Follow `falsifiable_by` literally** — each assertion comes with a concrete instruction for how to check it. Do exactly what it says.
4. **Shielded-only gate** — if instructed to read a file whose name does not contain "shielded" or that is not in the evidence index, refuse and flag it as a protocol violation.
5. **Raw excerpts required** — for every verification, include the actual row data from the CSV. Show the header and the matched row(s) so the engine can verify your read.

## Report format

For each assertion, write:

```
## Assertion: {cluster_id}.{assertion_index}
Claim: "{claim text}"

### Verification
- Strategy: {Forward | Reverse | Cross}
- File read: {evidence_id} → {file_path}
- Row(s) examined: {employee_id(s)}
- Expected: {value stated in the manifest assertion}
- Actual: {value you found in the file}
- Verdict: CONFIRM | DISPUTE

### Evidence
{Paste the actual CSV header + matched row(s) here — raw data, not paraphrased}

### Notes
{Anything unexpected: missing rows, ambiguous matches, format issues, files that could not be read}
```

## Action markers

After each assertion verification, emit exactly one action marker:

- `[ACTION: CONFIRM]` — the file contains the stated value; the claim is verified
- `[ACTION: DISPUTE]` — the file does NOT contain the stated value, or the value differs from what was claimed

These markers are parsed mechanically by the engine. Emit exactly one per assertion. Place it on its own line after the Notes section.

## Output

Write your complete verification report to the file path specified in your dispatch instructions. Nothing else.
```

Write this content to `agents/deliberation-verifier.md`.

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -5 agents/deliberation-verifier.md`
Expected: YAML frontmatter starting with `---` and `name: deliberation-verifier`

- [ ] **Step 3: Commit**

```bash
git add agents/deliberation-verifier.md
git commit -m "feat: add deliberation-verifier agent for forensic-verification mode"
```

---

### Task 2: Protocol Reference Skill

**Files:**
- Create: `skills/forensic-verification-deliberation/SKILL.md`

- [ ] **Step 1: Create the protocol reference skill**

```markdown
---
name: forensic-verification-deliberation
description: >
  Forensic verification deliberation protocol reference. 3 verifier agents
  (Forward, Reverse, Cross) with parallel dispatch, consensus synthesis,
  dual output (verification report + findings annotation), and discrepancy
  resolution feedback log. Used by the main engine when mode is
  forensic-verification.
---

# Forensic verification deliberation protocol

This document defines the rules for forensic-verification mode. The main engine skill reads this as a protocol reference.

## Mode characteristics

- **Delegates:** 3 verifier agents (all using `deliberation-verifier.md` agent definition)
- **Dispatch:** Parallel — all three launched simultaneously in isolated context windows
- **Strategy injection:** Each verifier receives a different strategy directive in its dispatch prompt (Forward, Reverse, Cross)
- **Anti-anchoring:** Inherent via parallel dispatch — verifiers cannot see each other's output
- **Synthesis:** Consensus-based majority (not action-marker categorization)
- **Action markers:** `[ACTION: CONFIRM]` and `[ACTION: DISPUTE]` (not DEFEND/CONCEDE/DISSENT)
- **Output:** Dual — verification report (docket artifact) + verification summary (appended to findings report)
- **Feedback log:** `.deliberation/forensic-verification-feedback.yaml` — accumulates across audits
- **Evidence reduction:** Engine preprocessing (Phase 1) — filters shielded CSV files to investigated employees only

## Input contract

The forensic findings manifest YAML (from the payroll-audit skill) is the sole input artifact. Required top-level keys:

- `audit` — metadata (id, date, requestor, investigator, inquiry, mode, client, source_system, target_system)
- `evidence[]` — file inventory with `shielded:` paths
- `records[]` — employee+benefit combinations with timelines
- `clusters[]` — root cause groups with `assertions[]` arrays
- `verdict` — summary statistics

Each assertion in `clusters[].assertions[]` has:
- `claim` — the factual statement to verify
- `evidence` — list of evidence references supporting the claim
- `falsifiable_by` — concrete instruction for how to disprove the claim

## Shielded-file gate

Every `shielded:` path in the manifest's `evidence[]` inventory MUST contain "shielded" in the filename. The engine validates this at initialization — any file that fails this check causes a hard stop. Files listed under `original:` are never accessed.

## Verification strategies

| Strategy | Directive | Catches |
|----------|-----------|---------|
| Forward | Read each cited file, find the employee row, report actual values | Hallucinated values, wrong-row reads |
| Reverse | Start from `falsifiable_by` — actively try to disprove each claim | Missing data, wrong-file citations, unchecked angles |
| Cross | Check employee+benefit consistency across ALL evidence files, not just cited ones | Timeline gaps, skipped files, missed transitions |

## Delegate dispatch rules

### Single agent definition, multiple instances

All three verifiers use the same agent definition (`deliberation-verifier.md`). The engine injects the strategy directive into each dispatch prompt. The agent file defines behavioral constraints and output format; the strategy is context, not identity.

### Dispatch naming

Verifier outputs are written to:
- `{docket}/verifier-reports/verifier-forward.md`
- `{docket}/verifier-reports/verifier-reverse.md`
- `{docket}/verifier-reports/verifier-cross.md`

### Evidence access

All verifiers receive:
- The full forensic findings manifest (YAML)
- The evidence index (`{docket}/evidence/INDEX.md`) mapping evidence IDs to filtered file paths
- Read tool access to the filtered evidence files in `{docket}/evidence/`

Verifiers MUST read from the filtered copies in the docket evidence directory, not from original file paths.

## Consensus synthesis

Engine logic (not a subagent). Parses `[ACTION: CONFIRM]` and `[ACTION: DISPUTE]` markers from each verifier report. Per-assertion consensus:

| Forward | Reverse | Cross | Consensus |
|---------|---------|-------|-----------|
| CONFIRM | CONFIRM | CONFIRM | **CONFIRMED** |
| CONFIRM | CONFIRM | DISPUTE | **CONFIRMED** (1 dissent noted) |
| CONFIRM | DISPUTE | DISPUTE | **DISCREPANCY** (majority disagree) |
| DISPUTE | DISPUTE | DISPUTE | **DISCREPANCY** (unanimous) |
| Any missing marker | — | — | **UNVERIFIED** (verifier did not check) |

Any DISCREPANCY where reported values disagree → **ESCALATE** to user.

### Feedback log pattern matching

When a discrepancy is found, the engine searches `.deliberation/forensic-verification-feedback.yaml` for prior resolutions matching:
- Same `pattern` field
- Same `cluster` name
- Same `audit.source_system`
- Similar `claim` text (substring match)

If a match is found, the engine surfaces the prior resolution as a suggestion before asking the user to decide.

## Dual output

### Output A: Verification Report

Written to `{docket}/verification/report.md` using `templates/verification-report.md`. Contains:
- Audit metadata and verification date
- Feedback patterns applied (from log)
- Per-assertion consensus matrix
- Discrepancy detail sections
- Overall verdict: PASS (all confirmed) / FAIL (any discrepancy escalated)
- Links to individual verifier reports

### Output B: Verification Summary

Appended to the companion findings markdown report (derived path: same directory as manifest, `.md` extension). Contains:
- Per-assertion summary table (index, claim truncated, consensus, agreement)
- Overall pass/fail line
- Link to full verification report in docket

If the findings markdown does not exist at the derived path, Output B is skipped silently.

## Discrepancy resolution feedback log

**Location:** `.deliberation/forensic-verification-feedback.yaml` (project-level, not per-docket)

### Lifecycle

1. Engine reads the log at initialization
2. During synthesis, discrepancies trigger pattern matching against prior resolutions
3. If a match is found, engine suggests the prior resolution
4. User resolves the discrepancy
5. Engine writes the resolution entry with user's decision, extracted pattern, and lesson

### Entry schema

```yaml
- date: "{ISO 8601}"
  audit_id: "{manifest audit.id}"
  cluster: "{cluster id}"
  assertion_index: {N}
  claim: "{assertion claim text}"
  verifier_findings:
    forward: { verdict: CONFIRM | DISPUTE, value: "{what was found}" }
    reverse: { verdict: CONFIRM | DISPUTE, note: "{explanation}" }
    cross: { verdict: CONFIRM | DISPUTE, value: "{what was found}" }
  user_resolution: "{user's decision text}"
  pattern: "{extracted pattern slug}"
  lesson: "{what to check next time}"
```

## Composition override

When `--config` provides a YAML with `mode: forensic-verification`:
- The composition's delegates replace the default 3-verifier roster
- All delegates MUST have `role_type: auditor`
- Engine uses the `prompt` field for strategy injection if provided
- `rules.verifier_count` overrides the default count of 3
- Standard composition fields (`tone`, `rules`, `output`) work as usual
```

Write this content to `skills/forensic-verification-deliberation/SKILL.md`.

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -8 skills/forensic-verification-deliberation/SKILL.md`
Expected: YAML frontmatter with `name: forensic-verification-deliberation`

- [ ] **Step 3: Commit**

```bash
git add skills/forensic-verification-deliberation/SKILL.md
git commit -m "feat: add forensic-verification protocol reference skill"
```

---

### Task 3: Templates

**Files:**
- Create: `templates/verification-report.md`
- Create: `templates/verification-summary.md`

- [ ] **Step 1: Create the verification report template**

```markdown
# Forensic Verification Report

**Audit ID:** {audit_id}
**Audit date:** {audit_date}
**Inquiry:** {audit_inquiry}
**Investigator:** {audit_investigator}
**Verification date:** {verification_date}
**Manifest:** {manifest_path}

---

## Feedback Patterns Applied

{If feedback log had matching patterns:}

| # | Pattern | Prior lesson | Applied to |
|---|---------|-------------|------------|
| {N} | {pattern slug} | {lesson text} | Assertion {cluster}.{index} |

{If no matching patterns: "No prior patterns matched this audit's assertions."}

## Consensus Matrix

| Cluster | Assertion | Claim | Forward | Reverse | Cross | Consensus | Notes |
|---------|-----------|-------|---------|---------|-------|-----------|-------|
| {cluster_id} | {index} | {claim text, truncated to 60 chars} | {CONFIRM/DISPUTE} | {CONFIRM/DISPUTE} | {CONFIRM/DISPUTE} | {CONFIRMED/DISCREPANCY/UNVERIFIED} | {notes} |

## Discrepancies

{For each DISCREPANCY verdict:}

### Discrepancy: {cluster_id}.{assertion_index}

**Claim:** {full claim text}

**Verifier findings:**
- **Forward:** {verdict} — {value or note}
- **Reverse:** {verdict} — {value or note}
- **Cross:** {verdict} — {value or note}

**Value comparison:**
- Manifest states: {value from assertion}
- Forward found: {value}
- Reverse found: {value}
- Cross found: {value}

**Suggested resolution:** {If feedback pattern matched: prior resolution text. Otherwise: "No prior pattern — user resolution required."}

**User resolution:** {filled in after user decides}

{If no discrepancies: "No discrepancies found. All assertions confirmed by consensus."}

## Overall Verdict

**{PASS | FAIL}**

- Assertions checked: {total}
- Confirmed (3/3): {count}
- Confirmed (2/3, dissent noted): {count}
- Discrepancies: {count}
- Unverified: {count}

{If FAIL: "This report contains {N} discrepancies requiring resolution before the forensic findings can be trusted."}
{If PASS: "All forensic findings verified by independent consensus. The report is trustworthy."}

## Verifier Reports

- [Verifier-Forward](../verifier-reports/verifier-forward.md)
- [Verifier-Reverse](../verifier-reports/verifier-reverse.md)
- [Verifier-Cross](../verifier-reports/verifier-cross.md)
```

Write this content to `templates/verification-report.md`.

- [ ] **Step 2: Create the verification summary template**

```markdown
---

## Verification Summary

_Verified {verification_date} by [Delphi forensic-verification]({docket_path}/verification/report.md)_

| # | Cluster | Claim | Consensus | Agreement |
|---|---------|-------|-----------|-----------|
| {N} | {cluster_id} | {claim text, truncated to 60 chars} | {CONFIRMED/DISCREPANCY} | {3/3 | 2/3 | 1/3 | 0/3} |

**Overall: {PASS | FAIL}** — {total} assertions checked, {confirmed} confirmed, {discrepancies} discrepancies

{If FAIL: "⚠ {N} discrepancies require resolution. See [full verification report]({docket_path}/verification/report.md)."}
{If PASS: "All assertions independently verified."}
```

Write this content to `templates/verification-summary.md`.

- [ ] **Step 3: Verify both files exist**

Run: `ls templates/verification-*.md`
Expected: `templates/verification-report.md` and `templates/verification-summary.md`

- [ ] **Step 4: Commit**

```bash
git add templates/verification-report.md templates/verification-summary.md
git commit -m "feat: add verification report and summary templates for forensic-verification mode"
```

---

### Task 4: Example Composition

**Files:**
- Create: `compositions/forensic-verification-example.yml`

- [ ] **Step 1: Create the example composition**

```yaml
name: forensic-verification-example
mode: forensic-verification

delegates:
  - role: verifier-forward
    role_type: auditor
    prompt: >
      Verification strategy: FORWARD. Read each file cited in the assertion,
      find the employee row, and report the actual values you see. Confirm if
      they match the claim. Dispute if they do not.

  - role: verifier-reverse
    role_type: auditor
    prompt: >
      Verification strategy: REVERSE. Start from the falsifiable_by instruction
      on each assertion. Actively try to disprove the claim — look for the
      evidence it says would falsify it. If you find falsifying evidence, dispute.
      If you cannot find it despite thorough searching, confirm.

  - role: verifier-cross
    role_type: auditor
    prompt: >
      Verification strategy: CROSS. For each employee+benefit combination in
      the assertion, check values across ALL files in the evidence index — not
      just the ones the assertion cites. Look for inconsistencies between files,
      timeline gaps, or files the audit skipped that contain relevant data.

rules:
  max_rounds: 1
  independent_positions: true
  require_dissent_record: false
  human_deferral: false

output:
  include_transcript: true
  include_provenance: true
```

Write this content to `compositions/forensic-verification-example.yml`.

- [ ] **Step 2: Commit**

```bash
git add compositions/forensic-verification-example.yml
git commit -m "feat: add example composition for forensic-verification mode"
```

---

### Task 5: Command

**Files:**
- Create: `commands/delphi-audit.md`

- [ ] **Step 1: Create the delphi-audit command**

```markdown
---
description: Adversarial verification of forensic audit findings via triple-verifier consensus
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '<manifest.yaml> [--tone name] [--config path.yml]'
---

# /delphi-audit

Run adversarial forensic verification on a payroll-audit findings manifest.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation:

**Manifest path (required):**
The first non-flag argument is the path to the forensic findings manifest YAML. Resolve the path using Glob if it contains wildcards (though typically it will be an exact path).

- If the path does not exist, error: "Manifest not found at {path}. Provide the path to a forensic findings manifest YAML."
- If the file does not parse as valid YAML, error: "Could not parse {path} as YAML."
- If the YAML is missing required top-level keys (`audit`, `evidence`, `records`, `clusters`, `verdict`), error: "Manifest is missing required keys: {missing keys}. See the forensic-findings-manifest schema."

**Optional flags:**
- `--tone {name}` — Tone override. Passed to the engine.
- `--config {path}` — Composition YAML override. Must have `mode: forensic-verification`.

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:

```
/delphi-audit — Adversarial verification of forensic audit findings

Usage:
  /delphi-audit docs/investigations/2026-04-01-WholeLifeAudit-Findings.yaml
  /delphi-audit findings.yaml --tone snarky
  /delphi-audit findings.yaml --config custom-verification.yml

Input:   Forensic findings manifest YAML (from /payroll-audit)
Output:  Verification report + findings annotation
Docket:  .deliberation/dockets/{timestamp}-{audit-id}/

The manifest must contain: audit, evidence, records, clusters, verdict.
Each cluster must have assertions with falsifiable_by fields.
All evidence files must be PII-shielded (filename contains "shielded").
```

## Derive companion findings report

The companion markdown report lives alongside the manifest with the same name but `.md` extension:
- Manifest: `docs/investigations/2026-04-01-WholeLifeAudit-Findings.yaml`
- Report: `docs/investigations/2026-04-01-WholeLifeAudit-Findings.md`

If the markdown file exists, store its path for Output B (verification summary annotation). If it does not exist, store null — the engine will skip Output B.

## Load feedback log

Check for `.deliberation/forensic-verification-feedback.yaml`:
- If it exists, read and parse it. Pass the parsed resolutions array to the engine.
- If it does not exist, pass an empty resolutions array.

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **mode:** `forensic-verification`
- **manifest:** the parsed YAML manifest object
- **manifest_path:** the original file path
- **findings_report_path:** the derived markdown path (or null)
- **feedback_log:** the parsed resolutions array (or empty)
- **composition:** the parsed YAML (or null — engine uses hardcoded defaults)
- **tone:** the tone name (or null)

The engine skill handles everything from here — shielded-file validation, docket creation, evidence reduction, verifier dispatch, consensus synthesis, dual output, and feedback log updates.
```

Write this content to `commands/delphi-audit.md`.

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -5 commands/delphi-audit.md`
Expected: YAML frontmatter with `description: Adversarial verification of forensic audit findings`

- [ ] **Step 3: Commit**

```bash
git add commands/delphi-audit.md
git commit -m "feat: add /delphi-audit command for forensic-verification mode"
```

---

### Task 6: Engine Protocol Section — Mode Routing

**Files:**
- Modify: `skills/delphi/SKILL.md:22-31` (Phase 0 Step 0.1: Determine mode)

- [ ] **Step 1: Add forensic-verification mode routing**

In `skills/delphi/SKILL.md`, find the mode routing block at line 24-31 (Step 0.1: Determine mode). The current block has entries for lightweight, code-review, and standard. Add the forensic-verification route.

Find this text:

```
- If you received a `mode: code-review` signal (invoked from `/delphi-review`): proceed to **Code Review Protocol** below. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading.
```

Insert after it:

```
- If you received a `mode: forensic-verification` signal (invoked from `/delphi-audit`): proceed to **Forensic Verification Protocol** below. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading.
```

Also find this line in the YAML `--config` routing block:

```
  - If `mode: code-review`: proceed to **Code Review Protocol** below
```

Insert after it:

```
  - If `mode: forensic-verification`: proceed to **Forensic Verification Protocol** below
```

- [ ] **Step 2: Verify the routing was added**

Run: `grep -n "forensic-verification" skills/delphi/SKILL.md`
Expected: Two new lines — one for direct mode signal, one for YAML config routing

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: add forensic-verification mode routing to engine Phase 0"
```

---

### Task 7: Engine Protocol Section — Forensic Verification Protocol

**Files:**
- Modify: `skills/delphi/SKILL.md` (append after Code Review Protocol, after line 1805)

This is the largest task. Append the full Forensic Verification Protocol section to the end of the engine skill.

- [ ] **Step 1: Append the Forensic Verification Protocol**

Append the following after the last line of the Code Review Protocol (after line 1805 of `skills/delphi/SKILL.md`):

```markdown

---

# Forensic Verification Protocol

Read the protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/forensic-verification-deliberation/SKILL.md` for the rules governing this mode.

This protocol verifies forensic audit findings by dispatching three independent verifier agents with different strategies, synthesizing consensus, and producing dual output (verification report + findings annotation).

## Verification Phase 0: Initialization

### Step 0.1: Validate manifest

Read the manifest YAML passed from the command. Confirm all required top-level keys exist:
- `audit` (with `id`, `date`, `source_system`)
- `evidence[]` (array with `id`, `shielded` fields per entry)
- `records[]` (array with `employee_id` fields)
- `clusters[]` (array with `id`, `assertions[]` per cluster)
- `verdict`

If any key is missing, stop and report: "Manifest validation failed: missing {key}."

### Step 0.2: Shielded-file gate

Walk every entry in `evidence[]`. For each entry with a `shielded:` path:
- Check that the filename portion of the path contains the string "shielded" (case-insensitive)
- If ANY file fails this check, hard stop: "Shielded-file gate failed: {path} does not contain 'shielded' in the filename. All evidence files must be PII-shielded."

Do not read, access, or reference any path listed under `original:`.

### Step 0.3: Create docket

Generate docket name: `{YYYYMMDD}-{HHmmss}-{audit.id}`

Create the directory structure using Bash `mkdir -p`:

```
.deliberation/dockets/{docket-name}/
  evidence/
  verifier-reports/
  verification/
```

### Step 0.4: Snapshot manifest

Copy the manifest YAML into the docket root:

```bash
cp "{manifest_path}" "{docket-path}/manifest.yaml"
```

### Step 0.5: Load tone

If `--tone` was provided, load the tone file using the standard resolution precedence:
1. `.claude/delphi/tones/{tone}.md` (user-defined)
2. `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` (built-in)

Extract `## Voice directive` and `## Examples` sections. If no tone, skip.

### Step 0.6: Load feedback log

Read the feedback log passed from the command. If resolutions exist, store them for pattern matching during synthesis.

## Verification Phase 1: Evidence reduction

This is engine preprocessing — not a delegate dispatch.

### Step 1.1: Extract employee IDs

Parse `records[].employee_id` from the manifest. Deduplicate into a unique list.

Output: `  Evidence reduction: {N} unique employees to filter for`

### Step 1.2: Filter shielded files

For each entry in `evidence[]` that has a `shielded:` path:

1. Read the CSV file using the Read tool
2. Identify the header row (first line)
3. Determine the employee ID column. The manifest's `audit.source_system` tells you which column:
   - `plansource`: The SSN column (after PII shielding, values are tokenized IDs matching `records[].employee_id`)
   - Other source systems: Check `Subscriber SSN` column, then `SSN` column. If neither exists, use the first column that contains any of the employee IDs from Step 1.1.
4. Filter: keep header + only rows where the employee ID column value matches any ID in the employee list
5. Write the filtered file to `{docket-path}/evidence/{evidence_id}_filtered.csv`

Output per file: `  Filtered {evidence_id}: {original_rows} → {filtered_rows} rows`

If a shielded file cannot be read (file not found, permission error), log a warning and continue: `  ⚠ Could not read {evidence_id}: {error}. This file will be unavailable to verifiers.`

### Step 1.3: Build evidence index

Write `{docket-path}/evidence/INDEX.md`:

```markdown
# Evidence Index

**Audit:** {audit.id}
**Generated:** {ISO 8601 timestamp}
**Employees filtered:** {employee_id list}

## Files

| Evidence ID | Label | Date | Filtered path | Rows | Original shielded path |
|-------------|-------|------|---------------|------|----------------------|
| {id} | {label} | {date} | evidence/{id}_filtered.csv | {row_count} | {shielded path} |

## Notes
{Any warnings from files that could not be read}
```

## Verification Phase 2: Parallel verifier dispatch

Dispatch three verifier agents simultaneously using the Agent tool. All use the agent definition at `${CLAUDE_PLUGIN_ROOT}/agents/deliberation-verifier.md`.

### Dispatch prompt for each verifier

Assemble the dispatch prompt with these sections. Replace `{STRATEGY_NAME}` and `{STRATEGY_DIRECTIVE}` per verifier:

````
You are Verifier-{STRATEGY_NAME} in a forensic verification deliberation.

## Verification strategy

{STRATEGY_DIRECTIVE}

## Forensic findings manifest

```yaml
{full manifest YAML content}
```

## Evidence index

Read the evidence index at: {docket-path}/evidence/INDEX.md

This index maps evidence IDs to filtered CSV file paths in the docket. Read the filtered files using the Read tool when verifying assertions. Do NOT read files outside the docket evidence directory.

## Assertions to verify

{For each cluster in the manifest:}

### Cluster: {cluster.id} — {cluster.name}

{For each assertion in the cluster:}

#### Assertion {cluster.id}.{index}
- **Claim:** {assertion.claim}
- **Evidence references:** {assertion.evidence}
- **How to check:** {assertion.falsifiable_by}

{End for each}

[TONE BLOCK]

## CRITICAL: Write your output to this exact file path

{docket-path}/verifier-reports/verifier-{strategy_name_lowercase}.md
````

### Strategy directives

**Verifier-Forward:**
```
Verification strategy: FORWARD. For each assertion, read the specific files it cites. Find the employee rows. Report the actual values you see. Compare them against the claim. CONFIRM if they match. DISPUTE if they do not. You are checking: did the audit read the files correctly?
```

**Verifier-Reverse:**
```
Verification strategy: REVERSE. For each assertion, start from the falsifiable_by instruction. It tells you exactly what evidence would disprove the claim. Go look for that evidence. If you find it, DISPUTE the claim. If you search thoroughly and cannot find it, CONFIRM. You are checking: can the claim be disproven?
```

**Verifier-Cross:**
```
Verification strategy: CROSS. For each assertion, check the employee+benefit values across ALL files in the evidence index — not just the ones the assertion cites. Look for inconsistencies between files, values that change unexpectedly, timeline gaps, or files the audit skipped that contain relevant data. CONFIRM if the cross-file picture is consistent with the claim. DISPUTE if you find contradictions. You are checking: does the full evidence picture support the claim?
```

### Dispatch all three in parallel

Use the Agent tool to dispatch all three simultaneously. Each agent gets `model: inherit` and tools `[Read, Write, Grep]`.

After all three complete, apply the dispatch safety rule: verify that all three output files exist:
- `{docket-path}/verifier-reports/verifier-forward.md`
- `{docket-path}/verifier-reports/verifier-reverse.md`
- `{docket-path}/verifier-reports/verifier-cross.md`

## Verification Phase 3: Consensus synthesis (engine logic — NOT a subagent)

### Step 3.1: Parse verifier reports

Read all three verifier reports. For each assertion (identified by `## Assertion: {cluster_id}.{index}`):
- Extract the `[ACTION: CONFIRM]` or `[ACTION: DISPUTE]` marker
- Extract the `Actual:` value from the Verification section
- Extract any notes

Build a per-assertion consensus table:

| Assertion | Forward verdict | Forward value | Reverse verdict | Reverse value | Cross verdict | Cross value |
|-----------|----------------|---------------|-----------------|---------------|---------------|-------------|

### Step 3.2: Determine consensus

For each assertion, apply the consensus rules from the protocol reference:

- 3x CONFIRM → **CONFIRMED**
- 2x CONFIRM + 1x DISPUTE → **CONFIRMED** (1 dissent noted)
- 1x CONFIRM + 2x DISPUTE → **DISCREPANCY** (majority disagree)
- 3x DISPUTE → **DISCREPANCY** (unanimous)
- Any missing marker → **UNVERIFIED**

### Step 3.3: Feedback log pattern matching

For each DISCREPANCY, search the feedback log resolutions for matches:
- Match by `pattern` field (exact match)
- Match by `cluster` name (exact match)
- Match by `claim` text (substring — does the prior claim text appear in or overlap with the current claim?)
- Match by `audit.source_system` (from manifest)

If any match is found, record it as a suggested resolution for this discrepancy.

### Step 3.4: Escalate discrepancies

For each DISCREPANCY:

If a feedback pattern matched, present:
```
⚠ DISCREPANCY: {cluster_id}.{assertion_index}
Claim: {claim text}
Forward: {verdict} — {value}
Reverse: {verdict} — {value}
Cross: {verdict} — {value}

💡 Prior pattern suggests: "{prior lesson}" (from audit {prior audit_id}, pattern: {pattern})

Do you accept this resolution, or provide a different one?
```

If no pattern matched:
```
⚠ DISCREPANCY: {cluster_id}.{assertion_index}
Claim: {claim text}
Forward: {verdict} — {value}
Reverse: {verdict} — {value}
Cross: {verdict} — {value}

No prior pattern found. How should this be resolved?
```

Wait for the user's response. Record the resolution.

### Step 3.5: Update feedback log

For each resolved discrepancy, append an entry to `.deliberation/forensic-verification-feedback.yaml`:

```yaml
- date: "{current ISO 8601 date}"
  audit_id: "{manifest audit.id}"
  cluster: "{cluster_id}"
  assertion_index: {index}
  claim: "{claim text}"
  verifier_findings:
    forward: { verdict: "{CONFIRM|DISPUTE}", value: "{value or note}" }
    reverse: { verdict: "{CONFIRM|DISPUTE}", value: "{value or note}" }
    cross: { verdict: "{CONFIRM|DISPUTE}", value: "{value or note}" }
  user_resolution: "{user's resolution text}"
  pattern: "{extracted pattern slug — lowercase, hyphens}"
  lesson: "{one-line lesson for future audits}"
```

If the file does not exist yet, create it with a top-level `resolutions:` key wrapping the array.

## Verification Phase 4: Dual output

### Step 4.1: Write verification report

Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/verification-report.md`.

Fill in all `{placeholder}` values from the manifest metadata, consensus table, discrepancy details, and resolved feedback. Write to `{docket-path}/verification/report.md`.

### Step 4.2: Annotate findings report (conditional)

If `findings_report_path` is not null (the companion markdown file exists):

1. Read the template at `${CLAUDE_PLUGIN_ROOT}/templates/verification-summary.md`
2. Fill in all `{placeholder}` values from the consensus table
3. Read the current contents of the findings markdown report
4. Append the filled template to the end of the file
5. Write the updated file back

If `findings_report_path` is null, skip this step. Output: `  Skipping findings annotation — companion markdown not found.`

### Step 4.3: Docket finalization

Write `{docket-path}/docket.json`:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "mode": "forensic-verification",
  "tone": "{tone name or null}",
  "audit_id": "{manifest audit.id}",
  "audit_date": "{manifest audit.date}",
  "inquiry": "{manifest audit.inquiry}",
  "source_system": "{manifest audit.source_system}",
  "manifest_path": "{original manifest path}",
  "findings_report_path": "{companion markdown path or null}",
  "evidence_reduction": {
    "employees_filtered": {N},
    "files_filtered": {N},
    "total_filtered_rows": {N}
  },
  "verification": {
    "verifiers": ["forward", "reverse", "cross"],
    "assertions_total": {N},
    "confirmed": {N},
    "confirmed_with_dissent": {N},
    "discrepancies": {N},
    "unverified": {N},
    "overall_verdict": "{PASS | FAIL}"
  },
  "feedback_patterns_applied": {N},
  "discrepancies_resolved": {N}
}
```

## Verification Phase 5: Present results

Present a summary to the user:

```
## Forensic Verification: {audit.id}

**Overall: {PASS | FAIL}**

### Consensus
- Confirmed (3/3): {N}
- Confirmed (2/3, dissent noted): {N}
- Discrepancies resolved: {N}
- Unverified: {N}

### Verification strategies
- Forward: {confirmed}/{total} assertions confirmed
- Reverse: {confirmed}/{total} assertions confirmed
- Cross: {confirmed}/{total} assertions confirmed

{If FAIL: "⚠ Discrepancies were found. Review the verification report for details."}
{If PASS: "All assertions independently verified. The forensic report is trustworthy."}

Docket: `.deliberation/dockets/{docket-name}/`
Verification report: `.deliberation/dockets/{docket-name}/verification/report.md`
{If annotated: "Findings report annotated: {findings_report_path}"}
```
```

- [ ] **Step 2: Verify the protocol was appended**

Run: `grep -n "^# Forensic Verification Protocol" skills/delphi/SKILL.md`
Expected: One match at a line number after 1805

Run: `tail -5 skills/delphi/SKILL.md`
Expected: The closing lines of the Verification Phase 5 summary block

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: add Forensic Verification Protocol to engine skill"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add forensic-verification to Implementation Status**

In `CLAUDE.md`, find the Implementation Status section. After the line for Code review mode, add:

```
- **Forensic verification mode** (3 verifiers, parallel dispatch): fully implemented — `/delphi-audit` command, Forward/Reverse/Cross verification strategies, consensus synthesis, dual output (verification report + findings annotation), discrepancy resolution feedback log
```

- [ ] **Step 2: Add forensic-verification to Plugin Architecture**

In the Plugin Architecture section, after the line about code review delegates, add:

```
- Forensic verification delegates: verifier (auditor, blue, dispatched 3x with strategy injection — Forward/Reverse/Cross)
- Forensic verification action markers: `[ACTION: CONFIRM]`, `[ACTION: DISPUTE]` — consensus-based synthesis, not argument evaluation
- Discrepancy resolution feedback log: `.deliberation/forensic-verification-feedback.yaml` — project-level, accumulates across audits
```

- [ ] **Step 3: Add role_type note**

In the Plugin Architecture section, find the line:
```
- Agent `role_type` taxonomy: `participant` (position+response), `challenger` (challenge output), `auditor` (independent report), `facilitator` (procedural only)
```

This line is already correct — `auditor` is already documented. No change needed.

- [ ] **Step 4: Verify changes**

Run: `grep -n "forensic" CLAUDE.md`
Expected: Lines for the Implementation Status entry and Plugin Architecture entries

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add forensic-verification mode to CLAUDE.md"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Verify all new files exist**

Run: `ls -la agents/deliberation-verifier.md skills/forensic-verification-deliberation/SKILL.md commands/delphi-audit.md templates/verification-report.md templates/verification-summary.md compositions/forensic-verification-example.yml`

Expected: All 6 files listed with non-zero sizes.

- [ ] **Step 2: Verify engine modifications**

Run: `grep -c "forensic-verification" skills/delphi/SKILL.md`
Expected: Multiple matches (mode routing + protocol section)

Run: `grep "Forensic Verification Protocol" skills/delphi/SKILL.md`
Expected: At least one match for the section heading

- [ ] **Step 3: Verify cross-references**

Check that agent file referenced in engine matches the actual file:
Run: `grep "deliberation-verifier" skills/delphi/SKILL.md`
Expected: References to `${CLAUDE_PLUGIN_ROOT}/agents/deliberation-verifier.md`

Check that template paths in engine match actual files:
Run: `grep "verification-report\|verification-summary" skills/delphi/SKILL.md`
Expected: References to `${CLAUDE_PLUGIN_ROOT}/templates/verification-report.md` and `${CLAUDE_PLUGIN_ROOT}/templates/verification-summary.md`

Check that protocol reference path in engine matches actual file:
Run: `grep "forensic-verification-deliberation" skills/delphi/SKILL.md`
Expected: Reference to `${CLAUDE_PLUGIN_ROOT}/skills/forensic-verification-deliberation/SKILL.md`

- [ ] **Step 4: Verify CLAUDE.md has all mode entries**

Run: `grep -c "fully implemented" CLAUDE.md`
Expected: 4 (lightweight, standard, code review, forensic verification)

- [ ] **Step 5: Verify the composition parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('compositions/forensic-verification-example.yml')); print('OK')"`
Expected: `OK`

- [ ] **Step 6: Final commit review**

Run: `git log --oneline -10`
Expected: 6 new commits for this feature (agent, protocol, templates, composition, command, engine protocol, engine routing, CLAUDE.md)

- [ ] **Step 7: Tag the milestone**

Do NOT push or tag — just confirm all commits are local and the working tree is clean:
Run: `git status`
Expected: Clean working tree
