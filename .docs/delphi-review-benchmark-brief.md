# Adversarial multi-agent code review for design system enforcement

A benchmark evaluation of the Delphi deliberation engine against AI-generated design system drift

---

Authors: Stephen Doherty, Claude Opus 4.6
Date: 2026-04-02
Plugin: stolen-fire/delphi v0.9.0
Repository: https://github.com/stolen-fire/delphi

---

## Abstract

AI coding agents write code that drifts from design system conventions. You can tell them not to — "NEVER add inline styles" — and they'll comply about 80% of the time. That ceiling doesn't move. Worse, linters only catch the surface-level stuff (hardcoded colors, `!important` overrides). The expensive violations — picking the wrong component entirely, reimplementing what the library already provides, fighting the layout system with raw divs — those slip through because linters can't reason about what a component library offers.

We tested whether adversarial multi-agent review could close that gap. We pointed Delphi's `/delphi-review` at a deliberately bad Ant Design v6 component (30 known violations across all five categories from Steinle's research), then ran `/delphi-remediate` to fix and re-review in a loop. Three iterations took it from 28 lint errors and 10 hand-rolled components down to 1 false positive lint error and 0 critical findings. The CSS file was deleted entirely — there was nothing left in it.

---

## 1. Introduction

### 1.1 The problem

Ask Claude Code to build a Card component and it'll add `style={{ margin: 0, padding: '12px', borderRadius: '8px' }}` on top of it. Nobody asked for those overrides. They come from training data — millions of examples of developers doing the same thing. The agent is mimicking the most common pattern, which happens to be the wrong one.

Do this enough times and the codebase drifts from the design system. UIs get inconsistent. Accessibility breaks in subtle ways. Every component becomes a snowflake that has to be maintained individually instead of leaning on the library.

### 1.2 Prior work

Matthew Steinle's research report, "Design System Enforcement for AI-Assisted Development" (2026-03-31), is the analysis that motivated this work. The findings that matter most:

Advisory rules hit a ceiling around 80% compliance. Telling the agent "NEVER add inline styles" works most of the time, but past ~150 instructions in a CLAUDE.md file, compliance drops across the board. Long standards documents (700+ lines) can actually make things worse — the agent starts ignoring instructions as context gets crowded.

More importantly, Steinle ranked the five causes of drift by impact, not by how visible they are:

1. Wrong component selection — the agent uses `<div>` instead of `<Card>`, `<button>` instead of `<Button>`. Most common, highest impact.
2. CSS duplicating component props — writing `margin-bottom: 24px` instead of using `<Space size="large">`.
3. Incorrect composition — unnecessary wrapper divs, layout that fights the design system.
4. Hardcoded values instead of tokens — `color: #1677ff` instead of the design token.
5. Inline style overrides — the `style` prop. Most visible, but actually the least frequent.

Linting catches #4 and #5. It cannot catch #1, #2, or #3 — those require understanding what the component library actually offers. Atlassian built 50+ custom ESLint rules for their design system. Shopify has 40+ Stylelint rules. No equivalent exists for Ant Design.

### 1.3 Research question

Can adversarial multi-agent review close the gap that linting can't reach? And can an automated remediation loop take the findings and converge toward clean code without human intervention?

---

## 2. Method

### 2.1 Test artifact

We wrote a `Dashboard.tsx` (271 lines) and `Dashboard.module.css` (75 lines) with 30 violations baked in on purpose, covering all five Steinle categories. Each violation got an inline comment like `[V7] inline style on Card — forbidden pattern 5a` so we could trace what the review caught and what it missed.

| Category | Count | Example violations |
|---|---|---|
| Wrong component selection | 10 | Raw `<div>` for layout, `<button>`, `<img>`, `<input type="date">`, nested divs for progress bar |
| CSS duplicating props | 5 | `display: flex` instead of `<Flex>`, `gap: 16px` instead of `<Space>`, CSS grid instead of `<Row><Col>` |
| Incorrect composition | 4 | Manual card structure instead of `<Card><Statistic>`, wrapper divs, manual form rows instead of `<Form.Item>` |
| Hardcoded tokens | 7 | `#52c41a` (colorSuccess), `#1677ff` (colorPrimary), `12px` borderRadius, `28px` fontSize |
| Inline style overrides | 4 | `style` prop on Card, inline flex on layout divs, hardcoded fontSize |

### 2.2 Enforcement stack

