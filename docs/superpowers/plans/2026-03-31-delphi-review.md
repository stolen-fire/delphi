# `/delphi-review` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a general-purpose adversarial code review command to the Delphi plugin with 3 default delegates (Advocate, Critic, Maintainer), a conditional 4th (Enforcer), and actionable remediation plan output.

**Architecture:** New command (`/delphi-review`) invokes the main engine with a new Code Review Protocol alongside existing Lightweight and Standard protocols. Three new agent definitions, two new templates, a new protocol reference skill, and extensions to the engine and `/delphi-compose`.

**Tech Stack:** Pure Markdown/YAML — no build, test, or lint. Verification via dry-run mode.

**Spec:** `docs/superpowers/specs/2026-03-31-delphi-review-design.md`

---

### Task 1: Add `role_type` to existing agent frontmatter

Establishes the agent taxonomy before creating new agents. All existing agents get a `role_type` field in their YAML frontmatter.

**Files:**
- Modify: `agents/deliberation-proposer.md:1-12`
- Modify: `agents/deliberation-critic.md:1-12`
- Modify: `agents/deliberation-chair.md:1-12`

- [ ] **Step 1: Add `role_type: participant` to proposer**

In `agents/deliberation-proposer.md`, add `role_type: participant` after the `description` field:

```markdown
---
name: deliberation-proposer
description: >
  Default proposer delegate for the deliberation plugin. Takes a clear position
  and defends it with evidence. Dispatched by the deliberation engine during
  position and response phases.
role_type: participant
model: inherit
tools:
  - Read
  - Write
color: blue
---
```

- [ ] **Step 2: Add `role_type: challenger` to critic**

In `agents/deliberation-critic.md`, add `role_type: challenger` after `description`:

```markdown
---
name: deliberation-critic
description: >
  Default adversarial critic for the deliberation plugin. Challenges all
  positions, finds untested assumptions, manufactures failure scenarios.
  Dispatched by the deliberation engine during challenge phases.
role_type: challenger
model: inherit
tools:
  - Read
  - Write
color: red
---
```

- [ ] **Step 3: Add `role_type: facilitator` to chair**

In `agents/deliberation-chair.md`, add `role_type: facilitator` after `description`:

```markdown
---
name: deliberation-chair
description: >
  Chair agent for standard deliberation. Frames propositions precisely and
  writes ratified decision documents. Procedural authority only — does not
  advocate for any position. Dispatched by the engine for framing and
  decision writing in standard mode.
role_type: facilitator
model: inherit
tools:
  - Read
  - Write
color: cyan
---
```

- [ ] **Step 4: Commit**

```bash
git add agents/deliberation-proposer.md agents/deliberation-critic.md agents/deliberation-chair.md
git commit -m "feat: add role_type taxonomy to existing agent frontmatter"
```

---

### Task 2: Create advocate agent

**Files:**
- Create: `agents/deliberation-advocate.md`

- [ ] **Step 1: Write the advocate agent definition**

Create `agents/deliberation-advocate.md`:

```markdown
---
name: deliberation-advocate
description: >
  Code review advocate. Reads code under review, explains the implementation
  approach, and defends the choices made. Dispatched by the engine during
  the position phase of code review deliberations.
role_type: participant
model: inherit
tools:
  - Read
  - Write
color: green
---

You are the Advocate in a code review deliberation. Your job is to read the code under review, understand what it does, and defend the implementation choices.

## Position phase

When asked for your position:

1. Read the code carefully — understand the structure, patterns, and intent
2. Form a direct assessment — "This implementation is sound because..." or "This approach correctly addresses the requirement by..."
3. Explain the key implementation choices: why these components, why this structure, why this pattern
4. Identify the risks honestly — name concrete scenarios where this code could cause problems
5. Anticipate the strongest criticism and address it preemptively

If a conventions file is provided, explicitly address how the code aligns with or diverges from stated conventions. Divergences are not automatically wrong — defend them if justified.

Write like an engineering design doc — direct assertions backed by evidence from the actual code. Use `[CITE: filename, line]` markers when referencing specific code.

## Response phase

When responding to adversarial challenges from the Critic and Maintainer, you MUST prefix each response with an explicit action tag. For each challenge directed at you, choose exactly one:

- `[ACTION: DEFEND]` — Provide evidence that refutes the challenge. You MUST include at least one `[CITE: filename, line]` marker pointing to actual code. A defense without a citation is an assertion, not evidence.
- `[ACTION: CONCEDE]` — Acknowledge the challenge is valid. State what should change in the code and why.
- `[ACTION: DISSENT]` — Accept the finding but record your disagreement. State: "I accept this finding but want it on the record that [specific concern]."

Do not ignore any challenge. Do not respond with "that's a good point" without choosing an action. Every challenge gets exactly one action tag.

## Output

Write your complete output to the file path specified in your dispatch instructions. Nothing else.
```

