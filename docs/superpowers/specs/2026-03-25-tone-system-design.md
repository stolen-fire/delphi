# Delphi Tone System — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Composition-level tone injection with built-in registry and user extensibility

## Overview

Add a tone system that lets deliberators adopt a distinct voice — snarky, diplomatic, adversarial, socratic, or absurdist parliamentary — without changing what they argue, only how they say it. Tones are named presets that resolve to tone files, stored in a `tones/` directory with the same override pattern used for agent files.

## 1. Composition Schema Change

One new optional field at composition root level:

```yaml
name: my-review
mode: standard
tone: snarky          # Optional. Omit for default (no tone injection).

delegates:
  # ...
```

- The `tone` value is a slug that resolves to a tone file.
- If specified but the file isn't found in either resolution path, the engine emits a warning and proceeds without tone injection (fail-open).
- If omitted, deliberators behave exactly as they do today. Fully backward-compatible.

## 2. Tone File Format

Each tone is a standalone markdown file with structured frontmatter:

```markdown
---
name: snarky
description: Clear-eyed consequential wit — Chesterton meets on-call engineer
---

## Voice directive

{Behavioral instructions that tell delegates HOW to write.
This is the payload that gets injected into dispatch prompts.}

## Examples

### Before (neutral)
> {Example of neutral deliberation output}

### After ({tone name})
> {Same content rewritten in this tone}
```

### Resolution precedence

Mirrors the existing agent override pattern:

1. `.claude/delphi/tones/{name}.md` — user's project (custom or override)
2. `${CLAUDE_PLUGIN_ROOT}/tones/{name}.md` — plugin built-in

User-defined tones take priority over built-in tones with the same name.

## 3. Engine Tone Loading

When the engine parses a composition YAML that contains a `tone` field:

1. Read the `tone` value (e.g., `snarky`)
2. Attempt to read `.claude/delphi/tones/{tone}.md` — if found, use it
3. Otherwise, read `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` — if found, use it
4. If neither exists: output a warning (`Warning: tone '{tone}' not found, proceeding without tone`) and set tone content to empty
5. If found: extract the `## Voice directive` and `## Examples` sections from the file body — these are the injection payloads

This loading happens once at deliberation start, before any phase dispatch.

## 4. Engine Injection Points

The tone directive is injected as a `## Tone` section in every delegate dispatch prompt — Chair, position-takers, adversarial challengers, and responders. Four injection points:

| Phase | Dispatch | Injection point |
|-------|----------|-----------------|
| Phase 1 | Chair framing | After `## Quality register` |
| Phase 2 | Position dispatch | After `## Quality register` |
| Phase 3 | Challenge dispatch | After `## Quality register` |
| Phase 4 | Response dispatch | After `## Quality register` |

### Injected block format

```
## Tone
{contents of the voice directive section from the tone file}

### Tone examples
{contents of the examples section from the tone file}
```

### Relationship to `prompt_register`

`prompt_register` and `tone` serve different purposes and compose together:

- `prompt_register` controls writing **format** — "legal brief," "engineering doc"
- `tone` controls writing **voice** — "snarky," "parliamentary"

A delegate can have `prompt_register: "legal brief"` and `tone: parliamentary`, producing arguments structured like a legal brief but delivered with Monty Python parliamentary flair.

### Structural constraint

The tone directive must NOT override the structural requirements of each phase. Action tags (`[ACTION: DEFEND]`, `[ACTION: CONCEDE]`, `[ACTION: DISSENT]`, `[ACTION: VETO]`), `[CITE:]` markers, file output paths, and template formats remain mandatory. The tone only changes how things are said, not what must be said.

## 5. Built-in Tones

Five tones ship with v1:

### `snarky`
- **Description:** Clear-eyed consequential wit — Chesterton meets on-call engineer
- **Voice:** Ground every joke in consequences. Sharp truths wrapped in humor. "This is who gets paged at 3 AM." Don't be mean — be the engineer who says what everyone is thinking but wraps it in a truth so sharp the reader laughs before they wince. Never punch down at people — punch at ideas, architectures, and comfortable assumptions.

