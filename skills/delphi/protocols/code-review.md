# Code Review Protocol

Use this protocol when mode is code-review (invoked from `/delphi-review` command, or YAML composition with `mode: code-review`). Sequential dispatch with lint pre-phase, Cartographer, 3 default delegates, and conditional Enforcer.

## Shared references

Read these files as needed during execution:
- **Protocol rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/code-review-rules.md` — read at the start for delegate dispatch contracts, lint pre-phase rules, Cartographer dispatch contract, anti-anchoring, coverage verification, Enforcer coverage mandate, remediation plan priority mapping, and composition override rules
- **Categorization rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md` — read during Phase 6 (synthesis)
- **Docket schema**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md` — read during Phase 8 (docket finalization) — use the "Code review docket.json schema" section
- **Synthesis rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/synthesis-rules.md` — read during Phase 6, use the "Citation coverage map" section
- **Response instructions**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/response-instructions.md` — reference for Phase 5 response dispatch, use code-review parameters (citation_format = `filename, line`)

---

Read the protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/code-review-rules.md` for rules on delegate dispatch contracts, lint pre-phase, Cartographer dispatch, anti-anchoring, and remediation plan generation.

---

## Review Phase 0: Initialization

### Step 0.1: Parse review context

When invoked from `/delphi-review`, you receive:
- **review_artifact:** assembled code content (files or diff with full file contents)
- **review_files:** list of file paths being reviewed
- **review_type:** `files` or `diff`
- **diff_ref:** git ref if diff mode (or `staged`)
- **conventions:** conventions file path and contents (or null)
- **composition:** parsed YAML (or null for hardcoded defaults)
- **tone:** tone name (or null)

### Step 0.2: Determine delegate roster

**Quick-path (no composition):**
Use the hardcoded roster:

| Role | Agent | Role type |
|------|-------|-----------|
| cartographer | `deliberation-cartographer` | challenger |
| advocate | `deliberation-advocate` | participant |
| critic | `deliberation-critic` | challenger |
| maintainer | `deliberation-maintainer` | challenger |
| enforcer (conditional) | `deliberation-enforcer` | auditor |

The Cartographer is always included. The Enforcer is included ONLY when `enforcer_active = true` (see Step 0.4a).

**Composition path:**
Read the YAML delegate list. For each delegate:
1. Use `role_type` to determine dispatch phase
2. Resolve agent file using the same precedence as Standard Protocol (project `.claude/agents/` > plugin `agents/` > YAML prompt only)
3. Validate: at least one `participant` and one `challenger` required

### Step 0.3: Create docket directory

Generate docket name: `{YYYYMMDD}-{HHmmss}-review-{slug}` where slug is derived from the first reviewed filename (e.g., `review-dashboard-tsx`).

Create directory structure using Bash `mkdir -p`:

```
.deliberation/dockets/{docket-name}/
  code-under-review/
  positions/round-1/
  challenges/
  responses/round-1/
  compliance/
  synthesis/
  remediation/
```

Only create `compliance/` if conventions are provided.

### Step 0.4: Snapshot code under review

Copy each reviewed file to `{docket-path}/code-under-review/`:
- For file review: copy each file preserving the filename
- For diff review: write `diff.patch` with the raw diff, and copy each changed file

This makes the docket self-contained — the review is reproducible even if source files change.

### Step 0.4a: Lint pre-phase

This is ENGINE LOGIC — not a subagent dispatch. The engine auto-detects and runs linters before any delegate dispatch.

**1. Detect linters:** Inspect file extensions of `review_files` and use Glob tool to search for linter configs in the project:

| File extensions | Linter | Config files searched |
|----------------|--------|---------------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | ESLint | `eslint.config.*`, `.eslintrc.*` |
| `.css`, `.module.css` | Stylelint | `stylelint.config.*`, `.stylelintrc.*` |
| `.cs` | Roslyn Analyzers | `.editorconfig`, `Directory.Build.props`, `.globalconfig` |

**2. Skip conditions:** Skip the lint pre-phase entirely if ANY of these are true:
- The `skip_lint` parameter is `true` (from `--skip-lint` CLI flag or composition YAML `skip_lint: true` field)
- Composition YAML sets `lint.enabled: false`

When lint is skipped, output: `  Lint: skipped (upstream pipeline handled linting)`
Set `enforcer_active` based on the composition's explicit `enforcer_active` field, or default to `true` if conventions are provided.