- [ ] **Step 2: Commit**

```bash
git add agents/deliberation-advocate.md
git commit -m "feat: add deliberation-advocate agent for code review"
```

---

### Task 3: Create maintainer agent

**Files:**
- Create: `agents/deliberation-maintainer.md`

- [ ] **Step 1: Write the maintainer agent definition**

Create `agents/deliberation-maintainer.md`:

```markdown
---
name: deliberation-maintainer
description: >
  Code review maintainer. Reads code as someone who will inherit it in
  6 months. Focuses on comprehensibility, naming, abstraction quality,
  and modification safety. Dispatched by the engine during the challenge
  phase of code review deliberations.
role_type: challenger
model: inherit
tools:
  - Read
  - Write
color: yellow
---

You are the Maintainer in a code review deliberation. You read code as someone who will inherit it in 6 months with no access to the original author.

## Your mandate

You do NOT evaluate correctness — that's the Critic's job. You evaluate livability. The question is not "does this work?" but "can I understand this, modify this, and debug this at 3 AM without the original author?"

## Challenge structure

You MUST structure your output with the exact header format so the engine can route challenges correctly:

## Challenges to: advocate

### Naming and clarity
[Are names self-documenting? Could you understand what each function, variable, and component does without reading the implementation? Flag anything that requires "reading the body to understand the name."]

### Abstraction quality
[Are abstractions justified by actual complexity, or are they premature? Is there unnecessary indirection? Conversely, is there duplicated logic that should be extracted? The test: does each abstraction make the code easier or harder to change?]

### Modification safety
[If requirements change, which parts of this code would you be afraid to touch? Where are the hidden coupling points? What would break if you changed one thing?]

### Missing context
[What would a new developer need to know that isn't in the code? Are there non-obvious decisions that should have comments? Are there implicit assumptions about execution order, data shape, or environment?]

## Quality register

Write like a tired on-call engineer reviewing code they'll be paged about — direct, practical, zero tolerance for cleverness that trades the author's convenience for the maintainer's confusion.

## Output

Write your complete challenge document to the file path specified in your dispatch instructions. Nothing else.
```

- [ ] **Step 2: Commit**

```bash
git add agents/deliberation-maintainer.md
git commit -m "feat: add deliberation-maintainer agent for code review"
```

---

### Task 4: Create enforcer agent

**Files:**
- Create: `agents/deliberation-enforcer.md`

- [ ] **Step 1: Write the enforcer agent definition**

Create `agents/deliberation-enforcer.md`:

```markdown
---
name: deliberation-enforcer
description: >
  Code review enforcer. Reads code against a conventions grounding file and
  produces a systematic compliance report. Does not participate in the
  challenge-response cycle. Dispatched conditionally when conventions are
  provided.
role_type: auditor
model: inherit
tools:
  - Read
  - Write
color: magenta
---

You are the Enforcer in a code review deliberation. You audit code against a conventions document. You do not argue, debate, or participate in challenges. You report facts.

## Your mandate

Read the conventions grounding file. Read the code under review. For each convention, determine whether the code complies. Report the result.

## Compliance checking process

1. Read the conventions document completely before examining any code
2. For each convention or rule stated in the document:
   a. Determine if the convention is applicable to the code under review (some conventions may target file types, patterns, or components not present in this code)
   b. If applicable: examine the code for compliance
   c. Record: pass, fail, or not-applicable
3. For each failure: cite the specific code location with `[CITE: filename, line]` and quote the convention being violated

## Output format

Follow the compliance report template provided in your dispatch instructions. Do NOT use the `## Challenges to:` format — you are an auditor, not a challenger.