The enforcement layers, from fast/deterministic to slow/semantic:

| Layer | Tool | What it catches |
|---|---|---|
| ESLint | `eslint-plugin-react` + `typescript-eslint` | `style`/`className` props on 55 antd components, raw HTML elements (`<button>`, `<input>`, `<img>`, etc.), internal import paths (`antd/es/*`) |
| Stylelint | `stylelint-config-standard` | `!important`, `.ant-*` selector overrides, hardcoded hex colors |
| Conventions file | 225-line markdown | 60+ component-to-HTML mappings, prop API hierarchy, layout rules, token references, forbidden patterns |
| Composition | `antd-design-review.yml` | 4 delegates: Advocate, Design System Critic (grounded on conventions), Maintainer, Convention Enforcer. Snarky tone. |
| MCP server | `@ant-design/cli` v6 | Live Ant Design component API — delegates can look up props, variants, sub-components |

### 2.3 Review pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    /delphi-review                        │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ Lint      │  │ Cartographer│  │ Advocate/Critic/  │   │
│  │ pre-phase │→ │ analysis    │→ │ Maintainer/       │   │
│  │ (ESLint + │  │ (component  │  │ Enforcer          │   │
│  │ Stylelint)│  │ replacement │  │ (adversarial      │   │
│  │           │  │ proposals)  │  │ challenge-        │   │
│  │           │  │             │  │ response cycle)   │   │
│  └──────────┘  └─────────────┘  └──────────────────┘   │
│                         ↓                                │
│              Synthesis + Remediation Plan                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   /delphi-remediate                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Parse plan   │→ │ Implement    │→ │ Re-review    │  │
│  │ (critical →  │  │ fixes        │  │ (full        │  │
│  │ recommended →│  │ (sequential) │  │ /delphi-     │  │
│  │ optional)    │  │              │  │ review)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                         ↓                                │
│              Loop until clean or max iterations           │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Environment

- Model: Claude Opus 4.6 (1M context)
- Platform: Claude Code CLI on Windows 11
- Plugin: delphi v0.9.0
- Max iterations: 3 (safety valve)

---

## 3. Results

### 3.1 Initial review

Docket: `20260401-221710-review-dashboard-tsx`

| Metric | Value |
|---|---|
| Lint findings | 28 errors (10 ESLint + 18 Stylelint) |
| Cartographer proposals | 8 replacements, 3 variant corrections, 1 sub-component |
| Violations eliminable by Cartographer | 36 |
| Enforcer audit | 25 conventions checked, 22 failed, 63 violation rows |
| Total challenges | 32 |
| Advocate concessions | 23 |
| Advocate defenses | 6 (all with independent code citations) |
| Dissents | 3 |
| Contested (unanswered) | 0 |
| Citation coverage | 346 lines, 100%, 0 gaps |
| Remediation plan | 15 critical, 6 recommended, 3 optional |

Every Steinle category was caught. Here's what caught what:

| Steinle # | Category | What caught it |
|---|---|---|
| 1 | Wrong component selection | Cartographer: 8 component replacements |
| 2 | CSS duplicating component props | Cartographer: 3 variant corrections + Stylelint |
| 3 | Incorrect composition | Cartographer: 1 sub-component + Critic + Maintainer |
| 4 | Hardcoded tokens | Stylelint: 9 hex color errors + Enforcer |
| 5 | Inline style overrides | ESLint: 3 forbid-component-props + Enforcer |

The Cartographer found every semantic violation that linting missed. The Advocate conceded all 11 Cartographer challenges — 100% true positive rate on the semantic layer. Not a single false alarm.

### 3.2 Convergence across three iterations

| Metric | Original | Iter 1 | Iter 2 | Iter 3 (final) |
|---|---|---|---|---|
| Lint errors | 28 | 4 | 2 | 1 (false positive) |
| Enforcer violation rows | 63 | 12 | 8 | ~3 (documented) |
| Hand-rolled components | 10 | 0 | 0 | 0 |
| CSS lines | 74 | 2 | 0 | 0 |
| Critical findings | 15 | 16 | 6 | 0 |
| Recommended | 6 | 3 | 2 | — |
| Optional | 3 | 3 | 1 | 1 (defended) |
| Cartographer proposals | 12 | 4 | 2 | — |
| Advocate concessions | 23 | 16 | 7 | — |
| Advocate defenses | 6 | 7 | 5 | — |
| Dissents | 3 | 5 | 2 | — |
| Total source lines | 346 | 283 | 283 | 291 |

