---
description: Guided composition builder for custom deliberations
allowed-tools: AskUserQuestion, Read, Write, Glob, Skill
argument-hint: '[no arguments — starts an interactive interview]'
---

# /delphi-compose

Build a custom deliberation composition through a guided interview. You will walk the user through 7 steps, gathering information about their decision, inferring the right panel of delegates, and writing a valid composition YAML to their project.

## Argument handling

If `$ARGUMENTS` is not empty, treat it as the answer to Step 1 (the decision question) and skip directly to the lightweight escape hatch check, then Step 2.

If `$ARGUMENTS` is empty, proceed to Step 1.

---

## Step 1 — The decision

Use `AskUserQuestion` to ask:

> What decision or question do you want to deliberate?

Capture the response. Derive a slug from it for the composition `name` field: lowercase, spaces to hyphens, strip special characters, max 50 characters. Store the original text as the decision description.

---

## Lightweight escape hatch

After capturing the decision (whether from arguments or Step 1), assess whether this is a simple binary question with low stakes and no domain-specific perspectives needed.

If it seems straightforward, use `AskUserQuestion` to ask:

> This sounds like a quick decision — would a lightweight 2-delegate review work, or do you want a full panel?

If the user wants lightweight, tell them:

```
You can run this directly:
/delphi "{their question}"
```

Then **stop**. Do not continue to Step 2.

If the user wants a full panel, or if the question is clearly complex, proceed to Step 2.

---

## Step 2 — The stakes

Use `AskUserQuestion` to ask:

> What could go wrong if you get this decision wrong?

Capture the response. Internally categorize which risk dimensions apply — these determine the delegate panel in Step 4:

| Risk dimension | Signal phrases |
| --- | --- |
| Data integrity / invariant violations | data loss, corruption, inconsistency, wrong state |
| Security / auth / data exposure | breach, unauthorized access, leaked credentials, auth bypass |
| User experience / accessibility | confusing, poor UX, accessibility, user frustration |
| Performance / scalability | slow, latency, won't scale, bottleneck |
| Integration / API / migration risk | breaking change, API contract, migration, backwards compat |
| Maintenance / tech debt / complexity | hard to maintain, tech debt, overly complex, spaghetti |
| Compliance / legal / regulatory | compliance, legal, audit, regulatory, GDPR, SOC |
| Cost / resource waste | expensive, budget, resource waste, over-provisioned |

High-stakes answers (data loss, security breach, compliance violation) should flag `human_deferral: true` and veto-capable delegates for later steps.

---

## Step 3 — Grounding material

Use `AskUserQuestion` to ask:

> Are there any files the delegates should read as context? (paths relative to your project, or skip)

If the user provides paths:
1. Use `Glob` to verify each file exists
2. If a file doesn't exist, tell the user and ask them to correct the path or remove it
3. Store verified paths for assignment to relevant delegates in Step 4

If the user says "skip", "none", or similar, proceed with no grounding files.

---

## Step 4 — Propose the panel

This is the core step. Based on the decision (Step 1) and risk dimensions (Step 2), infer and propose 3-5 delegates.

### Panel inference heuristic

Map the risk dimensions identified in Step 2 to delegate archetypes:

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

### Always-include rules

Every panel MUST have:
1. A **Chair** with `frame_propositions` — standard mode requires one for procedural facilitation
2. At least one delegate with `challenge_all` — adversarial review is the structural requirement

If no risk dimension naturally maps to a `challenge_all` role, add a **devil's advocate** with that capability. Every panel needs at least one adversarial voice.

### For each proposed delegate, generate:

- **`role`** — snake_case descriptive name (e.g., `security_reviewer`, `domain_guardian`, `devils_advocate`)
- **`capabilities`** — from the heuristic table above, as a list
- **`prompt_register`** — a quality register matching the role's perspective. Write these as vivid descriptions of the document voice, not generic labels. Examples from the reference composition:
  - "infrastructure documentation — written by an engineer who will be paged at 3 AM if it's wrong"
  - "legal brief — lead with conclusion, then evidence, then address the strongest counterargument before anyone raises it"
  - "product requirements doc — specific, measurable, testable"
- **`prompt`** — role-specific instructions derived from the user's decision and stakes. Write 2-4 sentences in second person ("You enforce...", "You represent..."). Be specific to the decision context, not generic.
- **`grounding`** — assign files from Step 3 if relevant to this role's perspective. Not every delegate needs grounding.

### Present the panel

Show the panel as a readable numbered list, NOT raw YAML:

