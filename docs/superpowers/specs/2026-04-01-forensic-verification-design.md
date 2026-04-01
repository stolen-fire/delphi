# Forensic Verification Mode — Design Spec

**Date**: 2026-04-01
**Status**: Approved
**Mode**: `forensic-verification`
**Command**: `/delphi-audit`

## Problem Statement

The payroll-audit skill produces forensic investigation reports tracing employee benefit records across source files and payroll output files. These reports contain factual claims — specific values read from specific files at specific rows. LLMs can hallucinate values during CSV parsing, and the payroll domain has zero tolerance for error. People's paychecks depend on these findings being ground truth.

Currently, the forensic report undergoes no adversarial verification. A single model pass produces findings that go directly to stakeholders. There is no mechanism to confirm that the stated values actually exist in the cited files.

## Solution

Add `forensic-verification` as a first-class Delphi deliberation mode. After a forensic audit produces its findings, the user invokes `/delphi-audit` pointing at the findings manifest. Delphi:

1. Reduces the evidence (filters shielded source files to just the employees under investigation)
2. Dispatches three independent verifier agents in parallel, each with a different verification strategy
3. Synthesizes consensus across the three reports
4. Produces a verification report (docket artifact) and a verification summary (appended to the findings doc)
5. Persists discrepancy resolutions to a feedback log that accumulates across audits

## Input Contract

The forensic findings manifest YAML (`forensic-findings-manifest.md` schema from the payroll-audit skill) is the sole input artifact. It provides:

- `audit` — metadata (id, date, requestor, investigator, inquiry, mode, client, source_system, target_system)
- `evidence[]` — inventory of every file with `shielded:` paths
- `records[]` — per employee+benefit combinations with timelines and moments of truth
- `clusters[]` — root cause groups, each with an `assertions[]` array
- `clusters[].assertions[].falsifiable_by` — concrete instructions for how to disprove each claim
- `verdict` — summary statistics

The companion findings markdown report is derived by convention (same directory, same date-prefix, `.md` instead of `.yaml`).

## Architecture

### File Inventory

#### New files

| File | Purpose |
|------|---------|
| `skills/forensic-verification-deliberation/SKILL.md` | Protocol reference — rules for this mode |
| `agents/deliberation-verifier.md` | Verifier agent definition (dispatched 3x with strategy injection) |
| `commands/delphi-audit.md` | `/delphi-audit` command entry point |
| `templates/verification-report.md` | Full verification docket artifact template |
| `templates/verification-summary.md` | Footer block appended to findings report |
| `compositions/forensic-verification-example.yml` | Example composition |

#### Modified files

| File | Change |
|------|--------|
| `skills/delphi/SKILL.md` | Add Forensic Verification Protocol section + mode routing in Phase 0 |
| `CLAUDE.md` | Add forensic-verification to Implementation Status |

### Pipeline Phases

#### Phase 0: Initialization

1. Parse command input — read manifest YAML path from `/delphi-audit` args
2. Validate manifest — confirm it parses as valid YAML with required top-level keys (`audit`, `evidence`, `records`, `clusters`, `verdict`)
3. Shielded-file gate — walk `evidence[]` inventory; every `shielded:` path must contain "shielded" in the filename; any failure → hard stop with clear error
4. Create docket — `.deliberation/dockets/{YYYYMMDD}-{HHmmss}-{audit.id}/` with subdirectories: `evidence/`, `verifier-reports/`, `verification/`
5. Snapshot manifest — copy the YAML manifest into the docket for reproducibility
6. Load tone — standard tone loading (optional `--tone` flag)
7. Load feedback log — read `.deliberation/forensic-verification-feedback.yaml` if it exists

#### Phase 1: Evidence Reduction

Engine logic (not a delegate). Preprocessing that produces lightweight filtered files.

1. Extract employee IDs — parse `records[].employee_id` from the manifest → unique list
2. Filter shielded files — for each file in `evidence[]`:
   - Read the CSV (header + data rows)
   - Keep the header row
   - Keep only rows where the employee identifier column matches any extracted ID
   - Write filtered copy to `{docket}/evidence/{evidence_id}_filtered.csv`
3. Build evidence index — write `{docket}/evidence/INDEX.md` mapping each evidence ID to its filtered file path, row count, and original evidence metadata

The employee ID column name varies by source system. The manifest's `audit.source_system` field determines which column to filter on. Initially hardcoded for PlanSource (SSN column). Note: because all files are PII-shielded, the `records[].employee_id` values are shielded tokens (e.g., "53310"), not raw SSNs. The shielded source files use the same tokens, so filtering matches token-to-token. Future source adapters extend this column mapping.