### 3.3 What each iteration looked like

Iteration 1 was demolition. Ten hand-rolled components replaced with Ant Design equivalents in one pass — 86% of lint errors gone, 97% of CSS gone. The CSS module was deleted entirely because there was nothing left in it. `StatCard` became `<Card><Statistic>`, progress bar divs became `<Progress>`, raw `<button>` became `<Button danger>`, layout divs became `<Layout>` components, the CSS grid became `<Row><Col>` with responsive breakpoints, and manual form rows became `<Form.Item>` with `<DatePicker.RangePicker>`.

Iteration 2 found the architecture bugs. The Critic caught a token scope mismatch that would have been invisible until someone tried dark mode: `useToken()` was called outside the `ConfigProvider` scope, so tokens resolved against the parent theme instead of the Dashboard's own. Fixing it required splitting the component into `Dashboard` (owns ConfigProvider) and `DashboardContent` (reads tokens correctly inside it). The Maintainer found type safety issues — `Metric.icon` typed as `string` instead of a union of valid keys, `statusFilter` accepting any string — and flagged dead form fields that collected data but threw it away.

Iteration 3 was polish. Space got a `block` prop instead of `style={{ width: '100%' }}`. Typography.Title's `margin: 0` moved to a ConfigProvider `titleMarginBottom` token. `METRIC_ICONS` was retyped with `as const satisfies` so the type constraint actually works. Three separate definitions of valid statuses were consolidated into one derived `STATUS_OPTIONS`. `fontWeight: 600` became `token.fontWeightStrong`.

### 3.4 What's left

After 3 iterations, 1 optional finding remains: a bare `<div>` wrapping the Typography.Title and Table section. The Advocate defended it as structurally necessary for Space gap control, and the review accepted the defense.

There's also 1 lint false positive (documented with a comment) and ~3 enforcer findings that turned out to be limitations in Ant Design's token system itself — ConfigProvider component tokens don't support token interpolation for pixel values like `headerPadding`, so you're stuck with hardcoded strings there.

---

## 4. Analysis

### 4.1 The Cartographer is the piece that matters

No linter rule can express "this block of code reimplements something the library already provides." The Cartographer can. In the initial review it proposed 12 findings — 8 component replacements, 3 variant corrections, 1 sub-component opportunity — and the Advocate conceded every one. It also used lint violation density as a heuristic: a block of code with 8 lint violations clustered together is probably a reimplementation, not just sloppy styling.

The Cartographer's role evolved across iterations. Round 1: full component replacements (10 found, 10 conceded). Round 2: variant corrections — finer-grained, like "this component prop has a more idiomatic alternative." Round 3: a single finding (Space `block` prop). It sharpened its focus as the obvious problems disappeared.

### 4.2 The Advocate knows when to fold

Across 3 rounds, the Advocate showed good judgment about what was worth defending:
- Conceded every Cartographer challenge in Round 1 (10/10) — the violations were clear-cut
- Defended 5-7 points per round from the Critic and Maintainer, always with code citations
- Dissented on 2-5 points per round — accepting the finding but recording disagreement (e.g., whether ConfigProvider counts as the "token definition site" and is therefore exempt from the hardcoded-values convention)
- Zero contested points across all rounds — every challenge got a response

### 4.3 Findings get more subjective as the code gets cleaner

| Iteration | Character | Examples |
|---|---|---|
| 1 | Clear-cut violations | Wrong component, raw HTML, `!important`, `.ant-*` selectors |
| 2 | Architecture and correctness | Token scope bug, type safety, dead form fields, naming |
| 3 | Polish and opinions | Prop alternatives, token references, derived constants, JSDoc |

This is the shape you'd expect. Early iterations find things everyone would agree on. Later iterations find things reasonable people might disagree about. The dissent mechanism handles this well — the Advocate can say "I accept the finding but I think you're wrong about the severity" and the review records both positions.

### 4.4 The token scope bug was a real catch

The best finding from the whole evaluation wasn't a convention violation — it was a genuine bug. `useToken()` was called in `Dashboard`'s render scope, which is the parent of the `ConfigProvider` on line 164. Tokens resolved against the outer theme, not the Dashboard's own. If anyone added a parent theme override (say, for dark mode), the Dashboard would silently use the wrong colors.

