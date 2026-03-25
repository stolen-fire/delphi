# `/delphi-compose` — Guided Composition Builder

**Date:** 2026-03-24
**Status:** Draft
**Scope:** New slash command for the delphi plugin

## Summary

A slash command that interviews the user about their decision, infers the right panel of delegates, and writes a valid composition YAML to the user's project. Optionally runs the deliberation immediately after.

**Approach:** Full interview — decision-focused. The user describes the problem, the command proposes the panel. No templates for now; grow into template-picker later.

---

## Interview Flow

### Step 1 — The decision

Ask: "What decision or question do you want to deliberate?"

Free-form input. The command captures this as the basis for panel design and the composition's `name` field (slugified).

### Step 2 — The stakes

Ask: "What could go wrong if you get this wrong?"

This surfaces the risk dimensions that determine which perspectives belong on the panel. High-stakes answers (data loss, security breach, compliance violation) signal the need for veto-capable delegates and `human_deferral: true`.

### Step 3 — Grounding material

Ask: "Are there any files the delegates should read as context? (paths relative to your project, or skip)"

Optional. Paths stored as `grounding:` entries on relevant delegates. The command should verify the files exist before writing the composition.

### Step 4 — Propose the panel

Based on steps 1-2, infer and propose 3-5 delegates. Each delegate entry includes:

- `role` — descriptive name (e.g., `security_reviewer`, `api_designer`, `devil_advocate`)
- One-line explanation of why this perspective matters for the decision
- `capabilities` — `challenge_all`, `veto_invariant_violations`, or `frame_propositions` as appropriate
- `prompt_register` — quality register matching the role (e.g., "threat model — written by someone who has seen the breach report" for security)
- `prompt` — role-specific instructions derived from the decision context
- `grounding` — assigned from step 3 if relevant to this role

Always include:

- A **Chair** with `frame_propositions` (standard mode requires one)
- At least one delegate with `challenge_all` (adversarial review is the point)
- Remaining delegates chosen to represent the distinct risk dimensions from step 2

**Panel inference heuristic.** Map risk dimensions from step 2 to delegate archetypes:

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

If no risk dimension maps to a `challenge_all` role, always add a devil's advocate with that capability. Every panel needs at least one adversarial voice.

Present the panel as a readable list, not raw YAML. Ask: "Does this panel look right? You can add, remove, or adjust any role."

### Step 5 — Rules

Propose defaults based on the decision context:

- `max_rounds`: 2 for straightforward decisions, 3 for complex/high-stakes
- `independent_positions`: true (anti-anchoring — always on for standard mode)
- `require_dissent_record`: true
- `human_deferral`: true if stakes are high (from step 2), false otherwise
- `veto_roles`: list any delegate with `veto_invariant_violations`

Present as a summary, not raw YAML. Ask: "These are the rules — want to adjust anything?"

### Step 6 — Write the file

- Default path: `./compositions/{slugified-decision-name}.yml`
- Confirm path with user before writing
- Write valid YAML matching the composition schema (same structure as `integration-review.yml`)
- Set `mode: standard` (the interview produces multi-delegate compositions)

### Step 7 — Offer to run

Ask: "Want to run this deliberation now?"

- If yes and user has input artifacts: invoke `/delphi --config {path} --input {artifacts}`
- If yes and no artifacts: invoke `/delphi --config {path}`
- If no: confirm the file location and show the command they'd use later

---

## Output Schema

The generated YAML follows the existing composition format:

```yaml
name: {slugified-decision-name}
mode: standard

delegates:
  - role: chair
    capabilities: [frame_propositions]
    prompt_register: "{register}"
    prompt: >
      {role-specific instructions}

  - role: {role_name}
    capabilities: [{if any}]
    prompt_register: "{register}"
    grounding: "{path if provided}"
    prompt: >
      {role-specific instructions}

  # ... more delegates

rules:
  max_rounds: {2 or 3}
  independent_positions: true
  require_dissent_record: true
  human_deferral: {true or false}
  veto_roles: [{roles with veto capability}]

output:
  include_transcript: true
  include_provenance: true
```

---

## Implementation

Single file: `commands/delphi-compose.md`

The command is a markdown prompt file with YAML frontmatter:

```yaml
---
description: Guided composition builder for custom deliberations
allowed-tools: AskUserQuestion, Read, Write, Glob, Skill
argument-hint: '[no arguments — starts an interactive interview]'
---
```

Uses:

- `AskUserQuestion` — for each interview step
- `Write` — to produce the YAML file
- `Read` / `Glob` — to verify grounding file paths exist
- `Skill` — to invoke `/delphi` if user wants to run immediately

No agents or subagents. The command itself conducts the interview and writes the output.

### Lightweight escape hatch

If the decision described in step 1 is straightforward (binary choice, low stakes, no domain-specific perspectives needed), the command should suggest using `/delphi "question"` directly instead of building a full composition. Ask: "This sounds like a quick decision — would a lightweight 2-delegate review work, or do you want a full panel?" If the user wants lightweight, output the command and stop.

---

## Files Created

| File | Purpose |
| --- | --- |
| `commands/delphi-compose.md` | The slash command (interview + YAML gen) |

---

## Invariants

1. Every generated composition includes a Chair with `frame_propositions`
2. Every generated composition includes at least one `challenge_all` delegate
3. Mode is always `standard` (lightweight doesn't need custom compositions)
4. Grounding file paths are verified before writing
5. Output YAML matches the schema used by `integration-review.yml`
6. The composition file is written to the user's project, not the plugin directory
