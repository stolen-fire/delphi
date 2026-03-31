# `/delphi-review` — Adversarial Code Review Command

> Design spec for a general-purpose code review command in the Delphi plugin. Three delegates with orthogonal perspectives (Advocate, Critic, Maintainer), a conditional fourth (Enforcer) when conventions are provided, and a remediation plan output that CC can execute directly.
>
> Approved 2026-03-31. Origin: research on design system enforcement gaps that linting cannot catch (`.docs/research-matthew-steinle-code.md`).

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Design principles](#design-principles)
3. [Command surface](#command-surface)
4. [Delegate architecture](#delegate-architecture)
5. [Agent definitions](#agent-definitions)
6. [Agent role type taxonomy](#agent-role-type-taxonomy)
7. [Dispatch flow](#dispatch-flow)
8. [Docket output structure](#docket-output-structure)
9. [Remediation plan](#remediation-plan)
10. [Engine integration](#engine-integration)
11. [Composition support](#composition-support)
12. [delphi-compose extension](#delphi-compose-extension)
13. [Future: project-specific configuration workflow](#future-project-specific-configuration-workflow)
14. [What this does NOT do](#what-this-does-not-do)

---

## Problem statement

AI coding agents generate code that *works* but doesn't *fit*. Deterministic linters catch surface violations (inline styles, hardcoded colors, banned selectors), but the highest-impact violations are semantic: wrong component selection, incorrect composition patterns, CSS that duplicates component props, unnecessary abstractions, fragile assumptions. These require judgment, not pattern matching.

The mitigation column in the research gap analysis says "code review" for every semantic violation. Delphi's adversarial structure — forcing structured disagreement before commitment — is designed to surface exactly this kind of judgment-dependent problem.

**Scope boundary:** `/delphi-review` reviews *existing code*. For proactive deliberation on an *approach* before writing code, use `/delphi`. Clean separation, no overlap.

---

## Design principles

1. **General-purpose first.** The command reviews any code against any conventions. Design system compliance is one configuration, not a special mode.
2. **Orthogonal lenses.** Each delegate covers an axis the others don't: correctness (Critic), intent (Advocate), livability (Maintainer), compliance (Enforcer).
3. **Anti-anchoring.** Challengers do not read each other's output. Independent findings that converge are a strong signal.
4. **Actionable output.** The review produces a remediation plan with specific file paths, line numbers, and actions — not a document to interpret, but a plan CC can execute.
5. **Conditional complexity.** 3 delegates by default. The 4th (Enforcer) activates only when conventions are provided. No ceremony for simple reviews.

---

## Command surface

### Invocation patterns

```
/delphi-review src/Foo.tsx                                # Single file
/delphi-review src/components/*.tsx                       # Glob
/delphi-review --diff                                     # Staged git diff
/delphi-review --diff HEAD~3                              # Diff against ref
/delphi-review --conventions RULES.md src/*.tsx            # With conventions (activates Enforcer)
/delphi-review --config review.yml src/*.tsx               # Full composition
/delphi-review --tone snarky src/Foo.tsx                   # With tone
/delphi-review                                            # Display usage help
```

### Argument parsing

| Element | Rule |
|---|---|
| Positional args (not flags) | File paths or globs — resolved via Glob |
| `--diff [ref]` | Run `git diff` (staged by default, or against ref). Review artifact is the diff + full content of changed files |
| `--conventions <path>` | Grounding file for the Enforcer delegate. Activates the 4th delegate. |
| `--config <path>` | Full composition YAML. Overrides the hardcoded delegate roster. Positional file args still define the code to review. |
| `--tone <name>` | Tone injection, same as `/delphi` |
| No arguments | Display usage help and exit |

### Input assembly

The command reads all target files/diff and assembles them into a single review artifact with clear file-path headers. For diffs, both the raw diff and full content of changed files are included — delegates need context, not just the delta.

---

## Delegate architecture

### Quick-path roster (3 delegates, no composition)

| # | Delegate | Perspective | Structural role |
|---|---|---|---|
| 1 | **Advocate** | "This code is sound. Here's what it does and why." | Participant — defends the code |
| 2 | **Critic** | "What's wrong, fragile, or unjustified?" | Challenger — attacks correctness and robustness |
| 3 | **Maintainer** | "I'm inheriting this in 6 months. Can I understand it?" | Challenger — attacks comprehensibility and livability |

### Conditional 4th delegate (when `--conventions` is provided)

| # | Delegate | Perspective | Structural role |
|---|---|---|---|
| 4 | **Enforcer** | "Here are the rules. Does this code follow them?" | Auditor — produces a compliance report, not challenges |

### Why these four

- **Advocate vs. Critic** mirrors a real code review: the author explains intent, a senior reviewer challenges the approach.
- **Maintainer** covers the axis neither touches: "this works and it's correct, but I'd be scared to modify it."
- **Enforcer** doesn't argue — conventions are either followed or they aren't. Adversarial debate over a rule violation is theater. The Enforcer produces a factual appendix.

---

## Agent definitions

### `agents/deliberation-advocate.md`

- **role_type:** `participant`
- **model:** `inherit`
- **tools:** `Read`, `Write`
- **color:** `green`
- **Behavior:** Reads code under review (+ conventions if provided). Explains what the code does and defends the implementation choices. Uses `[CITE: filename, line]` markers pointing to actual code. In the response phase, responds to both Critic and Maintainer challenges using `[ACTION: DEFEND/CONCEDE/DISSENT]` markers.

### `agents/deliberation-maintainer.md`

- **role_type:** `challenger`
- **model:** `inherit`
- **tools:** `Read`, `Write`
- **color:** `yellow`
- **Behavior:** Reads code under review + Advocate's position. Does NOT read Critic's challenges (anti-anchoring). Produces structured challenges using `## Challenges to: advocate` headers. Focuses on: naming clarity, abstraction quality, coupling/cohesion, hidden complexity, "what happens when requirements change?"

### `agents/deliberation-enforcer.md`

- **role_type:** `auditor`
- **model:** `inherit`
- **tools:** `Read`, `Write`
- **color:** `magenta`
- **Behavior:** Reads code under review + conventions grounding file. Produces a compliance report — each convention checked systematically: pass/fail/not-applicable with `[CITE:]` markers. Does NOT participate in the challenge-response cycle.

### Existing agents

- **`deliberation-critic.md`** — reused as-is. The dispatch prompt specializes it for code review context. `role_type: challenger` added to frontmatter.
- **`deliberation-proposer.md`** — unchanged, not used by `/delphi-review`. `role_type: participant` added to frontmatter.
- **`deliberation-chair.md`** — unchanged, only used in standard mode compositions. `role_type: facilitator` added to frontmatter.

---

## Agent role type taxonomy

All Delphi agents now declare a `role_type` in frontmatter. This is the dispatch contract — it tells the engine what inputs the agent expects and what shape of output it produces.

| Role type | Engine dispatch behavior | Expects to read | Output shape |
|---|---|---|---|
| `participant` | Dispatched in position phase. Expected to respond in response phase with `[ACTION:]` markers. | Proposition/code + input artifacts + grounding | Position document |
| `challenger` | Dispatched in challenge phase. Output routed to participants for response. | Proposition/code + participant positions + grounding | `## Challenges to: {role}` structured challenges |
| `auditor` | Dispatched independently. Output appended to docket, not routed through challenge-response. | Raw artifacts + grounding file | Compliance/audit report |
| `facilitator` | Dispatched for framing and decision writing. Procedural authority only. | All docket artifacts | `proposition.md` and `decision.md` |

This taxonomy applies retroactively to all existing agents and governs all future agents.

---

## Dispatch flow

### Without `--conventions` (3 delegates)

```
Phase 1: Advocate writes position         (reads code)
Phase 2: Critic writes challenges          (reads code + advocate position)
Phase 3: Maintainer writes challenges      (reads code + advocate position, NOT critic)
Phase 4: Advocate writes responses         (responds to BOTH challenge sets)
Phase 5: Engine performs synthesis          (mechanical — parses action markers)
Phase 6: Engine generates remediation plan (from synthesis findings)
Phase 7: Engine finalizes docket           (docket.json, summary output)
```

### With `--conventions` (4 delegates)

```
Phase 1: Advocate writes position           (reads code + conventions)
Phase 2: Critic writes challenges            (reads code + advocate position)
Phase 3: Maintainer writes challenges        (reads code + advocate position, NOT critic)
Phase 4: Enforcer writes compliance report   (reads code + conventions only, independent)
Phase 5: Advocate writes responses           (responds to Critic + Maintainer challenges)
Phase 6: Engine performs synthesis            (mechanical + compliance report appended)
Phase 7: Engine generates remediation plan   (from synthesis + compliance findings)
Phase 8: Engine finalizes docket             (docket.json, summary output)
```

All dispatch is sequential. The Critic and Maintainer have no data dependency (both read only the Advocate's position), so they *could* be parallelized — but sequential dispatch keeps token cost predictable and matches the lightweight protocol pattern. Parallelization is a future optimization if review latency becomes a concern.

---

## Docket output structure

```
.deliberation/dockets/{timestamp}-review-{slug}/
  docket.json
  proposition.md
  code-under-review/          # Snapshot of reviewed files or diff
    {filename}                #   Copied source files
    diff.patch                #   Or git diff output (--diff mode)
  positions/round-1/
    advocate.md
  challenges/
    round-1-critic.md
    round-1-maintainer.md
  responses/round-1/
    advocate.md
  compliance/                 # Only when --conventions used
    enforcer-report.md
  synthesis/
    round-1.md
  remediation/
    plan.md                   # Actionable modification plan for CC
```

### `code-under-review/` directory

Stores a snapshot of the input so the docket is self-contained and reproducible. If the source files change later, the docket still records exactly what was reviewed.

### `docket.json` extension

```json
{
  "mode": "code-review",
  "review_target": {
    "type": "files | diff",
    "paths": ["src/components/Dashboard.tsx"],
    "diff_ref": "HEAD~3",
    "conventions": "CONVENTIONS.md"
  }
}
```

The `mode: "code-review"` field allows `/delphi-observe` to render review dockets differently from deliberation dockets.

---

## Remediation plan

`remediation/plan.md` is the actionable output of the review. Generated by the engine (not a subagent) from the synthesis and compliance report.

### Structure

```markdown
# Remediation Plan

Generated from review of: {file paths}
Docket: {docket-name}

## Critical (must fix)

### 1. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {what's wrong — traced to delegate + challenge}
- **Action:** {exactly what to change — specific enough for CC to execute}
- **Rationale:** {why — linked to synthesis point or compliance finding}

## Recommended (should fix)

### 2. ...

## Optional (consider)

### 3. ...
```

### Priority mapping

| Source | Priority |
|---|---|
| Contested points (Advocate couldn't defend) | Critical |
| `[ACTION: CONCEDE]` by Advocate | Critical or Recommended (by severity) |
| Enforcer failures (convention violation) | Critical |
| `[ACTION: DISSENT]` by Advocate | Recommended |
| Defended with self-referential `[CITE:]` (flagged in synthesis) | Optional |
| Successfully defended but flagged by Maintainer | Optional |

### Constraint

Every item must have a specific **File + Lines + Action** triple. The engine traces each finding back to concrete code locations using `[CITE:]` markers from the delegates. Vague findings without code references are not included.

---

## Engine integration

### New protocol: Code Review Protocol

Added to `skills/delphi/SKILL.md` alongside Lightweight Protocol and Standard Protocol.

**Mode determination (updated Step 0.1):**

| Condition | Protocol |
|---|---|
| Inline question, no `--config` | Lightweight |
| `--config` with `mode: lightweight` | Lightweight |
| `--config` with `mode: standard` | Standard |
| Invoked from `/delphi-review` (no `--config`) | Code Review |
| `--config` with `mode: code-review` | Code Review |

**What the Code Review Protocol defines:**
- Phase 0: Initialization — create docket, snapshot code to `code-under-review/`, auto-generate proposition ("Review the following code for quality, correctness, and maintainability")
- Phases 1-4/5: Delegate dispatch (see Dispatch flow above)
- Synthesis phase: Mechanical parsing of action markers (same categorization table as existing protocols)
- Remediation phase: Engine builds plan from synthesis + compliance findings
- Finalization: Write `docket.json`, output summary

**What stays the same:**
- Docket creation pattern
- Action marker parsing and categorization table
- Tone injection pattern
- Dispatch safety rule (verify output files after each subagent)
- Lightweight and Standard protocols — unchanged

---

## Composition support

### `mode: code-review` in compositions

Compositions can declare `mode: code-review` to use the Code Review Protocol with a custom delegate roster.

Each delegate in a code-review composition declares a `role_type` that tells the engine the dispatch pattern:

```yaml
name: design-system-review
mode: code-review

delegates:
  - role: advocate
    role_type: participant
    prompt: >
      Defend the implementation choices...

  - role: design_system_critic
    role_type: challenger
    capabilities: [challenge_all]
    grounding: "./conventions/design-system-rules.md"
    prompt: >
      Challenge component selection, composition patterns...

  - role: maintainer
    role_type: challenger
    prompt: >
      Read this code as someone inheriting it in 6 months...

  - role: token_enforcer
    role_type: auditor
    grounding: "./conventions/design-tokens.md"
    prompt: >
      Systematically check every style value against the token list...

rules:
  max_rounds: 2
  independent_positions: true
  require_dissent_record: true
  human_deferral: false
```

### Engine routing by `role_type`

- `participant` delegates → dispatched in position phase, respond in response phase
- `challenger` delegates → dispatched in challenge phase, output routed to participants
- `auditor` delegates → dispatched independently, report appended to docket
- `facilitator` delegates → dispatched for framing/decision (standard compositions that use `mode: code-review` with a Chair)

---

## `/delphi-compose` extension

`/delphi-compose` recognizes code review as a deliberation type. When the user's decision description indicates code review:

1. Ask whether this is a code review or a decision deliberation
2. If code review: generate a `mode: code-review` composition
3. Propose delegates using `role_type` to determine dispatch pattern

### New panel inference archetypes for code review

| Review concern | Delegate archetype | Role type |
|---|---|---|
| General code quality | Advocate + Critic | participant + challenger |
| Maintainability | Maintainer | challenger |
| Design system compliance | Design system critic | challenger |
| Convention enforcement | Enforcer | auditor |
| Security | Security reviewer | challenger |
| Performance | Performance reviewer | challenger |
| Accessibility | Accessibility auditor | auditor |
| API contract compliance | Contract enforcer | auditor |

Auditor-type delegates always require a grounding file — they need explicit rules to audit against.

---

## Future: project-specific configuration workflow

After `/delphi-review` ships, a second phase builds a configurator using the skill-creator eval loop:

1. User runs the skill-creator to build a project-specific review configuration
2. The skill-creator interviews them about their stack (design system, framework, conventions)
3. It generates a composition YAML with domain-specific delegates and grounding files
4. The eval loop tests the composition against sample files from their project
5. Each iteration refines delegate prompts until the review catches what it should and doesn't false-positive on what it shouldn't
6. Output: a tuned composition YAML + conventions grounding file

This is not part of v1. The general-purpose engine is the prerequisite.

---

## What this does NOT do

- **Replace linters.** Deterministic violations (inline styles, hardcoded colors, banned selectors) are handled by ESLint/Stylelint. `/delphi-review` handles what linters cannot — semantic violations requiring judgment.
- **Auto-fix code.** The remediation plan is a document, not an automated fixer. CC can follow the plan, but the review itself does not modify source files. A `--fix` flag is a future enhancement.
- **Review approaches.** For "should I use X or Y?" deliberation, use `/delphi`. `/delphi-review` reviews code that already exists.
- **Replace human code review.** It augments review, especially for solo developers or AI-generated code that needs a second opinion before the human sees it.
