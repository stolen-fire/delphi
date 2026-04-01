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
