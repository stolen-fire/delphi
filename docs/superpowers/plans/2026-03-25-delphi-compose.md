# `/delphi-compose` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/delphi-compose` slash command that interviews users and generates custom deliberation composition YAML files.

**Architecture:** Single command file (`commands/delphi-compose.md`) — a markdown prompt with YAML frontmatter. The command instructs the LLM to conduct a 7-step interview, infer a delegate panel, and write valid composition YAML to the user's project. No agents, no skills invoked except `/delphi` at the end.

**Tech Stack:** Markdown prompt, YAML output. Tools: `AskUserQuestion`, `Read`, `Write`, `Glob`, `Skill`.

**Spec:** `docs/superpowers/specs/2026-03-24-delphi-compose-design.md`

**Reference files:**
- Existing command pattern: `commands/delphi.md`
- Composition schema reference: `compositions/integration-review.yml`

---

### Task 1: Command frontmatter and skeleton

**Files:**
- Create: `commands/delphi-compose.md`

- [ ] **Step 1: Write the command file with frontmatter and section headers**

```markdown
---
description: Guided composition builder for custom deliberations
allowed-tools: AskUserQuestion, Read, Write, Glob, Skill
argument-hint: '[no arguments — starts an interactive interview]'
---

# /delphi-compose

Build a custom deliberation composition through a guided interview.

## No-argument check

[placeholder]

## Step 1: The decision

[placeholder]

## Lightweight escape hatch

[placeholder]

## Step 2: The stakes

[placeholder]

## Step 3: Grounding material

[placeholder]

## Step 4: Propose the panel

[placeholder]

## Step 5: Rules

[placeholder]

## Step 6: Write the file

[placeholder]

## Step 7: Offer to run

[placeholder]
```

- [ ] **Step 2: Verify frontmatter matches the spec**

Read back `commands/delphi-compose.md` and confirm:
- `allowed-tools` includes `AskUserQuestion, Read, Write, Glob, Skill`
- `argument-hint` is present
- `description` matches spec

- [ ] **Step 3: Commit skeleton**

```bash
git add commands/delphi-compose.md
git commit -m "feat: scaffold /delphi-compose command"
```

---

### Task 2: No-argument check and Step 1 — The decision

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Write the no-argument check**

Replace the `[placeholder]` under `## No-argument check` with:

If `$ARGUMENTS` is not empty, treat it as the answer to step 1 (the decision question) and skip directly to step 2.

If `$ARGUMENTS` is empty, proceed to step 1.

- [ ] **Step 2: Write Step 1 — The decision**

Replace the `[placeholder]` under `## Step 1: The decision` with:

Use `AskUserQuestion` to ask: "What decision or question do you want to deliberate?"

Capture the response. Slugify it for the composition `name` field (lowercase, spaces to hyphens, strip special characters, max 50 chars).

- [ ] **Step 3: Write the lightweight escape hatch**

Replace the `[placeholder]` under `## Lightweight escape hatch` with:

After capturing the decision, assess whether this is a simple binary question with low stakes and no domain-specific perspectives needed. If so, ask:

"This sounds like a quick decision — would a lightweight 2-delegate review work, or do you want a full panel?"

If the user wants lightweight, output the command `/delphi "{their question}"` and stop. Otherwise proceed to step 2.

- [ ] **Step 4: Verify by reading back the file**

Read `commands/delphi-compose.md` and confirm steps 1, no-argument check, and escape hatch are present and coherent.

- [ ] **Step 5: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: /delphi-compose steps 0-1 — argument parsing and decision question"
```

---

### Task 3: Steps 2-3 — Stakes and grounding material

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Write Step 2 — The stakes**

Replace the `[placeholder]` under `## Step 2: The stakes` with:

Use `AskUserQuestion` to ask: "What could go wrong if you get this decision wrong?"

