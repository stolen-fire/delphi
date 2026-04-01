# Delphi v0.8.0 Design Spec: Lint Pre-Phase + Cartographer Delegate

**Date:** 2026-04-01
**Status:** Draft — pending user review
**Preceded by:** v0.7.0 code review protocol (anti-abbreviation, independent review, coverage verification)
**Motivated by:** v0.7.0 scorecard (46/46 recall but missed `<Statistic>` component replacement), Steinle's Design System Enforcement Research Report, Steinle's Component Selection Pipeline Brief

---

## Problem Statement

Delphi v0.7.0 code review has two architectural problems:

1. **The Enforcer delegate spends ~40K tokens doing what deterministic linters do in 200ms with perfect accuracy.** Every convention violation the Enforcer found in the v0.7.0 test maps to an existing ESLint or Stylelint rule. The "coverage mandate" fix in v0.7.0 was a patch to make the LLM behave more like a linter — a signal to use the linter instead.

2. **No delegate is tasked with identifying hand-rolled code that duplicates existing library components.** Steinle's research ranks design system violations by frequency and impact. The top two — wrong component selection (#1) and wrong variant/type selection (#2) — are what linting fundamentally cannot catch. The v0.7.0 test proved this: no delegate proposed replacing StatCard with antd's `<Statistic>`, the single highest-leverage refactor available.

### The layer reallocation thesis

Deterministic tools should handle deterministic work. LLM tokens should go to what only LLMs can do.

| Work | Right tool | Current tool | Change |
|------|-----------|-------------|--------|
| Convention compliance (tokens, imports, forbidden patterns) | **Linter** (deterministic, ~200ms) | Enforcer (LLM, ~40K tokens, probabilistic) | Replace |
| Component selection analysis ("this hand-rolled code is a worse `<Statistic>`") | **LLM** (requires understanding intent) | Nobody | Add Cartographer |
| Variant/type analysis ("right component, wrong variant for this context") | **LLM** (requires understanding context) | Nobody | Add to Cartographer |
| Sub-component opportunities ("manual div layout has a `Card.Meta` equivalent") | **LLM** (requires composition knowledge) | Enforcer (partially) | Move to Cartographer |

---

## Constraints

- Delphi is a pure Markdown/YAML Claude Code plugin — no build step, no runtime dependencies it can guarantee
- Linters are the **user's** tooling, not Delphi's. The engine can invoke them but cannot install them
- Must remain backward-compatible with existing v0.7.0 compositions
- The Cartographer must be **framework-agnostic** — works for any design system (antd, Material UI, WPF, Blazor, etc.) without Delphi ever referencing a specific framework in its own code
- The Cartographer must work without MCP or component manifests (training knowledge default), getting better with them
- Must support JS/TS (ESLint/Stylelint) and C# (Roslyn/.editorconfig) lint detection initially

---

## Change 1: Lint Pre-Phase (Engine Logic)

### Detection

The engine inspects file extensions of the code under review and searches for linter configs:

| File extensions | Linter | Config files searched |
|----------------|--------|---------------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | ESLint | `eslint.config.*`, `.eslintrc.*`, `package.json` (eslintConfig field) |
| `.css`, `.module.css` | Stylelint | `stylelint.config.*`, `.stylelintrc.*` |
| `.cs` | Roslyn Analyzers | `.editorconfig`, `Directory.Build.props`, `.globalconfig` |

### Execution

If linter config found, the engine runs linters via Bash and parses output:

```bash
# JS/TS — prefer eslint_d daemon for speed, fall back to npx
eslint_d {files} --format json 2>/dev/null || npx eslint {files} --format json

# CSS
npx stylelint {files} --cache --formatter json

# C# — capture analyzer diagnostics from build
dotnet build --no-restore -warnaserror- 2>&1
```

### Normalized output

Lint findings are parsed into a standard markdown table embedded in the proposition:

```markdown
## Lint findings

| # | File | Line | Rule | Severity | Message |
|---|------|------|------|----------|---------|
| 1 | Dashboard.tsx | 4 | no-restricted-imports | error | Import from "antd" directly |
| 2 | Dashboard.module.css | 32 | declaration-no-important | error | Unexpected !important |
...

Total: {N} errors, {M} warnings
```

All delegates see this table. The Cartographer specifically uses it to identify violation clusters.

### Failure handling

Lint is best-effort. If the linter command fails (not installed, wrong version, config error), the engine:
1. Warns: `Warning: {linter} execution failed — {error message}`
2. Proceeds without lint findings
3. Does NOT fall back to the Enforcer automatically (failure to lint is not the same as having no lint config)

### Decision tree

```
Linter config exists?
  YES → Run linter → Embed findings → Skip Enforcer
  NO  → Conventions doc provided?
          YES → Dispatch Enforcer (LLM fallback)
          NO  → Skip convention checking entirely, note gap in synthesis
```

---

## Change 2: The Cartographer Delegate

### Identity

| Field | Value |
|-------|-------|
| **Name** | `deliberation-cartographer` |
| **Role type** | `challenger` |
| **Color** | `cyan` |
| **Model** | `inherit` |
| **Tools** | `Read`, `Write` |

The Cartographer is a **challenger**, not an auditor. Its findings enter the adversarial cycle — the Advocate must DEFEND, CONCEDE, or DISSENT against each proposal. This is deliberate: component replacement proposals are hypotheses that should be stress-tested ("Does `<Statistic>` actually cover all the StatCard functionality?").

### Cognitive mode

The Cartographer asks one question at three levels of granularity:

> **"What is this code trying to do, and does the component library already do that?"**