Advisory rules can't catch this. Linters can't express it. Manual reviewers often miss it because the code looks correct on first read. The adversarial model caught it because the Critic and Maintainer evaluated the code from different angles — correctness vs. maintainability — and both independently flagged the same structural issue.

---

## 5. Discussion

### 5.1 What worked

The layered approach caught all five Steinle categories. Linting handled the surface-level stuff. The Cartographer handled the semantic stuff. The adversarial cycle caught real bugs that neither linting nor checklists would find (the token scope mismatch, the dual filter UX conflict, the unwired form).

The remediation loop converged: 15 → 16 → 6 → 0 critical findings across three iterations. The spike from 15 to 16 after Iteration 1 is actually a good sign — it means the review got more granular once the obvious problems were gone.

No CLAUDE.md instructions about Ant Design were used. The composition, conventions file, and lint rules did the enforcement on their own. No advisory ceiling to hit.

### 5.2 Where it fell short

The Playground's own self-assessment was blunt, and it was right about several things:

1. The MCP server was never actually used. The composition specified `mcp: required: true` with 7 tools. Every Cartographer report admitted it fell back to training knowledge. The engine proceeded anyway instead of halting — that's a protocol violation. The one verification mechanism that could ground component selection in live API docs was silently skipped.

2. Variant analysis was shallow. The Cartographer found that antd components should be used. It didn't deeply verify *which variant* of each component fits the context. `Button type="link"` for an action column — is that right, or should it be `type="text"` (Steinle's recommendation for inline actions)? Card with no `size` prop for a dense dashboard grid? Modal with no `destroyOnClose` for a form dialog? Nobody checked.

3. Sub-component usage was barely examined. The MetricCard renders two stacked `<Statistic>` inside a bare `<Card>`. Should the icon + title pattern use `Card.Meta`? Nobody queried the MCP to check what Card sub-components exist.