Capture the response. This surfaces risk dimensions used in step 4 to infer the panel. Note internally which risk categories apply:
- Data integrity / invariant violations
- Security / auth / data exposure
- User experience / accessibility
- Performance / scalability
- Integration / API / migration risk
- Maintenance / tech debt / complexity
- Compliance / legal / regulatory
- Cost / resource waste

High-stakes answers (data loss, security breach, compliance) signal `human_deferral: true` and veto-capable delegates.

- [ ] **Step 2: Write Step 3 — Grounding material**

Replace the `[placeholder]` under `## Step 3: Grounding material` with:

Use `AskUserQuestion` to ask: "Are there any files the delegates should read as context? (paths relative to your project, or skip)"

If the user provides paths:
- Use `Glob` to verify each file exists
- If a file doesn't exist, tell the user and ask them to correct the path
- Store verified paths for assignment to relevant delegates in step 4

If the user skips, proceed with no grounding files.

- [ ] **Step 3: Verify by reading back**

Read the file and confirm steps 2-3 are present and reference `AskUserQuestion`.

- [ ] **Step 4: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: /delphi-compose steps 2-3 — stakes and grounding material"
```

---

### Task 4: Step 4 — Panel inference and proposal

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Write Step 4 — Propose the panel**

Replace the `[placeholder]` under `## Step 4: Propose the panel` with the full panel inference logic. This is the core of the command. Include:

1. The risk-dimension-to-delegate heuristic table from the spec:

| Risk dimension | Delegate archetype | Capability |
| --- | --- | --- |
| Data loss, corruption, invariant violation | Domain guardian | `veto_invariant_violations` |
| Security breach, auth bypass, data exposure | Security reviewer | `veto_invariant_violations` |
| User confusion, poor UX, accessibility | User advocate | *(none)* |
| Performance degradation, scalability limits | Performance engineer | *(none)* |
| Integration failure, API breakage, migration risk | Integration realist | `challenge_all` |
| Maintenance burden, tech debt, complexity | Pragmatist / devil's advocate | `challenge_all` |
| Compliance, legal, regulatory | Compliance reviewer | `veto_invariant_violations` |
| Cost overrun, resource waste | Resource economist | *(none)* |

