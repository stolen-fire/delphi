# Forensic Verification Protocol

Read the protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/forensic-verification-deliberation/SKILL.md` for the rules governing this mode.

This protocol verifies forensic audit findings by dispatching three independent verifier agents with different strategies, synthesizing consensus, and producing dual output (verification report + findings annotation).

## Shared references

Read these files as needed during execution:
- **Protocol rules**: `${CLAUDE_PLUGIN_ROOT}/skills/forensic-verification-deliberation/SKILL.md` — read at the start for consensus rules, verifier output format, and overall verdict logic

---

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

[MCP GROUNDING BLOCK]

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
