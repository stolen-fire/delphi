# v0.8.0 Lint Pre-Phase + Cartographer Delegate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Enforcer delegate's convention checking with deterministic linters, add a Cartographer delegate that identifies hand-rolled code duplicating library components, and update the code review protocol dispatch sequence.

**Architecture:** Three changes to the code review protocol: (1) lint pre-phase as engine logic auto-detects and runs linters, embedding findings in the proposition; (2) new Cartographer delegate (challenger role_type) dispatched after lint, before Advocate, producing a Replacement Map that enters the adversarial cycle; (3) Enforcer preserved as fallback when no linter config exists. All changes scoped to code-review mode only.

**Tech Stack:** Pure Markdown/YAML — no build step. Agent definitions, templates, skill/protocol references, composition YAML.

**Spec:** `docs/superpowers/specs/2026-04-01-v08-lint-cartographer-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `agents/deliberation-cartographer.md` | Create | Cartographer agent definition — framework-agnostic challenger |
| `templates/replacement-map.md` | Create | Cartographer output template — component replacements, variant corrections, sub-component opportunities, challenges |
| `templates/synthesis.md` | Modify | Add lint findings section and convention-checking status |
| `templates/remediation-plan.md` | Modify | Add component replacements section (Cartographer), lint findings section |
| `skills/code-review-deliberation/SKILL.md` | Modify | Updated dispatch order, lint integration rules, Cartographer dispatch contract, Enforcer conditional logic |
| `skills/delphi/SKILL.md` | Modify | Lint pre-phase engine logic, Cartographer dispatch prompt, Enforcer conditional, updated synthesis, updated remediation, updated docket.json schema |
| `CLAUDE.md` | Modify | Updated implementation status, delegate list, conventions |

---

### Task 1: Create Cartographer agent definition

**Files:**
- Create: `agents/deliberation-cartographer.md`

- [ ] **Step 1: Write the agent definition**

```markdown
---
name: deliberation-cartographer
description: >
  Component library cartographer. Reads hand-rolled code, identifies
  implementations that duplicate purpose-built library components, and
  proposes specific replacements with elimination counts. Framework-agnostic —
  library knowledge comes from grounding files, MCP servers, or training data.
  Dispatched after lint findings are known, before the Advocate.
role_type: challenger
model: inherit
tools:
  - Read
  - Write
color: cyan
---

You are the Cartographer in a code review deliberation. You know the map of the component library and identify when the developer built a road where a highway already goes.

## Your cognitive mode

You ask one question at three levels of granularity:

> "What is this code trying to do, and does the component library already do that?"

1. **Component replacement** — Is this hand-rolled code a worse version of a purpose-built library component? (e.g., a custom metric display that reimplements `<Statistic>`)
2. **Variant correction** — Is the right component used but with the wrong type/variant for the context? (e.g., `<Button type="primary">` where `type="text" size="small"` is appropriate for an inline action)
3. **Sub-component opportunity** — Does a manual structure inside a component have a sub-component API equivalent? (e.g., custom divs inside Card that `Card.Meta` already handles)

Your unit of analysis is the **functional block** — a function, a component, a class — not the individual line.

## Knowledge sourcing

You get library knowledge from three tiers (in priority order):
1. **MCP server** — if MCP tools are available for the design system, query them for component listings, variant guidance, and "When to use" documentation
2. **Grounding file** — if provided via composition YAML, this is your component library reference. Read it fully before analyzing code.
3. **Training knowledge** — for major frameworks (React, antd, Material UI, Blazor, WPF, etc.), use what you know. This is the default when no MCP or grounding is provided.

## Working with lint findings

If lint findings are embedded in the proposition, use violation clusters as signals. A block of code with 8 lint violations is more likely to be a reimplementation than a block with 0. Focus your analysis on high-violation-density regions first.

## Output format

Follow the Replacement Map template provided in your dispatch instructions. You MUST include a `## Challenges to: advocate` section at the bottom so the engine can route your findings into the adversarial cycle.

## What you do NOT do