2. Instructions to always include:
   - A Chair with `frame_propositions`
   - At least one delegate with `challenge_all` (add devil's advocate if no risk dimension maps to one)
   - Remaining delegates from the risk dimensions identified in step 2

3. For each proposed delegate, generate:
   - `role` — snake_case descriptive name
   - `capabilities` — from the heuristic table
   - `prompt_register` — a quality register matching the role's perspective (use `integration-review.yml` delegates as style reference)
   - `prompt` — role-specific instructions derived from the user's decision and stakes
   - `grounding` — assign from step 3 if relevant to this role

4. Present the panel as a readable numbered list (not YAML), with each delegate's role, why they matter, and their capability. Example format:

```
Here's the panel I'd recommend:

1. **Chair** — Frames the proposition precisely. Procedural only, no advocacy. (frame_propositions)
2. **Security reviewer** — Evaluates auth and data exposure risks. Can veto invariant violations. (veto_invariant_violations)
3. **API designer** — Represents consumer ergonomics and contract stability. (none)
4. **Devil's advocate** — Manufactures failure scenarios, kills premature consensus. (challenge_all)

Does this panel look right? You can add, remove, or adjust any role.
```

5. Use `AskUserQuestion` to get approval. If the user adjusts, apply changes and re-present.

- [ ] **Step 2: Verify by reading back**

Read the file and confirm step 4 includes the heuristic table, the always-include rules, the presentation format, and the user approval question.

- [ ] **Step 3: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: /delphi-compose step 4 — panel inference and proposal"
```

---

### Task 5: Step 5 — Rules proposal

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Write Step 5 — Rules**

Replace the `[placeholder]` under `## Step 5: Rules` with:

Based on the decision context, propose defaults:
- `max_rounds`: 2 for straightforward, 3 for complex/high-stakes
- `independent_positions`: true (always — anti-anchoring)
- `require_dissent_record`: true (always)
- `human_deferral`: true if stakes are high (from step 2), false otherwise
- `veto_roles`: list role names of delegates with `veto_invariant_violations`

Present as a readable summary, not YAML. Example:

```
Rules for this deliberation:

- Rounds: 3 (complex decision)
- Independent positions: yes (delegates can't see each other)
- Human deferral: yes (high stakes — deadlocks get deferred to you)
- Veto power: security_reviewer (can halt on invariant violations)
- Dissent record: always kept

Want to adjust anything?
```

Use `AskUserQuestion` to get approval.

- [ ] **Step 2: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: /delphi-compose step 5 — rules proposal"
```

---

### Task 6: Steps 6-7 — Write file and offer to run

**Files:**
- Modify: `commands/delphi-compose.md`

- [ ] **Step 1: Write Step 6 — Write the file**

Replace the `[placeholder]` under `## Step 6: Write the file` with:

1. Propose default path: `./compositions/{slugified-name}.yml`
2. Use `AskUserQuestion`: "I'll write the composition to `./compositions/{name}.yml` — does that path work?"
3. If user suggests a different path, use that instead
4. Assemble the YAML following the schema from `integration-review.yml`:

```yaml
name: {slugified-name}
mode: standard

delegates:
  - role: chair
    capabilities: [frame_propositions]
    prompt_register: "{register from step 4}"
    prompt: >
      {prompt from step 4}

  - role: {role_name}
    capabilities: [{capabilities}]
    prompt_register: "{register}"
    grounding: "{path if provided}"
    prompt: >
      {prompt}

  # ... remaining delegates

rules:
  max_rounds: {from step 5}
  independent_positions: true
  require_dissent_record: true
  human_deferral: {from step 5}
  veto_roles: [{from step 5}]

output:
  include_transcript: true
  include_provenance: true
```

5. Use `Write` tool to create the file
6. Confirm to the user: "Composition written to `{path}`"

- [ ] **Step 2: Write Step 7 — Offer to run**

Replace the `[placeholder]` under `## Step 7: Offer to run` with:

Use `AskUserQuestion`: "Want to run this deliberation now?"

- If yes and grounding files were provided as input artifacts: invoke `Skill` with `/delphi --config {path} --input {artifact paths}`
- If yes and no artifacts: invoke `Skill` with `/delphi --config {path}`
- If no: display the command they'd use later:
  ```
  /delphi --config {path}
  ```

- [ ] **Step 3: Read back the complete file**

Read the entire `commands/delphi-compose.md` and verify:
1. Frontmatter has correct `allowed-tools`
2. All 7 steps are present and complete (no placeholders remain)
3. Steps reference `AskUserQuestion` for user interaction
4. Step 4 includes the heuristic table and always-include rules
5. Step 6 produces YAML matching `integration-review.yml` schema
6. Step 7 invokes `/delphi` via `Skill` tool

- [ ] **Step 4: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: /delphi-compose steps 6-7 — YAML generation and run offer"
```

---

### Task 7: Update README and plugin manifest

**Files:**
- Modify: `README.md`
- Modify: `.claude-plugin/plugin.json` (if commands are listed there)

- [ ] **Step 1: Add /delphi-compose to README usage section**

After the existing "Dry run" subsection in the Usage section, add:

```markdown
### Build a custom composition

Create a tailored deliberation panel through a guided interview:

` ` `
/delphi-compose
` ` `

The command asks about your decision, what's at risk, and any context files — then proposes a panel of delegates, generates the composition YAML, and optionally runs the deliberation immediately.
```

- [ ] **Step 2: Verify README reads correctly**

Read back the README usage section and confirm the new subsection flows naturally after "Dry run."

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add /delphi-compose to README usage section"
```