**3. Run linters:** If configs found, run linters via Bash:

```bash
eslint_d {files} --format json 2>/dev/null || npx eslint {files} --format json
npx stylelint {files} --cache --formatter json
dotnet build --no-restore -warnaserror- 2>&1
```

**Failure handling:** Lint is best-effort. If a linter command fails, warn and proceed without lint findings. Do NOT fall back to Enforcer on lint failure (failure to lint ≠ no lint config).

**4. Parse output:** Parse JSON output into a normalized markdown table:

```markdown
## Lint findings
| # | File | Line | Rule | Severity | Message |
|---|------|------|------|----------|---------|
Total: {N} errors, {M} warnings
```

**5. Determine Enforcer path:**

| Condition | `enforcer_active` |
|-----------|-------------------|
| Lint findings collected (linter config found and ran) | `false` — lint replaces the Enforcer |
| No linter config + conventions provided | `true` — Enforcer is the LLM fallback |
| No linter config + no conventions | `false` — skip convention checking entirely |
| Composition explicitly lists enforcer in delegates | `true` — backward compatibility |

**6. Output progress:** `  Lint: {N} errors, {M} warnings ({tools})` or `  Lint: no linter config detected`

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
convention compliance. The Cartographer will map component library coverage.
The Advocate will defend the implementation. The Critic will challenge its
correctness and robustness. The Maintainer will evaluate its comprehensibility
and modification safety.
{If enforcer_active: "The Enforcer will audit against stated conventions."}

## Files to review

{for each file in code-under-review/:}
- `{docket-path}/code-under-review/{filename}` (source: `{original-path}`)
{/for}

## Code under review

{review_artifact content — the assembled code/diff, FULL AND UNABRIDGED}

{if lint findings collected:}
## Lint findings
{normalized lint findings table from Step 0.4a}
{/if}
```

**Anti-abbreviation rule:** The code embedded above MUST be the COMPLETE, UNABRIDGED source of every file. The engine MUST NOT truncate, abbreviate, condense, summarize, or use `[...]` placeholders for any section. Every line of every file must appear exactly as it does in the source. Opus 4.6 has a 1M context window — there is no reason to abbreviate.

The `code-under-review/` file paths are also provided so delegates can use the Read tool to verify line numbers against the snapshot files.

### Step 0.6: Tone loading

If a tone was provided, load it using the same resolution precedence as Standard Protocol:
1. `.claude/delphi/tones/{tone}.md` (user-defined)
2. `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` (built-in)
3. Warning if not found, proceed without tone

---

## Review Phase 1: Cartographer analysis

Output progress: `Code review: {slug}`
Output progress: `  Cartographer analysis...`

### Step 1.1: Assemble dispatch package

Read the Replacement Map template from `${CLAUDE_PLUGIN_ROOT}/templates/replacement-map.md`.

Assemble the Cartographer's dispatch prompt:

```
You are the Cartographer in this code review. You know the map of the
component library and identify when the developer built a road where a
highway already goes.

{if composition provides custom cartographer prompt:}
{composition cartographer prompt}
{/if}

[TONE BLOCK]

[MCP GROUNDING BLOCK]

## Review context
{contents of proposition.md — contains review metadata, file list, full unabridged code, AND lint findings if available}

{if grounding file provided via composition grounding: field:}
## Component library reference
{contents of grounding file — FULL}
{/if}

{if conventions provided:}
## Conventions
{contents of conventions file — FULL}
{/if}

{if upstream_report provided:}
## Upstream analysis

The following report was produced by an upstream pipeline agent (component-structure)
that already analyzed this code for structural patterns, drift detection, size/complexity
thresholds, and design system compliance. Use this to avoid re-scanning territory
already covered. Focus your analysis on component SELECTION correctness, variant
appropriateness, and sub-component opportunities — the areas this upstream report
does not deeply evaluate.

{contents of upstream_report file}
{/if}

## Your task
Read the code. For each functional block, ask: "What is this trying to do,
and does the component library already do that?" Look for component
replacements, variant corrections, sub-component opportunities. Use lint
violation clusters as signals — a block of code with 8 lint violations is
more likely to be a reimplementation than a block with 0.

## Output format
Follow this template exactly:
{contents of Replacement Map template}