## What you do NOT do

- You do not evaluate whether a convention is good or bad
- You do not make exceptions for "reasonable" violations
- You do not soften failures with explanations of why the violation is understandable
- You do not participate in the challenge-response cycle
- If the code violates a convention, it fails. Period.

## Output

Write your complete compliance report to the file path specified in your dispatch instructions. Nothing else.
```

- [ ] **Step 2: Commit**

```bash
git add agents/deliberation-enforcer.md
git commit -m "feat: add deliberation-enforcer agent for code review"
```

---

### Task 5: Create compliance report template

**Files:**
- Create: `templates/compliance-report.md`

- [ ] **Step 1: Write the compliance report template**

Create `templates/compliance-report.md`:

```markdown
# Compliance Report

**Conventions source:** {conventions file path}
**Code reviewed:** {file paths or "git diff"}
**Generated:** {ISO 8601 timestamp}

## Summary

- Conventions checked: {N}
- Pass: {N}
- Fail: {N}
- Not applicable: {N}

## Findings

### {Convention description}

- **Status:** {Pass | Fail | Not applicable}
- **Code reference:** {[CITE: filename, line] | "No relevant code found"}
- **Details:** {For failures: what the code does vs. what the convention requires. For passes: brief confirmation. For not-applicable: why this convention doesn't apply to the reviewed code.}

[Repeat for each convention in the grounding file]

## Failed conventions summary

| # | Convention | File | Line | Violation |
|---|-----------|------|------|-----------|
| {N} | {convention description} | {filename} | {line} | {what's wrong} |

[Only include rows for failures. Omit this section if all conventions pass.]
```

- [ ] **Step 2: Commit**

```bash
git add templates/compliance-report.md
git commit -m "feat: add compliance report template for enforcer"
```

---

### Task 6: Create remediation plan template

**Files:**
- Create: `templates/remediation-plan.md`

- [ ] **Step 1: Write the remediation plan template**

Create `templates/remediation-plan.md`:

```markdown
# Remediation Plan

**Generated from review of:** {file paths or "git diff"}
**Docket:** {docket-name}
**Date:** {ISO 8601 timestamp}

---

## Critical (must fix)

Items from contested points (Advocate couldn't defend), conceded challenges, or Enforcer failures.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {what's wrong — traced to specific delegate and challenge}
- **Action:** {exactly what to change — specific enough for CC to execute without interpretation}
- **Rationale:** {why — linked to synthesis point ID or compliance finding}
- **Source:** {Critic challenge | Maintainer challenge | Enforcer failure | Contested — no defense}

## Recommended (should fix)

Items from dissent (Advocate accepted but disagreed) or severity-assessed concessions.

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
git commit -m "feat: add remediation plan template for code review output"
```

---

### Task 7: Create `/delphi-review` command definition

**Files:**
- Create: `commands/delphi-review.md`

- [ ] **Step 1: Write the command definition**

Create `commands/delphi-review.md`:

```markdown
---
description: Adversarial code review with remediation plan output
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '<files|glob> [--diff [ref]] [--conventions path] [--config path.yml] [--tone name]'
---

# /delphi-review

Run an adversarial code review on source files or a git diff.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation mode:

**File review (default):**
If `$ARGUMENTS` contains file paths or glob patterns (anything not prefixed with `--`):
- Resolve each path/glob using the Glob tool
- If a glob matches zero files, warn and skip it
- Collect all resolved file paths as the review target
- If `$ARGUMENTS` also contains `--conventions`, extract the path — this activates the Enforcer delegate
- If `$ARGUMENTS` also contains `--config`, extract the path — this overrides the default delegate roster with a composition YAML
- If `$ARGUMENTS` also contains `--tone`, extract the tone name

**Diff review:**
If `$ARGUMENTS` contains `--diff`:
- If a git ref follows `--diff` (e.g., `--diff HEAD~3`), run `git diff {ref}` to capture the diff
- If no ref follows, run `git diff --staged` to capture staged changes
- If the diff is empty, warn and exit: "No changes found. Stage changes with `git add` or provide a ref."
- The review artifact is: the raw diff output + full content of each changed file (read via Read tool)
- Other flags (`--conventions`, `--config`, `--tone`) work the same as file review

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:
```
/delphi-review — Adversarial code review

Usage:
  /delphi-review src/Foo.tsx                               Single file review
  /delphi-review src/components/*.tsx                      Glob review
  /delphi-review --diff                                    Review staged changes
  /delphi-review --diff HEAD~3                             Review diff against ref
  /delphi-review --conventions RULES.md src/*.tsx           With convention enforcement
  /delphi-review --config review.yml src/*.tsx              Custom composition
  /delphi-review --tone snarky src/Foo.tsx                  With tone

Docket output: .deliberation/dockets/{timestamp}-review-{slug}/
Remediation plan: .deliberation/dockets/.../remediation/plan.md
```

## Assemble review context

Read all target files (or diff output + changed files) and assemble into a single review artifact:

```
## Code under review

### File: {relative path}
```{language}
{file contents}
```

### File: {next relative path}
...
```

For diff mode, also include:

```
## Diff
```diff
{raw git diff output}
```
```

If `--conventions` was provided, read the conventions file and store its contents for delegate dispatch.

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **mode:** `code-review`
- **review_artifact:** the assembled code/diff content
- **review_files:** list of resolved file paths (for docket snapshot)
- **review_type:** `files` or `diff`
- **diff_ref:** the git ref if `--diff` was used (or `staged`)
- **conventions:** the conventions file path and contents (or null)
- **composition:** the parsed YAML (or null — engine uses hardcoded defaults)
- **tone:** the tone name (or null)

The engine skill handles everything from here — docket creation, code snapshot, delegate dispatch, synthesis, remediation plan, and output.
```

- [ ] **Step 2: Commit**

```bash
git add commands/delphi-review.md
git commit -m "feat: add /delphi-review command definition"
```

---

### Task 8: Create code-review-deliberation protocol reference

A protocol reference skill (same pattern as `skills/standard-deliberation/SKILL.md`) documenting the Code Review Protocol's rules and characteristics.

**Files:**
- Create: `skills/code-review-deliberation/SKILL.md`

- [ ] **Step 1: Write the protocol reference**

Create `skills/code-review-deliberation/SKILL.md`:

```markdown
---
name: code-review-deliberation
description: >
  Code review deliberation protocol reference. 3 default delegates (Advocate,
  Critic, Maintainer) with sequential dispatch, conditional Enforcer when
  conventions provided, and remediation plan output. Used by the main engine
  when mode is code-review.
---

# Code review deliberation protocol

This document defines the rules for code-review mode. The main engine skill reads this as a protocol reference.

## Mode characteristics

- **Delegates:** 3 default (Advocate, Critic, Maintainer) + conditional Enforcer
- **Dispatch:** Sequential — each phase depends on prior output except Enforcer (independent)
- **Independent challenges:** Yes. Critic and Maintainer do not read each other's output (anti-anchoring)
- **Enforcer:** Conditional — activated only when `--conventions` is provided or composition includes an auditor-type delegate with grounding
- **Remediation plan:** Always generated — engine builds actionable plan from synthesis + compliance findings
- **Max rounds:** 1 for quick-path, configurable via composition
- **Code snapshot:** Input files/diff copied to `code-under-review/` for docket reproducibility

## Delegate dispatch rules

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Code + conventions | Position defending the code |
| `challenger` | Challenge | Code + participant position | `## Challenges to: advocate` |
| `auditor` | Independent | Code + grounding file | Compliance report |

### Sequential dispatch order (quick-path)

1. Advocate (participant) — reads code, writes position
2. Critic (challenger) — reads code + advocate position, writes challenges
3. Maintainer (challenger) — reads code + advocate position (NOT critic), writes challenges
4. Enforcer (auditor, conditional) — reads code + conventions, writes compliance report
5. Advocate (participant) — responds to Critic + Maintainer challenges
6. Engine — synthesis + remediation plan

### Anti-anchoring

- Critic and Maintainer each read the Advocate's position independently
- Neither challenger reads the other's challenges
- Enforcer reads only the code and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal

## Remediation plan generation

The engine (not a subagent) builds `remediation/plan.md` after synthesis:

### Priority mapping

| Source | Priority |
|--------|----------|
| Contested points (no defense or unsupported defense) | Critical |
| `[ACTION: CONCEDE]` by Advocate | Critical or Recommended |
| Enforcer failures (convention violation) | Critical |
| `[ACTION: DISSENT]` by Advocate | Recommended |
| Defended with self-referential `[CITE:]` | Optional |
| Successfully defended but Maintainer-flagged | Optional |

### Constraint

Every remediation item MUST have a File + Lines + Action triple. The engine traces findings back to code locations via `[CITE:]` markers. Vague findings are excluded.

## Composition override

When `--config` provides a YAML with `mode: code-review`:
- The composition's delegates replace the default roster
- Engine uses `role_type` field from each delegate to determine dispatch pattern
- Participant delegates → position phase, respond in response phase
- Challenger delegates → challenge phase, output routed to participants
- Auditor delegates → independent dispatch, report appended
- Facilitator delegates → framing and decision (for compositions that include a Chair)
```

- [ ] **Step 2: Commit**

```bash
git add skills/code-review-deliberation/SKILL.md
git commit -m "feat: add code review deliberation protocol reference"
```

---

### Task 9: Add Code Review Protocol to engine

The largest task — extends `skills/delphi/SKILL.md` with the full Code Review Protocol implementation. Follows the same inline pattern as the Lightweight and Standard protocols.

**Files:**
- Modify: `skills/delphi/SKILL.md`

- [ ] **Step 1: Update mode determination in Step 0.1**

In `skills/delphi/SKILL.md`, find the Step 0.1 section (around line 22-28). Add the code-review mode check. Replace the existing Step 0.1 content:

```markdown
### Step 0.1: Determine mode

- If you received an inline question with no `--config`: use the **hardcoded lightweight composition** defined in the lightweight-deliberation protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/lightweight-deliberation/SKILL.md`. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading. The loaded tone is injected into all lightweight dispatch prompts. Proceed to **Lightweight Protocol** below.
- If you received a `mode: code-review` signal (invoked from `/delphi-review`): proceed to **Code Review Protocol** below. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading.
- If you received a `--config` path: read the YAML file, extract `mode:` field
  - If a `--tone` flag was provided, it overrides any `tone` field in the composition YAML
  - If `mode: lightweight` (or 2 delegates): proceed to **Lightweight Protocol** below
  - If a tone is set (from `--tone` flag or composition YAML), load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading. The loaded tone is injected into all lightweight dispatch prompts.
  - If `mode: code-review`: proceed to **Code Review Protocol** below
  - If `mode: standard` (or 3+ delegates): proceed to **Standard Protocol** below
```

- [ ] **Step 2: Add Code Review Protocol section**

Append the following section to the end of `skills/delphi/SKILL.md`, after the Standard Protocol's Phase 7 (after the last line of the file):

```markdown
---
---

# Code Review Protocol

Use this protocol when mode is code-review (invoked from `/delphi-review` command, or YAML composition with `mode: code-review`). Sequential dispatch with 3 default delegates + conditional Enforcer.

Read the protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/code-review-deliberation/SKILL.md` for rules on delegate dispatch contracts, anti-anchoring, and remediation plan generation.

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
| advocate | `deliberation-advocate` | participant |
| critic | `deliberation-critic` | challenger |
| maintainer | `deliberation-maintainer` | challenger |
| enforcer (conditional) | `deliberation-enforcer` | auditor |

The Enforcer is included ONLY when conventions are provided.

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

### Step 0.5: Write proposition

Write `{docket-path}/proposition.md`:

```
# Code Review Proposition

**Review type:** {files | diff}
**Files:** {comma-separated list of file paths}
**Conventions:** {conventions file path, or "none"}

## Proposition

Review the following code for quality, correctness, maintainability, and
convention compliance. The Advocate will defend the implementation. The
Critic will challenge its correctness and robustness. The Maintainer will
evaluate its comprehensibility and modification safety.
{If conventions: "The Enforcer will audit against stated conventions."}

## Code under review

{review_artifact content — the assembled code/diff}
```

### Step 0.6: Tone loading

If a tone was provided, load it using the same resolution precedence as Standard Protocol:
1. `.claude/delphi/tones/{tone}.md` (user-defined)
2. `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` (built-in)
3. Warning if not found, proceed without tone

---

## Review Phase 1: Advocate position

Output progress: `Code review: {slug}`
Output progress: `  Advocate position...`

### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the Advocate's dispatch prompt:

```
You are the Advocate in this code review.

## Your role
You read the code under review, understand what it does, and defend the
implementation choices. Argue like an engineering design doc — direct
assertions backed by evidence from the actual code.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Conventions
{if conventions provided: contents of conventions file}
{if no conventions: "No conventions file provided. Evaluate against general best practices."}

## Output format
Follow this template exactly:
{contents of position template}

Write "# Position: advocate" as your heading.

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/advocate.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch advocate subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-advocate` agent definition.

Output progress: `  Advocate position... done`

---

## Review Phase 2: Critic challenge

Output progress: `  Critic challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

Assemble the Critic's dispatch prompt:

```
You are the Critic in this code review. Your capability is challenge_all.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

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

### Step 2.2: Dispatch critic subagent

Dispatch using the `deliberation-critic` agent definition.

Output progress: `  Critic challenge... done`

---

## Review Phase 3: Maintainer challenge

Output progress: `  Maintainer challenge...`

### Step 3.1: Assemble dispatch package

Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

**Anti-anchoring: Do NOT read or include the Critic's challenges.**

Assemble the Maintainer's dispatch prompt:

```
You are the Maintainer in this code review. You read code as someone who
will inherit it in 6 months with no access to the original author.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

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

### Step 3.2: Dispatch maintainer subagent

Dispatch using the `deliberation-maintainer` agent definition.

Output progress: `  Maintainer challenge... done`

---

## Review Phase 4: Enforcer compliance report (conditional)

**Skip this phase entirely if no conventions were provided.**

Output progress: `  Enforcer compliance check...`

### Step 4.1: Assemble dispatch package

Read the compliance report template from `${CLAUDE_PLUGIN_ROOT}/templates/compliance-report.md`.

Assemble the Enforcer's dispatch prompt:

```
You are the Enforcer in this code review. You audit code against conventions.

[TONE BLOCK]

## Code under review
{review_artifact content — the assembled code/diff}

## Conventions to enforce
{contents of conventions file}

## Output format
Follow this template exactly:
{contents of compliance report template}

## CRITICAL: Write your output to this exact file path
Write your complete compliance report to: {docket-path}/compliance/enforcer-report.md

Do not write to any other path. Do not output anything else.
```

### Step 4.2: Dispatch enforcer subagent

Dispatch using the `deliberation-enforcer` agent definition.

**The Enforcer does NOT participate in the challenge-response cycle.** Its report is appended to the docket and feeds into the remediation plan, but the Advocate does not respond to it.

Output progress: `  Enforcer compliance check... done`

---

## Review Phase 5: Advocate response

Output progress: `  Advocate response...`

### Step 5.1: Extract challenges from both challengers

Read `{docket-path}/challenges/round-1-critic.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-maintainer.md`. Extract the section under `## Challenges to: advocate`.

### Step 5.2: Assemble dispatch package

```
You are the Advocate. You are responding to adversarial challenges from
the Critic and the Maintainer.

[TONE BLOCK]

## Your original position
{contents of positions/round-1/advocate.md}

## Challenges directed at you

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

Respond to EVERY challenge from BOTH the Critic and the Maintainer. Use
clear headers to organize your responses:

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

Read `{docket-path}/responses/round-1/advocate.md`.
If Enforcer ran: read `{docket-path}/compliance/enforcer-report.md`.

### Step 6.2: Categorize challenge-response pairs

For each challenge from the Critic and Maintainer, find the Advocate's corresponding response and categorize using the **challenge-response categorization rules** defined in the shared engine rules above.

### Step 6.3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables. Write to `{docket-path}/synthesis/round-1.md`.

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

From the synthesis and compliance report, build a findings list:

**Critical findings:**
- Every contested point (Advocate's defense was unsupported or absent)
- Every `[ACTION: CONCEDE]` from the Advocate
- Every failure in the Enforcer's compliance report

**Recommended findings:**
- Every `[ACTION: DISSENT]` from the Advocate

**Optional findings:**
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
- Convention failures: {N} (if Enforcer ran)

### Remediation plan
{If findings: display contents of remediation/plan.md}
{If clean: "No remediation needed. All challenges were addressed with evidence."}

Docket: `.deliberation/dockets/{docket-name}/`
Remediation plan: `.deliberation/dockets/{docket-name}/remediation/plan.md`
```
```

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: add Code Review Protocol to deliberation engine"
```

---

### Task 10: Extend `/delphi-compose` for code review

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Add code review detection to Step 1**

In `commands/delphi-compose.md`, after the `## Step 1 — The decision` section and before the `## Lightweight escape hatch` section, add a code review detection check:

```markdown
## Code review escape hatch

After capturing the decision, assess whether the user is describing a code review (reviewing existing code for quality, compliance, or correctness) rather than a decision deliberation.

Signal phrases: "review code", "check code", "audit", "compliance", "code quality", "review my implementation", "review these files", "design system", "convention check"

If it seems like a code review, use `AskUserQuestion` to ask:

> This sounds like a code review rather than a decision deliberation. Would you like me to build a code review composition (`mode: code-review`) or a standard deliberation?

If code review: proceed to **Code Review Composition** below.
If standard deliberation: proceed to the lightweight escape hatch as normal.
```

- [ ] **Step 2: Add Code Review Composition section**

At the end of `commands/delphi-compose.md`, before the `## Invariants` section, add:

```markdown
---

## Code Review Composition

When building a code review composition, follow these modified steps:

### CR Step 1 — Review concerns

Use `AskUserQuestion` to ask:

> What aspects of the code do you want reviewed? (e.g., design system compliance, security, performance, maintainability, API contract, accessibility)

### CR Step 2 — Conventions and grounding

Use `AskUserQuestion` to ask:

> Do you have a conventions document, style guide, or design system rules file that delegates should enforce? (path or "none")

If provided: verify with Glob, store for assignment to auditor delegates.

### CR Step 3 — Propose the panel

Map review concerns to delegate archetypes:

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

Every code review panel MUST include:
1. An **Advocate** (`role_type: participant`) — defends the code
2. At least one **Challenger** (`role_type: challenger`) — attacks the code

Auditor delegates require a grounding file — ask for one if the user selected an auditor concern without providing grounding in CR Step 2.

Present the panel and get approval (same flow as standard Step 4).

### CR Step 4 — Rules and output

Code review compositions use:
- `max_rounds: 1` (default, adjustable)
- `independent_positions: true`
- `require_dissent_record: true`
- `human_deferral: false` (code review decisions don't need human escalation by default)

Present and get approval (same flow as standard Step 5).

### CR Step 5 — Write and offer to run

Write the YAML with `mode: code-review` and `role_type` on each delegate. Offer to run:

```
When you're ready:
/delphi-review --config {path} <files to review>
```
```

- [ ] **Step 3: Add code review invariant**

In the `## Invariants` section, add:

```markdown
10. Code review compositions must have `mode: code-review`
11. Code review compositions must have at least one `participant` and one `challenger` by `role_type`
12. Auditor delegates in code review compositions must have a `grounding` file
```

- [ ] **Step 4: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: extend /delphi-compose for code review compositions"
```

---

### Task 11: Update plugin metadata

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Bump plugin version**

In `.claude-plugin/plugin.json`, bump version to `0.6.0` (new feature = minor version):

```json
{
  "name": "delphi",
  "version": "0.6.0",
  "description": "Structured multi-agent deliberation with adversarial review, code review, docket provenance, and configurable compositions",
  "author": {
    "name": "stolen-fire"
  },
  "repository": "https://github.com/stolen-fire/delphi",
  "homepage": "https://github.com/stolen-fire/delphi",
  "license": "MIT",
  "keywords": ["deliberation", "adversarial-review", "multi-agent", "decision-making", "code-review"]
}
```

- [ ] **Step 2: Update CLAUDE.md implementation status**

In `CLAUDE.md`, update the `## Implementation Status` section to add the code review status:

```markdown
## Implementation Status

- **Lightweight mode** (2 delegates, sequential): fully implemented and working
- **Standard mode** (3-5 delegates, parallel dispatch): fully implemented and working — engine at `skills/delphi/SKILL.md` line 27 delegates to the standard protocol reference at `skills/standard-deliberation/SKILL.md`
- **Code review mode** (3+1 delegates, sequential): fully implemented — `/delphi-review` command, Advocate/Critic/Maintainer delegates, conditional Enforcer, remediation plan output
- **Tone system**: 5 built-in tones (snarky, diplomatic, adversarial, socratic, parliamentary), user-extensible via `.claude/delphi/tones/`
- **Observatory** (`/delphi-observe`): browser-based viewer for deliberation dockets — issue-threaded layout with AI commentary, supports live and post-hoc modes via visualizer MCP
- **Evidence pipeline**: evidence submission via `--evidence` flag or YAML `evidence:` field, PDF conversion (pdftotext + Tesseract), evidence index with provenance, SHA-256 hashing
- **Capabilities**: `research_authority` (pre-deliberation case law appendix with verified absences, recovery window on concession), `verify_sources` (mid-deliberation auditor verification with four-category coverage map)
- **Chair evidence access**: Chair reads evidence directory, case law appendix, and verification log during proposition framing and decision writing
```

- [ ] **Step 3: Update CLAUDE.md plugin architecture**

Add to the `## Plugin Architecture` section:

```markdown
- Agent `role_type` taxonomy: `participant` (position+response), `challenger` (challenge output), `auditor` (independent report), `facilitator` (procedural only)
- Code review delegates: advocate (participant, green), critic (challenger, red, reused), maintainer (challenger, yellow), enforcer (auditor, magenta, conditional)
- Remediation plan: engine-generated actionable output from synthesis + compliance findings, prioritized as critical/recommended/optional
```

- [ ] **Step 4: Update CLAUDE.md conventions**

Add to the `## Conventions` section:

```markdown
- Agent frontmatter: `role_type` required (participant, challenger, auditor, facilitator)
```

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json CLAUDE.md
git commit -m "feat: bump to v0.6.0, update docs for code review mode"
```

---

### Task 12: End-to-end dry-run verification

Verify the complete implementation by running a dry-run review.

**Files:**
- None (verification only)

- [ ] **Step 1: Verify all new files exist**

Run:
```bash
ls agents/deliberation-advocate.md agents/deliberation-maintainer.md agents/deliberation-enforcer.md templates/compliance-report.md templates/remediation-plan.md commands/delphi-review.md skills/code-review-deliberation/SKILL.md
```
Expected: all 7 files listed without errors.

- [ ] **Step 2: Verify role_type in existing agents**

Run:
```bash
grep "role_type:" agents/deliberation-proposer.md agents/deliberation-critic.md agents/deliberation-chair.md
```
Expected:
```
agents/deliberation-proposer.md:role_type: participant
agents/deliberation-critic.md:role_type: challenger
agents/deliberation-chair.md:role_type: facilitator
```

- [ ] **Step 3: Verify role_type in new agents**

Run:
```bash
grep "role_type:" agents/deliberation-advocate.md agents/deliberation-maintainer.md agents/deliberation-enforcer.md
```
Expected:
```
agents/deliberation-advocate.md:role_type: participant
agents/deliberation-maintainer.md:role_type: challenger
agents/deliberation-enforcer.md:role_type: auditor
```

- [ ] **Step 4: Verify command is registered**

Run:
```bash
grep -l "delphi-review" commands/
```
Expected: `commands/delphi-review.md`

- [ ] **Step 5: Verify engine has code-review mode**

Run:
```bash
grep "Code Review Protocol" skills/delphi/SKILL.md
```
Expected: at least one match confirming the protocol section exists.

- [ ] **Step 6: Verify plugin version**

Run:
```bash
grep '"version"' .claude-plugin/plugin.json
```
Expected: `"version": "0.6.0"`

- [ ] **Step 7: Test `/delphi-review` with no arguments**

Run `/delphi-review` with no arguments. Expected: usage help is displayed.

- [ ] **Step 8: Test `/delphi-review` against a real file**

Pick any file in the repository (e.g., `agents/deliberation-advocate.md`) and run:
```
/delphi-review agents/deliberation-advocate.md
```
Expected: the engine creates a docket under `.deliberation/dockets/`, dispatches Advocate → Critic → Maintainer → Advocate response → synthesis → remediation plan.

- [ ] **Step 9: Commit verification results**

If the dry-run succeeded, no commit needed. If fixes were required, commit them:
```bash
git add -A
git commit -m "fix: address issues found during /delphi-review dry-run verification"
```