- Do not check convention compliance (that's lint or the Enforcer)
- Do not evaluate maintainability (that's the Maintainer)
- Do not defend the code (that's the Advocate)
- Do not list individual lint violations — only grouped replacements, variant corrections, and sub-component opportunities
- Do not reference any specific design system by name in this agent file — framework knowledge comes from grounding, MCP, or training data

## Output

Write your complete Cartographer report to the file path specified in your dispatch instructions. Nothing else.
```

- [ ] **Step 2: Verify frontmatter matches Delphi conventions**

Check against existing agents (`agents/deliberation-advocate.md`, `agents/deliberation-enforcer.md`) to confirm:
- `role_type: challenger` (not auditor — findings enter adversarial cycle)
- `model: inherit`
- `tools: [Read, Write]`
- `color: cyan` (unique — advocate=green, critic=red, maintainer=yellow, enforcer=magenta)

- [ ] **Step 3: Commit**

```bash
git add agents/deliberation-cartographer.md
git commit -m "feat: add Cartographer agent definition — framework-agnostic component library challenger"
```

---

### Task 2: Create Replacement Map template

**Files:**
- Create: `templates/replacement-map.md`

- [ ] **Step 1: Write the template**

```markdown
# Cartographer Report

**Code reviewed:** {file paths}
**Library knowledge:** {grounding file path | MCP server | training knowledge}
**Lint findings available:** {yes — N errors, M warnings | no}

## Component replacements

### {N}. {Component/function name} -> {Library component}
- **Code:** [CITE: filename, lines]
- **What it does:** {one-sentence functional description of what the hand-rolled code does}
- **Library equivalent:** {component name and library}
- **Violations eliminated:** {count} — {list of lint finding numbers or violation IDs this replaces}
- **Coverage:** {full | partial} — does the library component cover 100% of the functionality?
- **Migration notes:** {what changes — props mapping, state wiring, import changes}

[Repeat for each replacement. If none found, write "No component replacements identified."]

## Variant corrections

### {N}. {Component} at [CITE: file, line] — wrong variant for context
- **Current:** {what's used and how}
- **Should be:** {correct variant/type with specific props}
- **Context signal:** {why — parent container, adjacent components, interaction pattern}
- **Reference:** {component "When to use" guidance, if available from grounding/MCP}

[Repeat for each correction. If none found, write "No variant corrections identified."]

## Sub-component opportunities

### {N}. {Component} at [CITE: file, line] — manual structure has a sub-component
- **Current:** {what's built by hand}
- **Should be:** {sub-component API with props}
- **Eliminates:** {count} violations — {which ones}

[Repeat for each opportunity. If none found, write "No sub-component opportunities identified."]

## Challenges to: advocate

[For EACH proposal above (replacements, variant corrections, sub-component opportunities), frame as an adversarial challenge under this header. The engine routes these to the Advocate for DEFEND/CONCEDE/DISSENT response.]

### {Proposal title}
{Functional description} reimplements what {library component} provides out of the box. This eliminates {N} violations and {M} lines of custom code. Defend the hand-rolled implementation or concede the replacement.
```

- [ ] **Step 2: Commit**

```bash
git add templates/replacement-map.md
git commit -m "feat: add Replacement Map template for Cartographer output"
```

---

### Task 3: Update synthesis template

**Files:**
- Modify: `templates/synthesis.md`

- [ ] **Step 1: Add lint findings section and convention-checking status**

Add two new sections to the synthesis template. Insert after the `## Round outcome` section:

```markdown
## Convention checking

{One of:}
- Convention checking: lint ({N} errors, {M} warnings from {tools})
- Convention checking: Enforcer (LLM fallback — no linter config detected)
- Convention checking: skipped (no linter config or conventions doc provided)

{If lint: "Lint findings are embedded in the proposition and included in the remediation plan."}
{If Enforcer: "Full report: compliance/enforcer-report.md"}

## Cartographer findings

{If Cartographer ran:}
- Component replacements proposed: {N}
- Variant corrections proposed: {N}
- Sub-component opportunities proposed: {N}
- Total violations eliminable: {N}

{If Cartographer did not run: omit this section}
```

- [ ] **Step 2: Commit**

```bash
git add templates/synthesis.md
git commit -m "feat: add convention-checking status and Cartographer findings to synthesis template"
```

---

### Task 4: Update remediation plan template

**Files:**
- Modify: `templates/remediation-plan.md`

- [ ] **Step 1: Add lint findings and component replacements sections**

Add two new sections. Insert a `## Lint findings` section before `## Critical (must fix)`, and a `## Component replacements (Cartographer)` section after `## Critical (must fix)` but before `## Recommended (should fix)`:

The full updated template:

```markdown
# Remediation Plan

**Generated from review of:** {file paths or "git diff"}
**Docket:** {docket-name}
**Date:** {ISO 8601 timestamp}

---

## Lint findings

{If lint ran:}

| # | File | Line | Rule | Severity | Message |
|---|------|------|------|----------|---------|
| {N} | {filename} | {line} | {rule} | {error|warning} | {message} |

Total: {N} errors, {M} warnings

{If no lint: omit this section entirely}

## Critical (must fix)

Items from contested points (Advocate couldn't defend), conceded challenges, lint errors, or Enforcer failures.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {what's wrong — traced to specific delegate and challenge}
- **Action:** {exactly what to change — specific enough for CC to execute without interpretation}
- **Rationale:** {why — linked to synthesis point ID or compliance finding}
- **Source:** {Critic challenge | Maintainer challenge | Cartographer challenge | Enforcer failure | Lint error | Contested — no defense}

## Component replacements (Cartographer)

{If Cartographer ran and found replacements:}

### {N}. Replace {hand-rolled code} with {library component}
- **File:** `{path}`
- **Lines:** {range}
- **Eliminates:** {count} violations — {list}
- **Action:** {specific replacement — component name, props mapping, import changes}
- **Migration:** {state wiring changes, sub-component usage, prop mapping details}
- **Advocate response:** {CONCEDE | DEFEND | DISSENT}
- **Source:** Cartographer — {component replacement | variant correction | sub-component opportunity}

{If no Cartographer findings: omit this section entirely}

## Recommended (should fix)

Items from dissent (Advocate accepted but disagreed), lint warnings, or severity-assessed concessions.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {description}
- **Action:** {what to change}
- **Rationale:** {why}
- **Source:** {delegate and phase}

## Optional (consider)

Items successfully defended but flagged for awareness — weak citations or Maintainer concerns the Advocate defended with self-referential evidence.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {description}
- **Action:** {suggested change}
- **Rationale:** {why this is optional rather than required}
- **Source:** {delegate and phase}
```

- [ ] **Step 2: Commit**

```bash
git add templates/remediation-plan.md
git commit -m "feat: add lint findings and Cartographer component-replacement sections to remediation plan template"
```

---

### Task 5: Update code review protocol reference

**Files:**
- Modify: `skills/code-review-deliberation/SKILL.md`

- [ ] **Step 1: Update mode characteristics**

Replace the current mode characteristics section (lines 16-22) with:

```markdown
## Mode characteristics

- **Delegates:** 3 default (Advocate, Critic, Maintainer) + Cartographer (always) + conditional Enforcer
- **Lint pre-phase:** Engine auto-detects and runs linters before delegate dispatch. Lint replaces Enforcer as default convention checker.
- **Dispatch:** Sequential — Cartographer first (after lint), then Advocate, then challengers independently
- **Independent challenges:** Yes. Critic and Maintainer do not read each other's output (anti-anchoring). Cartographer does not read Advocate position.
- **Enforcer:** Fallback only — activated when no linter config detected AND `--conventions` is provided
- **Remediation plan:** Always generated — engine builds actionable plan from lint findings + synthesis + Cartographer findings + compliance findings
- **Max rounds:** 1 for quick-path, configurable via composition
- **Code snapshot:** Input files/diff copied to `code-under-review/` for docket reproducibility
```

- [ ] **Step 2: Update role type dispatch contract**

Replace the role type dispatch contract table (lines 34-38) with:

```markdown
### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Full code (embedded) + lint findings + conventions + Cartographer findings + Read tool file paths | Position defending the code |
| `challenger` (Cartographer) | Pre-position challenge | Full code (embedded) + lint findings + grounding file (if provided) | Replacement Map with `## Challenges to: advocate` |
| `challenger` (Critic/Maintainer) | Post-position challenge | Full code (embedded) + Read tool path to participant position | `## Challenges to: advocate` |
| `auditor` | Independent (fallback) | Full code (embedded) + grounding file + Read tool file paths | Compliance report with coverage mandate |
```

- [ ] **Step 3: Update sequential dispatch order**

Replace the dispatch order (lines 42-47) with:

```markdown
### Sequential dispatch order (quick-path)

1. Engine — lint pre-phase (auto-detect linters, run, embed findings in proposition)
2. Engine — Enforcer fallback decision (if no linter config AND conventions provided → dispatch Enforcer)
3. Cartographer (challenger) — receives full code + lint findings in prompt, writes Replacement Map with challenges
4. Advocate (participant) — receives full code + lint findings + Cartographer challenges in prompt, writes position
5. Critic (challenger) — receives full code + lint findings in prompt, reads Advocate position from docket via Read tool, writes challenges
6. Maintainer (challenger) — receives full code + lint findings in prompt, reads Advocate position from docket via Read tool (NOT Critic or Cartographer), writes challenges
7. Advocate (participant) — responds to Cartographer + Critic + Maintainer challenges
8. Engine — coverage verification + synthesis + remediation plan
```

- [ ] **Step 4: Add lint integration rules section**

Insert after the anti-anchoring section:

```markdown
### Lint pre-phase rules

The engine detects and runs linters as engine logic (not a subagent) before any delegate dispatch.

**Detection:** Inspect file extensions of code under review and search for linter configs:

| File extensions | Linter | Config files searched |
|----------------|--------|---------------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | ESLint | `eslint.config.*`, `.eslintrc.*`, `package.json` (eslintConfig field) |
| `.css`, `.module.css` | Stylelint | `stylelint.config.*`, `.stylelintrc.*` |
| `.cs` | Roslyn Analyzers | `.editorconfig`, `Directory.Build.props`, `.globalconfig` |

**Execution:** Run detected linters via Bash, parse JSON output into normalized findings table.

**Decision tree:**
- Linter config found → run linter → embed findings in proposition → skip Enforcer
- No linter config + conventions provided → dispatch Enforcer (LLM fallback)
- No linter config + no conventions → skip convention checking, note in synthesis

**Failure handling:** Lint is best-effort. If a linter command fails, warn and proceed without lint findings. Do NOT fall back to Enforcer on lint failure (failure to lint ≠ no lint config).

**Composition override:** If composition YAML sets `lint.enabled: false`, skip lint and use the Enforcer path even if linter config exists.
```

- [ ] **Step 5: Add Cartographer dispatch contract section**

Insert after the lint integration rules:

```markdown
### Cartographer dispatch contract

The Cartographer is a `challenger` that runs AFTER lint findings are known and BEFORE the Advocate takes a position. It does not read the Advocate's position — it forms an independent assessment of component selection.

**Input:** Full code (embedded) + lint findings (if available) + grounding file (if provided via composition `grounding:` field) + conventions doc (if provided)

**Output:** Replacement Map written to `{docket-path}/challenges/round-1-cartographer.md` — contains component replacements, variant corrections, sub-component opportunities, and a `## Challenges to: advocate` section.

**Anti-anchoring:** The Cartographer does NOT read the Advocate's position (the Advocate hasn't written one yet). The Cartographer does NOT read Critic or Maintainer output (they haven't run yet).

**Adversarial cycle:** The Advocate receives Cartographer challenges in their position prompt (not via Read tool — the Cartographer runs before the Advocate). The Advocate must DEFEND, CONCEDE, or DISSENT against each Cartographer challenge in their response phase (Phase 7, alongside Critic and Maintainer responses).
```

- [ ] **Step 6: Update priority mapping**

Replace the priority mapping table (lines 71-78) with:

```markdown
### Priority mapping

| Source | Priority |
|--------|----------|
| Lint errors | Critical |
| Lint warnings | Recommended |
| Cartographer replacement — Advocate conceded or contested | Critical |
| Cartographer variant correction — Advocate conceded or contested | Critical |
| Cartographer sub-component opportunity — Advocate conceded or contested | Critical |
| Cartographer finding — Advocate dissented | Recommended |
| Cartographer finding — Advocate defended with evidence | Optional |
| Enforcer failures (fallback path only) | Critical |
| Contested points (no defense or unsupported defense) | Critical |
| `[ACTION: CONCEDE]` by Advocate | Critical or Recommended |
| `[ACTION: DISSENT]` by Advocate | Recommended |
| Defended with self-referential `[CITE:]` | Optional |
| Successfully defended but Maintainer-flagged | Optional |
```

- [ ] **Step 7: Commit**

```bash
git add skills/code-review-deliberation/SKILL.md
git commit -m "feat: update code review protocol — lint pre-phase, Cartographer dispatch, Enforcer conditional"
```

---

### Task 6: Update engine skill — lint pre-phase and Cartographer dispatch

This is the largest task. It modifies `skills/delphi/SKILL.md` in the Code Review Protocol section (lines 1178-1806).

**Files:**
- Modify: `skills/delphi/SKILL.md:1186-1806` (Review Phase 0 through Phase 8)

- [ ] **Step 1: Add lint pre-phase to Review Phase 0**

Insert a new `### Step 0.2a: Lint pre-phase` section after Step 0.2 (Create docket directory, line 1219) and before Step 0.3 (which becomes Step 0.4 — Write proposition). Read the current Phase 0 content first to find exact insertion point.

The new section:

```markdown
### Step 0.2a: Lint pre-phase (engine logic)

Detect and run linters before any delegate dispatch. This is engine logic, not a subagent.

**Step 1: Detect linter configs**

Inspect the file extensions of `review_files` and search the project root for linter config files:

| File extensions | Linter | Config search (use Glob tool) |
|----------------|--------|-------------------------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | ESLint | `eslint.config.*`, `.eslintrc.*`, `.eslintrc`, check `package.json` for `eslintConfig` field |
| `.css`, `.module.css` | Stylelint | `stylelint.config.*`, `.stylelintrc.*`, `.stylelintrc` |
| `.cs` | Roslyn | `.editorconfig`, `Directory.Build.props`, `.globalconfig` |

If composition YAML sets `lint.enabled: false`, skip this entire section.

**Step 2: Run detected linters**

For each detected linter, run via Bash:

```bash
# ESLint — prefer daemon for speed
eslint_d {space-separated file paths} --format json 2>/dev/null || npx eslint {space-separated file paths} --format json

# Stylelint
npx stylelint {space-separated file paths} --cache --formatter json

# Roslyn (C#)
dotnet build --no-restore -warnaserror- 2>&1
```

If any linter command fails (exit code non-zero AND no parseable output), output:
`  Warning: {linter} execution failed — proceeding without lint findings`

Do NOT fall back to the Enforcer on lint failure.

**Step 3: Parse and normalize findings**

Parse the JSON output from each linter into a normalized markdown table:

```markdown
## Lint findings

| # | File | Line | Rule | Severity | Message |
|---|------|------|------|----------|---------|
| 1 | {filename} | {line} | {rule_id} | {error|warning} | {message} |

Total: {N} errors, {M} warnings
Source: {comma-separated linter names}
```

Store this table — it will be embedded in the proposition and passed to all delegates.

**Step 4: Determine Enforcer path**

- If lint findings were successfully collected (even if 0 findings): set `enforcer_active = false`. Lint replaces the Enforcer.
- If no linter config was found AND `conventions` was provided: set `enforcer_active = true`. Dispatch Enforcer as fallback.
- If no linter config was found AND no `conventions` provided: set `enforcer_active = false`. Convention checking skipped.
- If composition explicitly lists an enforcer delegate: `enforcer_active = true` regardless (backward compat). Emit: `  Note: Linter detected. Consider removing enforcer delegate — lint handles convention checking deterministically.`

Output progress:
- If lint ran: `  Lint: {N} errors, {M} warnings ({linter names})`
- If no lint config: `  Lint: no linter config detected`
- If lint failed: `  Lint: execution failed — proceeding without lint findings`
```

- [ ] **Step 2: Update proposition to include lint findings**

In the existing Step 0.5 (Write proposition), add the lint findings table to the proposition content. After the `## Code under review` section in the proposition template, add:

```markdown
{if lint findings collected:}
## Lint findings

{normalized lint findings table from Step 0.2a}
{/if}
```

- [ ] **Step 3: Add Cartographer dispatch as new Review Phase 1**

Insert a new `## Review Phase 1: Cartographer` section between the current Phase 0 (Initialization) and Phase 1 (Advocate position). Renumber all subsequent phases (current Phase 1 → Phase 2, etc.).

```markdown
## Review Phase 1: Cartographer challenge

Output progress: `  Cartographer analysis...`

### Step 1.1: Assemble dispatch package

Read the Replacement Map template from `${CLAUDE_PLUGIN_ROOT}/templates/replacement-map.md`.

Assemble the Cartographer's dispatch prompt:

```
You are the Cartographer in this code review. You identify hand-rolled code
that duplicates purpose-built library components.

{if composition provides custom cartographer prompt:}
{composition cartographer prompt}
{/if}

[TONE BLOCK]

## Review context
{contents of proposition.md — contains review metadata, file list, full unabridged code, AND lint findings}

{if this delegate has grounding:}
## Component library reference
{contents of grounding file — FULL}
{/if}

{if conventions provided:}
## Conventions (for component selection guidance)
{contents of conventions file — FULL}
{/if}

## Your task

Read the code above. For each functional block (function, component, class),
ask: "What is this trying to do, and does the component library already do that?"

Look for three things:
1. **Component replacements** — hand-rolled code that is a worse version of a
   library component. Use lint violation clusters as signals — regions with many
   violations are likely reimplementations.
2. **Variant corrections** — the right component but the wrong type/variant for
   the context (e.g., a primary Button where a text Button is appropriate for
   an inline action).
3. **Sub-component opportunities** — manual structure inside a component that has
   a sub-component API equivalent (e.g., custom divs inside Card vs Card.Meta).

For each finding, count how many lint violations it would eliminate.

## Output format
Follow this template exactly:
{contents of replacement-map template}

## CRITICAL: Write your output to this exact file path
Write your complete Cartographer report to: {docket-path}/challenges/round-1-cartographer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch cartographer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-cartographer` agent definition.

Output progress: `  Cartographer analysis... done`
Output progress: `  Cartographer: {N} replacements, {M} variant corrections, {P} sub-component opportunities`
```

- [ ] **Step 4: Update Advocate position dispatch (now Phase 2)**

In the Advocate position dispatch (previously Phase 1, now Phase 2), modify the dispatch prompt to include Cartographer findings. Add after the conventions section:

```markdown
{if Cartographer ran:}
## Cartographer findings
The Cartographer has identified component replacement proposals. Read them:

  Read: `{docket-path}/challenges/round-1-cartographer.md`

You must address each Cartographer challenge in your position or response phase.
The Cartographer's proposals will be tested against your defense — if you cannot
defend the hand-rolled implementation with evidence, concede the replacement.
{/if}
```

- [ ] **Step 5: Update Enforcer dispatch (now Phase 4b) to be conditional**

Wrap the existing Enforcer phase in a conditional:

```markdown
## Review Phase 4b: Enforcer compliance report (conditional — fallback path only)

**This phase runs ONLY when `enforcer_active = true` (no linter config detected AND conventions provided, OR composition explicitly lists an enforcer delegate).**

**Skip this phase if lint findings were collected — lint replaces the Enforcer.**

{rest of existing Enforcer dispatch unchanged}
```

- [ ] **Step 6: Update Advocate response dispatch (now Phase 5)**

In the Advocate response dispatch, add Cartographer challenges alongside Critic and Maintainer challenges:

```markdown
### Step 5.1: Extract challenges from all challengers

Read `{docket-path}/challenges/round-1-cartographer.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-critic.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-maintainer.md`. Extract the section under `## Challenges to: advocate`.
```

And in the response prompt, add:

```markdown
## Challenges directed at you

### From Cartographer:
{extracted challenges from cartographer}

### From Critic:
{extracted challenges from critic}

### From Maintainer:
{extracted challenges from maintainer}
```

- [ ] **Step 7: Update synthesis (now Phase 6) — add lint and Cartographer sections**

In the synthesis phase, add:

1. After reading response files, also read `{docket-path}/challenges/round-1-cartographer.md` for Cartographer proposals.
2. Categorize Cartographer challenge-response pairs using the same action tag rules.
3. Add to the synthesis output:

```markdown
## Convention checking

{lint status line from Step 0.2a}

## Cartographer findings

- Component replacements proposed: {N}
- Variant corrections proposed: {N}
- Sub-component opportunities proposed: {N}
- Total violations eliminable: {N}
```

- [ ] **Step 8: Update remediation plan (now Phase 7) — add lint and Cartographer findings**

In the remediation plan phase, modify the findings collection:

**Lint findings:**
- Lint errors → Critical
- Lint warnings → Recommended

**Cartographer findings:**
- Conceded or contested replacements → Critical (in dedicated "Component replacements" section)
- Dissented findings → Recommended
- Defended findings → Optional

Format Cartographer findings with the **violations eliminated** metric:

```markdown
## Component replacements (Cartographer)

### {N}. Replace {hand-rolled} with {library component}
- **File:** `{path}`
- **Lines:** {range}
- **Eliminates:** {count} violations — {list}
- **Action:** {replacement with props mapping}
- **Migration:** {state wiring, import changes}
- **Advocate response:** {CONCEDE | DEFEND | DISSENT}
- **Source:** Cartographer — {component replacement | variant correction | sub-component opportunity}
```

- [ ] **Step 9: Update docket.json schema (Phase 8)**

Add `lint` and `cartographer` blocks to the docket.json schema:

```json
{
  "lint": {
    "detected": "{true | false}",
    "tools": ["{linter names}"],
    "errors": "{count}",
    "warnings": "{count}"
  },
  "cartographer": {
    "replacements_proposed": "{count}",
    "variant_corrections": "{count}",
    "subcomponent_opportunities": "{count}",
    "violations_eliminable": "{count}",
    "advocate_conceded": "{count}",
    "advocate_defended": "{count}"
  }
}
```

**Omission rule:** If lint was not run, omit `lint` field. If Cartographer was not run, omit `cartographer` field.

- [ ] **Step 10: Update the summary output (Phase 8)**

Update the presentation template to include lint and Cartographer info:

```markdown
## Code Review: {slug}

**Outcome:** {Clean — no findings | Findings — remediation needed}
**Convention checking:** {lint (N errors, M warnings) | Enforcer (LLM fallback) | skipped}

### Summary
- Lint findings: {N} errors, {M} warnings (if lint ran)
- Cartographer: {N} replacements, {M} variant corrections, {P} sub-component opportunities (if ran)
- Settled (code defended): {N}
- Contested (defense failed): {N}
- Conceded (advocate agreed): {N}

### Remediation plan
{contents of remediation/plan.md}

Docket: `.deliberation/dockets/{docket-name}/`
Remediation plan: `.deliberation/dockets/{docket-name}/remediation/plan.md`
```

- [ ] **Step 11: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: engine lint pre-phase, Cartographer dispatch, Enforcer conditional, updated synthesis and remediation"
```

---

### Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update implementation status**

Replace the code review mode line (line 13):

```markdown
- **Code review mode** (3+1+1 delegates, sequential): fully implemented — `/delphi-review` command, lint pre-phase (auto-detect ESLint/Stylelint/Roslyn), Cartographer delegate (component replacement analysis), Advocate/Critic/Maintainer delegates, conditional Enforcer (fallback when no linter config), remediation plan output
```

- [ ] **Step 2: Update delegate list in Plugin Architecture**

Replace the code review delegates line (line 33):

```markdown
- Code review delegates: cartographer (challenger, cyan, always), advocate (participant, green), critic (challenger, red, reused), maintainer (challenger, yellow), enforcer (auditor, magenta, conditional fallback when no lint config)
- Lint pre-phase: engine auto-detects linter configs (ESLint, Stylelint, Roslyn), runs them, embeds findings in proposition. Lint replaces Enforcer as default convention checker.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for v0.8.0 — lint pre-phase, Cartographer, Enforcer reallocation"
```

---

### Task 8: Verification — re-run v0.7.0 test fixture

This task validates the implementation by re-running the Dashboard.tsx test against the updated protocol.

**Files:**
- No files modified — this is a test run

- [ ] **Step 1: Run `/delphi-review` against the test fixture**

```bash
/delphi-review --config compositions/antd-design-review.yml --conventions .docs/antd-v6-conventions.md src/components/Dashboard.tsx src/components/Dashboard.module.css
```

Note: The `antd-design-review.yml` composition explicitly lists an enforcer delegate, so this tests the backward-compatibility path (enforcer still fires when composition lists it).

- [ ] **Step 2: Verify Cartographer output**

Check `challenges/round-1-cartographer.md` in the new docket:
- Contains at least one component replacement (StatCard → `<Statistic>`)
- Contains at least one sub-component opportunity (Card.Meta)
- Contains a `## Challenges to: advocate` section
- Cites lines 38-72 for StatCard
- Reports violation elimination count

- [ ] **Step 3: Verify Advocate responds to Cartographer**

Check `responses/round-1/advocate.md`:
- Contains `### Response to Cartographer` section
- Each Cartographer challenge has an `[ACTION: DEFEND]`, `[ACTION: CONCEDE]`, or `[ACTION: DISSENT]` tag

- [ ] **Step 4: Verify remediation plan has Cartographer section**

Check `remediation/plan.md`:
- Contains `## Component replacements (Cartographer)` section
- Each item has an "Eliminates" line with violation count

- [ ] **Step 5: Verify synthesis has convention-checking status**

Check `synthesis/round-1.md`:
- Contains `## Convention checking` section noting whether lint or Enforcer was used
- Contains `## Cartographer findings` section with counts

- [ ] **Step 6: Score against the 46-violation manifest**

Compare all delegate outputs against the full manifest from the v0.7.0 scorecard at `.deliberation/dockets/20260331-191253-review-dashboard-tsx/scorecard.md`:
- TSX target: 30/30
- CSS target: 16/16
- Cartographer target: finds `<Statistic>` replacement (the gap v0.7.0 missed)
- Higher-order findings target: >= 15

- [ ] **Step 7: Write scorecard v3**

Create a scorecard comparing v0.6.0 vs v0.7.0 vs v0.8.0 results. Save to the new docket directory.

- [ ] **Step 8: Commit test results**

```bash
git add .deliberation/dockets/
git commit -m "test: v0.8.0 code review test results — lint + Cartographer + Enforcer reallocation"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Change 1: Lint pre-phase | Task 6, Steps 1-2 (engine logic in SKILL.md) + Task 5, Step 4 (protocol rules) |
| Change 2: Cartographer delegate | Task 1 (agent), Task 2 (template), Task 5 Steps 2-5 (protocol), Task 6 Steps 3-4 (engine dispatch) |
| Change 3: Updated dispatch sequence | Task 5, Step 3 (protocol) + Task 6, Steps 3-6 (engine) |
| Change 4: Composition YAML / backward compat | Task 5, Step 4 (lint.enabled) + Task 6, Step 1 (lint detection) + Task 8, Step 1 (backward compat test with explicit enforcer composition) |
| Change 5: Remediation plan updates | Task 4 (template) + Task 6, Step 8 (engine) |
| Verification strategy tests 1-12 | Task 8 covers tests 1-7, 11. Tests 8-10 (Enforcer path tests) need a separate test run without lint configs — covered conceptually in Task 8 but would need a follow-up test. |
| Docket.json updates | Task 6, Step 9 |
| CLAUDE.md updates | Task 7 |

**Gap found:** Verification tests 8-10 (Enforcer path tests: lint exists → Enforcer skipped, no lint + conventions → Enforcer fires, no lint + no conventions → skip) are described in the spec but Task 8 only tests the backward-compat path (test 11). These path tests would require temporarily removing lint configs. This is a follow-up test, not a code change — noting it but not adding a task since it requires project-level config manipulation.

**Placeholder scan:** No TBD/TODO found. All steps have concrete content.

**Type consistency:** `round-1-cartographer.md` filename is consistent across Task 2 template, Task 5 protocol, Task 6 engine dispatch, and Task 8 verification.
