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

## Code review escape hatch

After capturing the decision, assess whether the user is describing a code review (reviewing existing code for quality, compliance, or correctness) rather than a decision deliberation.

Signal phrases: "review code", "check code", "audit", "compliance", "code quality", "review my implementation", "review these files", "design system", "convention check"

If it seems like a code review, use `AskUserQuestion` to ask:

> This sounds like a code review rather than a decision deliberation. Would you like me to build a code review composition (`mode: code-review`) or a standard deliberation?

If code review: proceed to **Code Review Composition** below.
If standard deliberation: proceed to the lightweight escape hatch as normal.

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

### Evidence submission

Use `AskUserQuestion` to ask:

> Do you have a directory of source documents (PDFs, court filings, reports) that delegates should be able to verify claims against? If so, provide the path. Otherwise, type "none".

If the user provides a path:
- Verify the path exists using Glob
- Note it as the evidence field for the YAML output
- Explain: "Evidence files will be converted to searchable text and made available to all delegates. An evidence index with conversion provenance will be generated."

If "none", omit the evidence field from the YAML.

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

**New capabilities (assign based on panel needs):**
- `research_authority` — Pre-deliberation research via Scout. Assign to domain specialists who need to verify legal precedent, technical standards, or regulatory requirements. Produces a shared appendix.
- `verify_sources` — Mid-deliberation factual verification via Scout + Read. Assign to auditor/reviewer roles responsible for evidence integrity. Records a verification log.

These capabilities are independent of `challenge_all` and `veto_invariant_violations`. A delegate can have multiple capabilities (e.g., a law specialist with both `challenge_all` and `research_authority`).

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
evidence: {path from evidence question, or omit if none}

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
10. Code review compositions must have `mode: code-review`
11. Code review compositions must have at least one `participant` and one `challenger` by `role_type`
12. Auditor delegates in code review compositions must have a `grounding` file