#### Phase 2: Parallel Verifier Dispatch

Three verifier agents dispatched simultaneously, each with a different verification strategy injected via the dispatch prompt:

| Instance | Strategy | What it catches |
|----------|----------|-----------------|
| Verifier-Forward | Read each cited file, find the employee row, report actual values | Hallucinated values, wrong-row reads |
| Verifier-Reverse | Start from `falsifiable_by` — actively try to disprove each claim | Missing data, wrong-file citations, unchecked angles |
| Verifier-Cross | Check employee+benefit consistency across ALL files in evidence, not just cited ones | Timeline gaps, skipped files, missed transitions |

All three use the same agent definition (`deliberation-verifier.md`). The strategy is injected by the engine in the dispatch prompt. Each writes to `{docket}/verifier-reports/verifier-{strategy}.md`.

Anti-anchoring is inherent — parallel dispatch in isolated subagent context windows means no verifier can see another's output.

#### Phase 3: Consensus Synthesis

Engine logic (not a subagent). Parses `[ACTION: CONFIRM]` and `[ACTION: DISPUTE]` markers from each verifier report.

| Forward | Reverse | Cross | Consensus |
|---------|---------|-------|-----------|
| CONFIRM | CONFIRM | CONFIRM | **CONFIRMED** |
| CONFIRM | CONFIRM | DISPUTE | **CONFIRMED** (1 dissent noted) |
| CONFIRM | DISPUTE | DISPUTE | **DISCREPANCY** (majority disagree) |
| DISPUTE | DISPUTE | DISPUTE | **DISCREPANCY** (unanimous) |

Any DISCREPANCY where values disagree → **ESCALATE** to user. The engine does not resolve factual disagreements.

When a discrepancy matches a pattern from the feedback log, the engine surfaces the prior resolution as a proactive suggestion before asking the user to decide.

#### Phase 4: Dual Output

**Output A — Verification Report** → `{docket}/verification/report.md`

Full docket artifact using `templates/verification-report.md`:
- Audit metadata and verification date
- Feedback patterns applied (from log)
- Per-assertion consensus matrix (cluster, assertion, Forward, Reverse, Cross, consensus, notes)
- Discrepancy detail sections (what each verifier found, suggested resolution from feedback patterns)
- Overall verdict: PASS (all confirmed) / FAIL (any discrepancy escalated)
- Links to individual verifier reports

**Output B — Verification Summary** → Appended to the findings markdown report

Footer block using `templates/verification-summary.md`:
- Per-assertion table: index, claim (truncated ~60 chars), consensus, agreement (3/3, 2/3)
- Overall pass/fail line
- Link to full verification report in docket
- Original prose remains untouched

If the findings markdown doesn't exist at the derived path, Output B is skipped silently.

**Docket finalization** → `docket.json` with forensic-verification-specific schema.

## Verifier Agent Design

### Frontmatter

```yaml
name: deliberation-verifier
description: >
  Forensic verification auditor. Reads filtered shielded evidence files,
  locates specific values cited in forensic findings, and confirms or
  disputes each factual claim with exact file/row/value evidence.
role_type: auditor
model: inherit
tools:
  - Read
  - Write
  - Grep
color: blue
```

### Behavioral Constraints

1. **No interpretation** — do not assess whether a finding is a bug or expected behavior; only verify: does the file contain the stated value?
2. **Cite everything** — every verification must include: file read, row identified, column/field, actual value found
3. **Use `falsifiable_by`** — follow the instruction literally for each assertion
4. **Shielded-only gate** — refuse to read any file whose name doesn't contain "shielded" or isn't in the evidence index
5. **Action markers** — end each assertion verification with `[ACTION: CONFIRM]` or `[ACTION: DISPUTE]`

### Report Format (per assertion)

```markdown
## Assertion: {cluster_id}.{assertion_index}
Claim: "{claim text}"

### Verification
- File read: {evidence_id} → {file_path}
- Row(s) examined: {employee_id(s)}
- Expected: {value from manifest}
- Actual: {value found in file}
- Verdict: CONFIRM | DISPUTE (matches action marker)

### Evidence
{Raw excerpt — actual row/values from the file}

### Notes
{Anything unexpected — missing rows, ambiguous matches, file format issues}
```

### Why Grep is in the tools list

Filtered CSVs may still have hundreds of rows (an employee with 12 benefits across 8 files). Grep lets the verifier locate exact employee+benefit combinations without reading every line.

## Action Markers

Forensic-verification introduces two new action markers, distinct from standard/code-review:

| Marker | Meaning | Used by |
|--------|---------|---------|
| `[ACTION: CONFIRM]` | File contains the stated value — claim verified | Verifier |
| `[ACTION: DISPUTE]` | File does NOT contain the stated value, or value differs | Verifier |