```
Here's the panel I'd recommend:

1. **Chair** — Frames the proposition precisely. Procedural only, no advocacy. (frame_propositions)
2. **Security reviewer** — Evaluates auth and data exposure risks. Can veto invariant violations. (veto_invariant_violations)
3. **API designer** — Represents consumer ergonomics and contract stability. (none)
4. **Devil's advocate** — Manufactures failure scenarios, kills premature consensus. (challenge_all)

Does this panel look right? You can add, remove, or adjust any role.
```

Use `AskUserQuestion` to get approval. If the user wants changes:
- Apply the requested additions, removals, or adjustments
- Re-present the updated panel
- Ask for approval again

---

## Step 4b — Tone selection

Discover available tones by scanning both directories:

1. Use `Glob` to find `${CLAUDE_PLUGIN_ROOT}/tones/*.md` (plugin built-in tones)
2. Use `Glob` to find `.claude/delphi/tones/*.md` (user-defined tones)
3. For each discovered file, read the YAML frontmatter to extract `name` and `description`
4. Deduplicate by name — if a user-defined tone has the same name as a built-in, the user-defined version wins

Present the available tones using `AskUserQuestion`:

> Would you like to set a tone for this deliberation?
>
> Available tones:
> {for each tone: **{name}** — {description}}
>
> Or "none" for default deliberation style.

- If the user selects a tone: store the slug for inclusion in the YAML output (Step 6)
- If the user says "none", "skip", or similar: no tone field will be written

---

## Step 5 — Rules

Based on the decision context and stakes, propose deliberation rules:

- **`max_rounds`**: 2 for straightforward decisions, 3 for complex or high-stakes
- **`independent_positions`**: always `true` (anti-anchoring — delegates can't see each other)
- **`require_dissent_record`**: always `true`
- **`human_deferral`**: `true` if stakes are high (data loss, security, compliance from Step 2), `false` otherwise
- **`veto_roles`**: list the role names of any delegate with `veto_invariant_violations`

Present as a readable summary, NOT raw YAML:

```
Rules for this deliberation:

- Rounds: 3 (complex decision)
- Independent positions: yes (delegates can't see each other's positions)
- Human deferral: yes (high stakes — deadlocks get deferred to you)
- Veto power: security_reviewer, domain_guardian (can halt on invariant violations)
- Dissent record: always kept

Want to adjust anything?
```

Use `AskUserQuestion` to get approval. Apply any adjustments the user requests.

---

## Step 6 — Write the file

1. Propose the default output path: `./compositions/{slugified-name}.yml`

2. Use `AskUserQuestion` to confirm:

   > I'll write the composition to `./compositions/{name}.yml` — does that path work?

3. If the user suggests a different path, use that instead.

4. Assemble the composition YAML following this exact schema:

```yaml
name: {slugified-name}
mode: standard
tone: {tone slug from Step 4b, or omit this line entirely if "none" was selected}

delegates:
  - role: chair
    capabilities: [frame_propositions]
    prompt_register: "{register from Step 4}"
    prompt: >
      {prompt from Step 4}

  - role: {role_name}
    capabilities: [{capabilities}]
    prompt_register: "{register}"
    grounding: "{path if provided}"
    prompt: >
      {prompt}

  # ... remaining delegates

rules:
  max_rounds: {from Step 5}
  independent_positions: true
  require_dissent_record: true
  human_deferral: {from Step 5}
  veto_roles: [{from Step 5}]

output:
  include_transcript: true
  include_provenance: true
```

5. Use the `Write` tool to create the file.

6. Confirm to the user: "Composition written to `{path}`"

### YAML quality rules

- Delegate roles must be snake_case
- Prompts use YAML `>` folded scalar (multi-line text)
- Grounding paths are only included on delegates where they're relevant
- The `capabilities` field is omitted entirely for delegates with no capabilities (do NOT write `capabilities: []`)
- The composition must be valid YAML — no trailing whitespace issues, proper indentation

---

## Step 7 — Offer to run

Use `AskUserQuestion` to ask:

> Want to run this deliberation now?

- **If yes** and grounding files were provided: invoke the Skill tool with `/delphi --config {path}`
- **If yes** and no grounding files: invoke the Skill tool with `/delphi --config {path}`
- **If no**: display the command they'd use later:

```
When you're ready:
/delphi --config {path}
```

---

## Invariants

These must ALWAYS hold for any generated composition:

1. Every composition includes a Chair with `frame_propositions`
2. Every composition includes at least one delegate with `challenge_all`
3. Mode is always `standard` (lightweight doesn't need custom compositions)
4. Grounding file paths are verified before writing
5. Output YAML matches the schema used by `integration-review.yml`
6. The composition file is written to the user's project, not the plugin directory
7. `independent_positions` is always `true`
8. `require_dissent_record` is always `true`
9. If `tone` is set, the tone file must exist in either `${CLAUDE_PLUGIN_ROOT}/tones/` or `.claude/delphi/tones/`