## CRITICAL: Write your output to this exact file path
Write your complete Cartographer report to: {docket-path}/challenges/round-1-cartographer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch cartographer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-cartographer` agent definition.

Output progress: `  Cartographer analysis... done`

### Step 1.3: MCP verification fetch (engine logic)

Skip this step if no MCP grounding exists (no `mcp:` field in composition or MCP unavailable).

Read `{docket-path}/challenges/round-1-cartographer.md`. Extract every component name that appears in:
- Component replacements: the "Library equivalent" field
- Variant corrections: the "Should be" field
- Sub-component opportunities: the "Should be" field

### Step 1.4: Diff against Phase A grounding

Compare the Cartographer's recommended components against the components already covered in `{docket-path}/mcp-grounding.md`.

**No gaps:** Output `  MCP grounding: complete (no verification gaps)` and proceed.

**Gaps exist:** For each component the Cartographer recommends that is NOT in the grounding document, call the same MCP tools used in Phase A (Step 0.2c). Append the results to `{docket-path}/mcp-grounding.md` under a new section:

```
## Verification fetch — Cartographer recommendations

### {ComponentName}
**When to use:** {from info tool}
**Props:** {from info tool}
**Semantic keys:** {from semantic tool, if available}
```

Output: `  MCP grounding: {N} components added from Cartographer recommendations ({list})`

This is one follow-up fetch, not a loop. The Advocate and subsequent delegates receive the updated grounding. The Cartographer itself does not — it already ran.

---

## Review Phase 2: Advocate position

Output progress: `  Advocate position...`

### Step 2.1: Assemble dispatch package

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

[MCP GROUNDING BLOCK]

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

{if Cartographer ran:}
## Cartographer findings
The Cartographer has identified component replacement proposals. Read them:
  Read: `{docket-path}/challenges/round-1-cartographer.md`
You must address each Cartographer challenge in your position or response phase.
{/if}

{if upstream_report provided:}
## Upstream analysis (component-structure)

An upstream agent produced this structural analysis. You may cite its findings
as evidence when defending implementation choices.

{contents of upstream_report file}
{/if}

## Output format
Follow this template exactly:
{contents of position template}

Write "# Position: advocate" as your heading.

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/advocate.md

Do not write to any other path. Do not output anything else.
```

### Step 2.2: Dispatch advocate subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-advocate` agent definition.

Output progress: `  Advocate position... done`

---

## Review Phase 3: Critic challenge

Output progress: `  Critic challenge...`

### Step 3.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.

**Do NOT embed the Advocate's position in this prompt.** The Critic will read it from the docket via Read tool after forming an independent assessment of the code.

Assemble the Critic's dispatch prompt:

```
You are the Critic in this code review. Your capability is challenge_all.

{if composition provides custom critic prompt:}
{composition critic prompt}
{/if}

[TONE BLOCK]

[MCP GROUNDING BLOCK]

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

### Step 3.2: Dispatch critic subagent

Dispatch using the `deliberation-critic` agent definition.

Output progress: `  Critic challenge... done`

---

## Review Phase 4: Maintainer challenge

Output progress: `  Maintainer challenge...`

### Step 4.1: Assemble dispatch package

**Anti-anchoring: Do NOT read or include the Critic's challenges or Cartographer findings. Do NOT embed the Advocate's position in this prompt.** The Maintainer will read it from the docket via Read tool after forming an independent assessment.

Assemble the Maintainer's dispatch prompt:

```
You are the Maintainer in this code review. You read code as someone who
will inherit it in 6 months with no access to the original author.

{if composition provides custom maintainer prompt:}
{composition maintainer prompt}
{/if}

[TONE BLOCK]

[MCP GROUNDING BLOCK]

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

### Step 4.2: Dispatch maintainer subagent

Dispatch using the `deliberation-maintainer` agent definition.

Output progress: `  Maintainer challenge... done`

---

## Review Phase 4b: Enforcer compliance report (conditional)

**This phase runs ONLY when `enforcer_active = true`.**
**Skip this phase if lint findings were collected — lint replaces the Enforcer.**

Output progress: `  Enforcer compliance check...`

### Step 4b.1: Assemble dispatch package

Read the compliance report template from `${CLAUDE_PLUGIN_ROOT}/templates/compliance-report.md`.

Assemble the Enforcer's dispatch prompt:

```
You are the Enforcer in this code review. You audit code against conventions.

{if composition provides custom enforcer prompt:}
{composition enforcer prompt}
{/if}

[TONE BLOCK]

[MCP GROUNDING BLOCK]

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

### Step 4b.2: Dispatch enforcer subagent

Dispatch using the `deliberation-enforcer` agent definition.

**The Enforcer does NOT participate in the challenge-response cycle.** Its report is appended to the docket and feeds into the remediation plan, but the Advocate does not respond to it.

Output progress: `  Enforcer compliance check... done`

---

## Review Phase 5: Advocate response

Output progress: `  Advocate response...`

### Step 5.1: Extract challenges from all challengers

Read `{docket-path}/challenges/round-1-cartographer.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-critic.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-maintainer.md`. Extract the section under `## Challenges to: advocate`.

### Step 5.2: Assemble dispatch package

```
You are the Advocate. You are responding to adversarial challenges from
the Cartographer, the Critic, and the Maintainer.

[TONE BLOCK]

[MCP GROUNDING BLOCK]

## Your original position
{contents of positions/round-1/advocate.md}

## Challenges directed at you

### From Cartographer:
{extracted cartographer challenges}

### From Critic:
{extracted challenges from critic}

### From Maintainer:
{extracted challenges from maintainer}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag. The engine
parses these tags to determine whether your defense is adequate.

Available actions:
- [ACTION: DEFEND] — Refute the challenge with evidence. You MUST include at
  least one [CITE: filename, line] marker pointing to actual code. Example:

  [ACTION: DEFEND]
  The naming concern is addressed — `processPayment` clearly describes the
  function's purpose. [CITE: PaymentService.tsx, line 42] shows the function
  handles exactly one payment transaction with explicit error boundaries.

- [ACTION: CONCEDE] — Accept the challenge as valid. State what should change
  in the code. Example:

  [ACTION: CONCEDE]
  The maintainer is correct that the nested ternary on line 87 is unreadable.
  This should be extracted to a named helper function with descriptive parameter names.

- [ACTION: DISSENT] — Accept the finding but record disagreement. Example:

  [ACTION: DISSENT]
  I accept that the abstraction adds indirection, but want it on the record
  that removing it would create duplication across 3 call sites that will
  diverge over time.

Respond to EVERY challenge from the Cartographer, the Critic, and the
Maintainer. Use clear headers to organize your responses:

### Response to Cartographer

[responses with action tags]

### Response to Critic

[responses with action tags]

### Response to Maintainer

[responses with action tags]

Do NOT ignore any challenge. Every challenge gets exactly one action tag.

## CRITICAL: Write your output to this exact file path
Write your complete response to: {docket-path}/responses/round-1/advocate.md
```

### Step 5.3: Dispatch advocate subagent

Dispatch using the `deliberation-advocate` agent definition.

Output progress: `  Advocate response... done`

---

## Review Phase 6: Synthesis (engine logic — NOT a subagent)

Output progress: `  Synthesizing review...`

This phase is performed by YOU (the engine), not by a subagent.

### Step 6.1: Read all files

Read `{docket-path}/challenges/round-1-cartographer.md`.
Read `{docket-path}/responses/round-1/advocate.md`.
If Enforcer ran: read `{docket-path}/compliance/enforcer-report.md`.

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

### Step 6.2: Categorize challenge-response pairs

For each challenge from the Cartographer, Critic, and Maintainer, find the Advocate's corresponding response and categorize using the **challenge-response categorization rules** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md`.

### Step 6.3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables. Write to `{docket-path}/synthesis/round-1.md`.

Append convention checking status:

```
## Convention checking
{if lint findings collected: "Lint: {N} errors, {M} warnings ({tools})"}
{if Enforcer ran: "Enforcer: {N} checked, {pass} pass, {fail} fail"}
{if neither: "Skipped — no linter config detected and no conventions provided"}
```

Append Cartographer summary:

```
## Cartographer findings
- Component replacements proposed: {N}
- Variant corrections proposed: {N}
- Sub-component opportunities proposed: {N}
- Total violations eliminable: {N}
```

If Enforcer ran, append to the synthesis:

```
## Compliance report summary

Conventions checked: {N} | Pass: {N} | Fail: {N} | N/A: {N}

Failed conventions are included in the remediation plan as Critical items.
Full report: compliance/enforcer-report.md
```

### Step 6.4: Determine outcome

Code review uses single-round by default (quick-path). The outcome is always terminal:
- ALL settled: **clean** (code passes review)
- ANY contested or conceded: **findings** (remediation needed)
- If composition specifies `max_rounds > 1`: follow the same multi-round logic as Lightweight Protocol