1. **Component replacement** (Steinle #1) — "This hand-rolled 30-line StatCard is a worse version of `<Statistic>`."
2. **Variant correction** (Steinle #2) — "This uses `<Button>` but with the wrong type for this context — should be `type="text" size="small"` for an inline table action."
3. **Sub-component opportunity** (Steinle #3/4) — "This manual div layout inside Card has a `Card.Meta` equivalent."

The unit of analysis is the **functional block** — a function, a component, a class, a pattern — not the individual line or violation.

### Framework-agnostic knowledge sourcing

The Cartographer gets library knowledge through Delphi's existing extensibility mechanisms, not through framework-specific plugin code. **Delphi never references any specific design system in its own source.**

Three tiers, in priority order:

**Tier 1: MCP server (richest, real-time)**
The user's own `.mcp.json` configuration. If an MCP server provides component listing, documentation, and variant guidance (e.g., antd's official `@ant-design/cli` MCP, or any other design system's MCP), the Cartographer queries it via its tool access. This is the user's MCP setup, not Delphi's.

**Tier 2: Grounding file (static, works for any library)**
A component catalog document referenced via `grounding:` in the composition YAML. Examples:
- An antd component catalog with variant tables
- A .NET MAUI controls reference
- A WPF control library doc
- A custom internal component library manifest
- Steinle's Component Selection Pipeline Brief

**Tier 3: Training knowledge (zero-config default)**
The model knows React, antd, Material UI, Bootstrap, Blazor, WPF, WinForms, SwiftUI, etc. from training data. Works out of the box for major frameworks. Less precise on variants, but catches the big component replacements.

### Dispatch timing

After lint (Phase 0), before Advocate (Phase 2). The Cartographer sees:
- Full unabridged code
- Lint findings (if available) — violation clusters signal where to look
- Conventions doc (if provided) — for component selection guidance
- Its grounding file (if provided) — the component library reference

### Output format — the Replacement Map

```markdown
# Cartographer Report

## Component replacements

### 1. {Component/function name} -> {Library component}
- **Code:** [CITE: filename, lines]
- **What it does:** {one-sentence functional description}
- **Library equivalent:** {component name, from which library}
- **Violations eliminated:** {count} — {list of lint finding IDs this replaces}
- **Coverage:** {full | partial} — does the library component cover 100% of the functionality?
- **Migration notes:** {what changes — props mapping, state wiring, import changes}

## Variant corrections

### 1. {Component} at [CITE: file, line] — wrong variant for context
- **Current:** {what's used and how}
- **Should be:** {correct variant/type with specific props}
- **Context signal:** {why — parent container, adjacent components, interaction pattern}
- **Reference:** {component "When to use" guidance, if available from grounding/MCP}

## Sub-component opportunities

### 1. {Component} at [CITE: file, line] — manual structure has a sub-component
- **Current:** {what's built by hand}
- **Should be:** {sub-component API with props}
- **Eliminates:** {count} violations — {which ones}

## Challenges to: advocate

For each proposal above, frame as an adversarial challenge:

### {Proposal title}
{Functional description of what the code does} reimplements what {library component}
provides out of the box. This eliminates {N} violations and {M} lines of custom code.
Defend the hand-rolled implementation or concede the replacement.
```

The `## Challenges to: advocate` section is required — it's how the engine routes Cartographer findings into the existing challenge-response cycle without special-casing.

### What the Cartographer does NOT do

- Does not check convention compliance (that's lint or Enforcer)
- Does not evaluate maintainability (that's the Maintainer)
- Does not defend the code (that's the Advocate)
- Does not list individual violations — only grouped replacements, variant corrections, and sub-component opportunities
- Does not reference any specific design system in its agent definition — framework knowledge comes from grounding, MCP, or training data

---

## Change 3: Updated Dispatch Sequence

### v0.8.0 code review protocol (default roster, no composition)

```
Phase 0a: Lint pre-phase (engine runs linters, deterministic, ~200ms)
Phase 0b: Enforcer fallback (only if: no linter config detected AND --conventions provided)
Phase 1:  Cartographer (reads code + lint findings, identifies component replacements/variants/sub-components)
Phase 2:  Advocate (defends code against Cartographer findings + lint/enforcer findings)
Phase 3:  Critic (independent challenge — reads Advocate position via Read tool after independent assessment)
Phase 4:  Maintainer (independent challenge — reads Advocate position via Read tool after independent assessment)
Phase 5:  Advocate response (responds to Cartographer + Critic + Maintainer challenges)
Phase 6:  Synthesis + coverage verification + remediation plan
```

### Changes from v0.7.0

| v0.7.0 | v0.8.0 | Reason |
|--------|--------|--------|
| Enforcer as default convention checker | Lint pre-phase replaces Enforcer | Deterministic tools for deterministic work |
| No component selection analysis | Cartographer (Phase 1) | Fills Steinle's #1 gap |
| Advocate defends against Critic + Maintainer | Advocate defends against Cartographer + Critic + Maintainer | Cartographer findings enter adversarial cycle |
| Enforcer always runs with conventions | Enforcer only runs when no linter detected | Fallback for prose-only conventions |

### Explicit path: no lint AND no conventions

If the engine detects no linter config AND no `--conventions` flag is provided: skip convention checking entirely. Proceed with Cartographer + Advocate + Critic + Maintainer. The synthesis notes: `Convention checking: skipped (no linter config or conventions doc provided)`.

---

## Change 4: Composition YAML and Backward Compatibility

### New optional fields

```yaml
name: my-review
mode: code-review
tone: snarky

lint:
  enabled: true          # default: true (auto-detect and run)
  # enabled: false       # force skip lint, use Enforcer even if linter config exists

cartographer:
  enabled: true          # default: true

delegates:
  - role: cartographer
    role_type: challenger
    grounding: ".docs/component-catalog.md"    # optional — any design system reference
    prompt: >
      This project uses Ant Design v6. When identifying component
      replacements, check variant/type selection against the grounding
      file. Focus on components that eliminate clusters of lint violations.

  - role: advocate
    # ...
  - role: design_system_critic
    # ...
  - role: maintainer
    # ...
```

### Backward compatibility rules

1. A v0.7.0 composition with an explicit `enforcer` delegate and `--conventions` still works — the Enforcer fires as before. Lint only replaces the Enforcer in the **default roster** (no composition).
2. If a composition explicitly lists an enforcer delegate AND the project has lint config, the engine emits: `Note: Linter detected. Consider removing enforcer delegate — lint handles convention checking deterministically.`
3. The Cartographer runs in the default roster regardless of composition unless `cartographer.enabled: false`.
4. `lint.enabled: false` in composition forces the Enforcer path even if a linter exists — escape hatch for teams that don't trust their lint config.
5. A composition can list the Cartographer with a custom `prompt` and `grounding` to specialize it for their design system.

---

## Change 5: Remediation Plan Updates

### Priority mapping (v0.8.0)

| Source | Priority |
|--------|----------|
| Lint errors | Critical |
| Lint warnings | Recommended |
| Cartographer replacement — Advocate conceded | Critical |
| Cartographer replacement — Advocate couldn't defend (contested) | Critical |
| Cartographer variant correction — Advocate conceded | Critical |
| Cartographer sub-component opportunity — Advocate conceded | Critical |
| Cartographer finding — Advocate dissented | Recommended |
| Cartographer finding — Advocate defended with evidence | Optional (awareness) |
| Enforcer failures (fallback path only) | Critical |
| Critic/Maintainer challenges — Advocate conceded | Critical |
| Critic/Maintainer challenges — contested | Critical |
| Critic/Maintainer challenges — Advocate dissented | Recommended |
| Critic/Maintainer challenges — defended with self-referential cite | Optional |

### Component replacement section in remediation plan

Cartographer findings get a dedicated section with the key metric — **violations eliminated**:

```markdown
## Component replacements (Cartographer)

### 1. Replace StatCard with <Statistic>
- **File:** `src/components/Dashboard.tsx`
- **Lines:** 38-72
- **Eliminates:** 8 violations (V11, V12, V13, V14, V15, V9, V7, V10)
- **Action:** Replace StatCard body with <Card><Statistic title={...} value={...} prefix={...} /></Card>
- **Migration:** Map metric.title -> title prop, metric.value -> value prop, metric.change -> suffix
- **Advocate response:** CONCEDE
- **Source:** Cartographer — component replacement
```

### Docket.json additions

```json
{
  "lint": {
    "detected": true,
    "tools": ["eslint", "stylelint"],
    "errors": 42,
    "warnings": 3
  },
  "cartographer": {
    "replacements_proposed": 2,
    "variant_corrections": 1,
    "subcomponent_opportunities": 1,
    "violations_eliminable": 12,
    "advocate_conceded": 3,
    "advocate_defended": 1
  }
}
```

---

## Impact Analysis

| File | Change |
|------|--------|
| `skills/delphi/SKILL.md` | Add lint pre-phase logic, Cartographer dispatch, Enforcer conditional, revised synthesis |
| `skills/code-review-deliberation/SKILL.md` | Updated dispatch order, new role type contract for Cartographer, lint integration rules |
| `agents/deliberation-cartographer.md` | **New file** — agent definition |
| `templates/replacement-map.md` | **New file** — Cartographer output template |
| `templates/remediation-plan.md` | Add component-replacement section |
| `templates/synthesis.md` | Add lint findings section |
| `CLAUDE.md` | Update implementation status, delegate list, conventions |

Existing compositions, commands, tones, and other agents are **not modified**.

---

## Verification Strategy

### Must-pass tests (re-run v0.7.0 fixture)

1. **Recall preserved:** 46/46 violations still found (lint catches what Enforcer caught)
2. **Cartographer finds `<Statistic>`:** Proposes replacing StatCard with `<Statistic>`, cites lines 38-72, reports elimination count
3. **Cartographer finds variant issues:** Identifies the raw `<button>` should be `<Button danger type="text" size="small">` (or notes the existing `type="link" size="small"` on "View" as correct variant selection)
4. **Cartographer finds sub-component gap:** Proposes `Card.Meta` for the manual div structure inside StatCard
5. **Advocate responds:** Receives Cartographer challenges, responds with action tags
6. **Lint findings in proposition:** Normalized table visible to all delegates
7. **Remediation plan has replacement section:** With "eliminates N violations" metric

### Path tests

8. **Lint exists, Enforcer skipped:** With ESLint/Stylelint configs present, confirm Enforcer does NOT dispatch
9. **No lint, conventions provided:** Remove lint configs, provide `--conventions`, confirm Enforcer fires as fallback
10. **No lint, no conventions:** Confirm convention checking skipped, Cartographer still runs
11. **v0.7.0 composition backward compat:** Run `antd-design-review.yml` composition (which lists an enforcer delegate), confirm it still works

### Token budget test

12. **Net token cost decreased:** The lint path (Cartographer ~25K + no Enforcer) should cost less than v0.7.0 (Enforcer ~40K + no Cartographer)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lint invocation failures (not installed, wrong version) | Low | Best-effort — warn and proceed without lint findings, don't block review |
| Cartographer hallucinating components | Medium | Adversarial cycle — Advocate should catch false proposals and DEFEND |
| Cartographer missing components (no improvement over v0.7.0) | Medium | Test against known fixture; if `<Statistic>` not found, the prompt needs tuning |
| Framework-agnostic Cartographer is too vague without grounding | Low | Training knowledge covers major frameworks; grounding/MCP make it precise |
| Backward-incompatible for Enforcer-dependent compositions | Low | Enforcer preserved — only skipped in default roster when lint available |

---

## Staff-Engineer Review Findings (incorporated)

| # | Finding | Resolution |
|---|---------|------------|
| A | Cartographer output needs `## Challenges to: advocate` for engine routing | Added to output format — Cartographer writes challenges section below Replacement Map |
| B | "No lint + no conventions" path not stated explicitly | Added explicit path: skip convention checking, proceed with Cartographer + core delegates |
| C | Missing verification for "lint exists -> Enforcer skipped" and backward compat | Added test cases #8, #9, #10, #11 to verification strategy |

---

## Design Provenance

This spec was produced through a structured brainstorming process. Key decisions and their rationale:

| Decision | Choice | Why |
|----------|--------|-----|
| Scope | Design-system component selection | Steinle's #1 gap; linting can't catch it |
| Enforcer replacement | Lint as pre-phase | 40K tokens for what 8 lint rules do in 200ms |
| MCP access | Training default, MCP/grounding optional | Works zero-config; gets better with configuration |
| Dispatch timing | After lint, before Advocate | Findings must enter adversarial cycle |
| Name | Cartographer | "Knows the map — identifies when you built a road where a highway already goes" |
| Framework coupling | None — framework-agnostic | Grounding files + MCP + training, not hardcoded references |
| Variant selection | Included in Cartographer scope | Same cognitive mode as component selection; Steinle's #2 violation |
| Approach | Lint + Cartographer + Enforcer preserved as opt-in | Right tool for each job; graceful degradation |
| Cartographer role_type | challenger (not auditor) | Findings should be adversarially tested, not rubber-stamped |

**Source research:**
- Steinle, Design System Enforcement Research Report (`.docs/research-matthew-steinle-code.md`)
- Steinle, Component Selection Pipeline Brief (`.docs/COMPONENT-SELECTION-PIPELINE-BRIEF.md`)
- Ant Design conventions (`.docs/antd-v6-conventions.md`)
- v0.7.0 scorecard (`.deliberation/dockets/20260401-120000-review-dashboard-tsx/scorecard.md`)
- Ant Design official MCP docs (https://ant.design/docs/react/mcp) — two servers: official `@ant-design/cli` (7 tools + 2 prompts) and community `@jzone-mcp/antd-components-mcp` (4 tools)