These are intentionally different from `DEFEND`/`CONCEDE`/`DISSENT`. Standard mode markers express judgment about arguments. Forensic markers express factual findings about file contents.

## Discrepancy Resolution Feedback Log

**Location**: `.deliberation/forensic-verification-feedback.yaml`

Persists at project level (not inside individual dockets) so it accumulates across audits.

### Schema

```yaml
resolutions:
  - date: "2026-04-01"
    audit_id: "2026-04-01-WholeLifeAudit"
    cluster: reinstatement_missed
    assertion_index: 1
    claim: "All 7 records show absent→active transition..."
    verifier_findings:
      forward: { verdict: CONFIRM, value: "absent→active" }
      reverse: { verdict: DISPUTE, note: "Found record 52681 in output file" }
      cross: { verdict: CONFIRM }
    user_resolution: "Reverse verifier correct — 52681 processed in manual run, not by pipeline"
    pattern: "manual_reprocessing_not_in_audit_scope"
    lesson: "Check manual run logs before concluding a record was missed"
```

### Lifecycle

1. Engine reads the log at Phase 0 init
2. During Phase 3 synthesis, when a discrepancy is found, engine searches for matching patterns (by claim type, cluster name, source system, or similar assertion text)
3. If a match is found, engine suggests the prior resolution before asking the user
4. User resolves the discrepancy
5. Engine writes the resolution to the log with the user's decision and extracted pattern/lesson

### Long-term Value

- **Per-session**: Prior resolutions inform current discrepancy triage ("last 4 times this pattern appeared, it was a manual run")
- **Cross-session**: Accumulation reveals which verification strategies catch the most real errors, which claim types have highest discrepancy rates
- **Cross-domain**: If adopted by other audit domains, the pattern/lesson taxonomy becomes a training signal

## Command Interface

**File**: `commands/delphi-audit.md`

```
/delphi-audit <manifest-path> [--tone name] [--config path.yml]
```

| Argument | Required | Purpose |
|----------|----------|---------|
| `<manifest-path>` | Yes | Path to forensic findings manifest YAML |
| `--tone` | No | Tone override |
| `--config` | No | Composition YAML override |

### Command responsibilities

1. Read and validate the manifest YAML
2. Derive companion findings markdown path (same directory, `.md` extension)
3. Load feedback log from `.deliberation/forensic-verification-feedback.yaml`
4. Pass to engine with `mode: forensic-verification`

No `--evidence` flag — evidence inventory is inside the manifest.

## Composition Support

Custom compositions can override:
- Number of verifiers (default 3)
- Verification strategies (default: Forward, Reverse, Cross)
- Tone
- Output preferences

Example composition at `compositions/forensic-verification-example.yml`.

## Mode Routing

In `skills/delphi/SKILL.md`, Phase 0 Step 0.1 (Determine mode):

```
If you received a mode: forensic-verification signal (invoked from /delphi-audit):
  proceed to Forensic Verification Protocol below.
```

## Design Decisions

### Why a new mode rather than composition-only

Standard mode's synthesis uses action-marker categorization (DEFEND/CONCEDE/DISSENT) designed for argument evaluation. Forensic verification needs consensus synthesis (majority agreement on factual claims). Bending standard mode to do this would be fragile and semantically wrong.

### Why three different strategies rather than three identical verifiers

Three identical agents reading the same file the same way will likely exhibit the same systematic parsing biases. Different strategies (Forward/Reverse/Cross) attack from different angles, catching different failure modes. This is genuine redundancy, not redundancy theater.

### Why the verifier is role_type `auditor`

Auditors produce independent reports and do not participate in the challenge-response cycle. Verifiers examine evidence and report findings — they don't debate each other. The engine synthesizes consensus mechanically from their independent outputs.

### Why new action markers (CONFIRM/DISPUTE) rather than reusing DEFEND/CONCEDE

DEFEND/CONCEDE express judgment about argument quality. CONFIRM/DISPUTE express factual findings about file contents. The semantics are fundamentally different, and the synthesis logic that processes them is different (consensus majority vs. action-marker categorization).

### Why the findings report gets a footer, not inline annotations

Inline annotations would clutter the forensic prose that stakeholders read. A footer table provides visibility (Don Norman: knowledge in the world) without modifying the investigation narrative. The full evidence trail lives in the docket verification report.

### Why the feedback log is project-level, not per-docket

Docket-level storage would silo each audit's learnings. Project-level accumulation enables cross-audit pattern recognition and proactive suggestions. The log becomes more valuable over time.
