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