### `diplomatic`
- **Description:** Measured professional discourse
- **Voice:** Acknowledge before disagreeing. Steel-man opposing positions before critiquing them. Formal but not stiff. The goal is to make every delegate feel heard while still being direct about flaws.

### `adversarial`
- **Description:** Courtroom cross-examination
- **Voice:** No pleasantries. Lead with the weakest point in every argument. Every claim is guilty until proven innocent. No softening language. Strip arguments to their logical skeleton and test each bone.

### `socratic`
- **Description:** Questions that corner you into your own answer
- **Voice:** Frame challenges as questions. Let the reader realize the flaw themselves. Never state what you can ask. Build chains of questions that lead inevitably to the conclusion you want the reader to reach.

### `parliamentary`
- **Description:** Monty Python's Holy Grail as British Parliament
- **Voice:** Address delegates as "the honourable member." The Chair calls for order with increasing desperation. Points of order devolve into absurdist tangents. Coconut-based transportation analogies are encouraged. The Black Knight's refusal to concede is the model for `[ACTION: DEFEND]` — "'Tis but a scratch" is a valid rhetorical stance when your architecture is losing limbs. When challenging, invoke the Spanish Inquisition — nobody expects your third failure scenario. When proposals rely on unclear authority models, note that "strange women lying in ponds distributing swords is no basis for a system of government."

## 6. `/delphi-compose` Integration

New step inserted after Step 4 (panel proposal) and before Step 5 (rules). Designated **Step 4b — Tone selection**.

### Discovery

1. Engine scans both tone directories via Glob:
   - `${CLAUDE_PLUGIN_ROOT}/tones/*.md`
   - `.claude/delphi/tones/*.md`
2. Reads frontmatter (`name`, `description`) from each discovered file
3. Deduplicates by name (user-defined wins over built-in)

### Presentation

Present available tones to user via `AskUserQuestion`:

> **Would you like to set a tone for this deliberation?**
>
> Available tones:
> - **snarky** — Clear-eyed consequential wit, Chesterton meets on-call engineer
> - **diplomatic** — Measured professional discourse
> - **adversarial** — Courtroom cross-examination
> - **socratic** — Questions that corner you into your own answer
> - **parliamentary** — Monty Python's Holy Grail as British Parliament
> - *(any user-defined tones discovered)*
>
> Or "none" for default deliberation style.

### YAML output

- If a tone is selected: add `tone: {slug}` at the composition root level, after `mode`
- If "none": omit the `tone` field entirely

### User-defined tone discovery

Automatic — drop a file in `.claude/delphi/tones/{name}.md` following the tone file format and it appears in the compose interview. No registration step needed.

## 7. Docket Metadata

Record the tone in `docket.json` for provenance:

```json
{
  "composition": "integration-review",
  "mode": "standard",
  "tone": "parliamentary",
  "delegates": [ ... ]
}
```

- If no tone was set, the `tone` field is omitted from the JSON (not `null`, just absent)
- This matches the composition YAML behavior — absence means default

## Design Decisions

### Why `tone` is separate from `prompt_register`
They serve orthogonal purposes. `prompt_register` controls document structure (legal brief, engineering doc). `tone` controls voice (snarky, diplomatic). Keeping them separate means they compose naturally — you can mix any format with any voice.

### Why fail-open on missing tone files
A missing tone file shouldn't block a deliberation. The deliberation content is the point; the voice is a nice-to-have. Warn the user, proceed without injection.

### Why all roles get the tone (including Chair)
Users want the entertainment value of watching AI deliberate in character. The Chair calling "Order! ORDER!" in parliamentary mode is half the fun. No role exemptions.

### Why five tones at launch
Four serious tones cover the useful spectrum (wit, diplomacy, aggression, inquiry). One fun tone (parliamentary) demonstrates the system's range and provides entertainment value that drives adoption and engagement with docket output.

### Why the `tones/` directory pattern
Mirrors the existing agent override pattern (`.claude/agents/` -> plugin `agents/`). Users already understand this resolution model. Adding custom tones is a "drop a file" experience with zero configuration.