Output progress: `  Synthesis: {settled} settled, {contested} contested, {conceded} conceded`

---

## Review Phase 7: Remediation plan (engine logic — NOT a subagent)

Output progress: `  Generating remediation plan...`

### Step 7.1: Collect findings

From the synthesis, lint findings, Cartographer report, and compliance report, build a findings list:

**Critical findings:**
- Every lint error
- Every Cartographer replacement/variant/sub-component where Advocate conceded or was contested (in "Component replacements" section — include "eliminates {N} violations" metric)
- Every contested point (Advocate's defense was unsupported or absent)
- Every `[ACTION: CONCEDE]` from the Advocate
- Every failure in the Enforcer's compliance report (if Enforcer ran)

**Recommended findings:**
- Every lint warning
- Every Cartographer finding where Advocate dissented
- Every `[ACTION: DISSENT]` from the Advocate

**Optional findings:**
- Every Cartographer finding where Advocate defended with evidence
- Every `[ACTION: DEFEND]` with self-referential `[CITE:]` (flagged in synthesis)
- Successfully defended points where the Maintainer raised the concern (awareness items)

### Step 7.2: Trace to code locations

For EACH finding, extract the `[CITE: filename, line]` markers from the delegate challenges and Advocate responses. Map each finding to a specific File + Lines + Action triple.

If a finding has no `[CITE:]` marker pointing to a specific code location, attempt to infer the location from the challenge text (file names, function names, line references in the challenge prose). If still unresolvable, include the finding with `Lines: N/A` and a note: "Code location could not be determined from delegate output."

### Step 7.3: Write remediation plan

Read the remediation plan template from `${CLAUDE_PLUGIN_ROOT}/templates/remediation-plan.md`.
Fill in all findings organized by priority tier.
Write to `{docket-path}/remediation/plan.md`.

Output progress: `  Remediation plan: {critical} critical, {recommended} recommended, {optional} optional`

---

## Review Phase 8: Docket finalization

### Step 8.1: Write docket.json

Write `{docket-path}/docket.json`:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "mode": "code-review",
  "tone": "{tone name, or omit if none}",
  "review_target": {
    "type": "{files | diff}",
    "paths": ["{list of file paths}"],
    "diff_ref": "{git ref or 'staged', omit if file mode}",
    "conventions": "{conventions file path, omit if none}"
  },
  "delegates": [
    {
      "role": "{role}",
      "role_type": "{participant | challenger | auditor}",
      "agent": "{agent file name}"
    }
  ],
  "rules": {
    "max_rounds": 1,
    "independent_challenges": true,
    "enforcer_active": "{true | false}"
  },
  "lint": {
    "detected": true,
    "tools": ["eslint", "stylelint"],
    "errors": "{N}",
    "warnings": "{M}"
  },
  "cartographer": {
    "replacements_proposed": "{N}",
    "variant_corrections": "{N}",
    "subcomponent_opportunities": "{N}",
    "violations_eliminable": "{N}",
    "advocate_conceded": "{N}",
    "advocate_defended": "{N}"
  },
  "outcome": "{clean | findings}",
  "remediation": {
    "critical": "{count}",
    "recommended": "{count}",
    "optional": "{count}"
  },
  "provenance": [
    {
      "finding": "{finding title}",
      "raised_by": "{role}",
      "response": "{DEFEND | CONCEDE | DISSENT | none}",
      "resolution": "{settled | contested | conceded | dissent}"
    }
  ]
}
```

**Omission rules:** Omit the `lint` block if no linter config was detected. Omit the `cartographer` block if the Cartographer did not run (e.g., composition overrides without a cartographer delegate).

### Step 8.2: Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Present a summary to the user:

```
## Code Review: {slug}

**Outcome:** {Clean — no findings | Findings — remediation needed}

### Summary
- Settled (code defended): {N}
- Contested (defense failed): {N}
- Conceded (advocate agreed): {N}
{if lint ran:}
- Lint: {N} errors, {M} warnings ({tools})
{/if}
- Cartographer: {N} replacements, {M} variant corrections, {K} sub-component opportunities
{if Enforcer ran:}
- Convention failures: {N}
{/if}

### Remediation plan
{If findings: display contents of remediation/plan.md}
{If clean: "No remediation needed. All challenges were addressed with evidence."}

Docket: `.deliberation/dockets/{docket-name}/`
Remediation plan: `.deliberation/dockets/{docket-name}/remediation/plan.md`
```