4. Iterations 2 and 3 drifted toward overrides, which is exactly the trap Steinle warns about. Iteration 1 focused on component selection (#1). Iterations 2 and 3 spent most of their energy on inline styles (#5, #6) — four delegates arguing about whether `Layout style={{ minHeight: '100vh' }}` is a violation. Meanwhile, nobody circled back to validate that the replacements from Iteration 1 used the right variants.

5. Delphi operates at Step 8 of Steinle's pipeline (post-build review), not Step 5 (design-time selection). We caught 10 wrong components after they were coded, then rewrote the file twice to fix them. Prevention would have been cheaper.

6. No accessibility validation. Steinle's Step 6 validates against WCAG 2.2. The default code-review roster has no accessibility delegate.

### 5.3 The honest scorecard

| Steinle cause | Delphi coverage | Quality |
|---|---|---|
| #1 Wrong component | Cartographer | Strong in Iteration 1, absent in 2-3 |
| #2 Wrong variant | Cartographer (partial) | Weak — found presets, missed size/type variants |
| #3 CSS duplicating props | Cartographer + Enforcer | Strong — caught progress bars, flex divs, spacing |
| #4 Incorrect composition | Enforcer + Maintainer | Moderate — caught wrapper divs, missed sub-components |
| #5 Hardcoded tokens | Lint + Enforcer | Strong — systematic coverage |
| #6 Inline overrides | Lint + Enforcer + Critic | Over-indexed — consumed disproportionate review energy |

### 5.4 Other limitations

- Controlled test artifact. Deliberately bad code may not reflect real-world AI generation patterns.
- Single component library. Results are Ant Design-specific. Other libraries need separate benchmarks.
- Cost. Each iteration dispatches 5+ subagents with full code context at Opus pricing. Acceptable for unlimited-token environments, potentially prohibitive otherwise.
- Non-determinism. LLM-driven review. Repeat runs may produce different findings, different severity assessments, different convergence paths.

---

## 6. Conclusion

The pipeline works. Three iterations took a 346-line component with 30 violations down to 291 lines with 0 critical findings. The Cartographer filled the gap that linting can't reach — 10 component replacements in Iteration 1, all conceded, eliminating 36 downstream lint violations in the process.

But "it works" isn't the same as "it works well enough." The Playground's self-assessment exposed real gaps: the MCP server was silently skipped despite being marked required, variant analysis was shallow, sub-component usage was barely examined, and iterations 2-3 drifted into exactly the low-impact override arguments Steinle warns about. The Cartographer is good at "should this be an antd component?" It's not yet good at "is this the right *variant* of that component for this context?"

The remediation executor converges, and that's a solid foundation. But the next version needs to enforce MCP verification, add a variant-focused review pass, and keep later iterations focused on selection quality rather than override hunting.

---

## 7. Artifacts

### 7.1 Test input (before)

| Artifact | Location |
|---|---|
| Dashboard.tsx (30 annotated violations) | `D:\Projects\delphi\src\components\Dashboard.tsx` |
| Dashboard.module.css (16 CSS violations) | `D:\Projects\delphi\src\components\Dashboard.module.css` |
| Ant Design v6 conventions grounding file | `D:\Projects\delphi\.docs\antd-v6-conventions.md` |
| Review composition YAML | `D:\Projects\delphi\compositions\antd-design-review.yml` |
| Component selection pipeline brief | `D:\Projects\delphi\.docs\COMPONENT-SELECTION-PIPELINE-BRIEF.md` |
| Steinle research report | `D:\Projects\delphi\.docs\research-matthew-steinle-code.md` |
| ESLint configuration | `D:\Projects\Playground\eslint.config.mjs` |
| Stylelint configuration | `D:\Projects\Playground\stylelint.config.mjs` |

### 7.2 Test output (after)

| Artifact | Location |
|---|---|
| Dashboard.tsx (convention-native, 291 lines) | `D:\Projects\Playground\src\components\Dashboard.tsx` |
| Dashboard.module.css | Deleted (zero CSS overrides) |

### 7.3 Deliberation dockets

| Docket | Phase | Outcome |
|---|---|---|
| `20260401-221710-review-dashboard-tsx` | Initial review | 15 critical, 6 recommended, 3 optional |
| `20260402-071316-review-dashboard-tsx` | Re-review after Iteration 1 | 16 critical, 3 recommended, 3 optional |
| `20260402-080431-review-dashboard-tsx` | Re-review after Iteration 2 | 6 critical, 2 recommended, 1 optional |

Each docket contains: proposition, code snapshots, delegate positions, challenges, responses, compliance report, synthesis, and remediation plan.

### 7.4 Design specs

| Document | Location |
|---|---|
| `/delphi-review` design spec | `D:\Projects\delphi\docs\superpowers\specs\2026-03-31-delphi-review-design.md` |
| v0.8.0 lint + Cartographer spec | `D:\Projects\delphi\docs\superpowers\specs\2026-04-01-v08-lint-cartographer-design.md` |
| `/delphi-remediate` design spec | `D:\Projects\delphi\docs\superpowers\specs\2026-04-02-delphi-remediate-design.md` |

---

## 8. Future work

Ordered by what the benchmark exposed as most needed:

1. Enforce MCP `required: true`. If the composition says MCP is required and the tools aren't available, the engine should halt, not proceed with unverified training-data claims. This was the biggest gap in the benchmark.

2. Add a variant-focused review pass. The Cartographer finds "wrong component." Nothing systematically asks "right component, wrong variant?" for every usage. That's Steinle's #2, and it's the gap between "uses antd" and "uses antd correctly."

3. Keep later iterations focused on selection, not overrides. After structural fixes land, the next pass should validate that the replacements used the right variants and sub-components, not just hunt for remaining inline styles.

4. Test with CC-generated code. Prompt CC to build a component with the MCP server available, then run `/delphi-review` to see what real-world AI output looks like versus our deliberately bad test file.

5. Integrate into harmonia-pipeline. Add `/delphi-review` and `/delphi-remediate` as pipeline steps, triggered after code generation.

6. Add accessibility delegate. Steinle's Step 6 validates WCAG 2.2. The default roster doesn't cover it.

7. Cross-library benchmarks. Material UI, Chakra, Shadcn — validate the architecture generalizes.

8. Parent docket linking. Each re-review creates an independent docket. A `parent_docket` field would create the audit trail.

---

## References

- Steinle, M. (2026). *Design System Enforcement for AI-Assisted Development.* Research report prepared 2026-03-31. Context: Next.js + Ant Design v6 projects, Claude Code as primary AI agent. Location: `D:\Projects\delphi\.docs\research-matthew-steinle-code.md`
- Ant Design Team. (2026). *Ant Design v6 Documentation.* https://ant.design
- Delphi Plugin. (2026). *stolen-fire/delphi v0.9.0.* https://github.com/stolen-fire/delphi
