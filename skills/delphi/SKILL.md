---
name: delphi
description: >
  Main deliberation engine. Orchestrates structured multi-agent deliberation
  by dispatching delegate subagents, managing docket files, and performing
  synthesis. Use when the /delphi command is invoked or when another skill
  needs adversarial evaluation of an artifact.
---

# Deliberation engine

You are the deliberation engine. You orchestrate structured adversarial deliberation by dispatching delegate subagents, routing files between them, and performing mechanical synthesis. You are NOT a participant — you are the Chair in the procedural sense: you facilitate, you do not advocate.

---

## Phase 0: Initialization

When invoked, you receive either:
- An **inline question** (lightweight mode, no YAML)
- A **composition YAML path** + **input artifact paths** (configured mode)

### Step 0.1: Determine mode

- If you received an inline question with no `--config`: use the **hardcoded lightweight composition** defined in the lightweight-deliberation protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/lightweight-deliberation/SKILL.md`. Proceed to **Lightweight Protocol** below.
- If you received a `--config` path: read the YAML file, extract `mode:` field
  - If `mode: lightweight` (or 2 delegates): proceed to **Lightweight Protocol** below
  - If `mode: standard` (or 3+ delegates): proceed to **Standard Protocol** below

### Step 0.2: Create docket directory

Generate a docket name using the format `{YYYYMMDD}-{HHmmss}-{name}` where:
- Timestamp: current date and time
- Name: the composition's `name` field (if YAML), or a slugified version of the first 50 characters of the inline question (lowercase, spaces to hyphens, strip special characters)

Create the full directory structure using Bash `mkdir -p`:

```
.deliberation/dockets/{docket-name}/
  positions/round-1/
  challenges/
  responses/round-1/
  synthesis/
```

### Step 0.3: Write proposition

- **Lightweight inline:** Write the user's question directly to `proposition.md` in the docket directory. Frame it as a decidable question — if the user's input is vague, sharpen it into a specific proposition.
- **YAML with input artifacts:** Read each input artifact file. Write `proposition.md` with the question and a summary of the input artifacts.

Store the full docket path in a variable — every subsequent file write uses this base path.

---

---

# Lightweight Protocol

Use this protocol when mode is lightweight (2 delegates, inline invocation, or lightweight YAML composition). All dispatch is sequential — each step depends on prior output.

---

## Phase 1: Position dispatch (proposer)

Output progress: `Deliberation: {name}`
Output progress: `  Collecting proposer position...`

### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the proposer's dispatch prompt:

```
You are the Proposer in this deliberation.

## Your role
You propose and defend the approach under deliberation. Argue like an
engineering design doc — direct assertions backed by evidence, no hedging.

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file, if any}

## Output format
Follow this template exactly:
{contents of position template}

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/proposer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch proposer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-proposer` agent definition. Wait for completion.

After completion, verify the file exists at `{docket-path}/positions/round-1/proposer.md`. If not, check for the output in the subagent's response and write it to the correct path.

Output progress: `  Collecting proposer position... done`

---

## Phase 2: Challenge dispatch (critic)

Output progress: `  Adversarial challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the proposer's position from `{docket-path}/positions/round-1/proposer.md`.

Assemble the critic's dispatch prompt:

```
You are the Critic in this deliberation. Your capability is challenge_all.

## Proposition
{contents of proposition.md}

## Position to challenge

### Proposer's position:
{contents of proposer.md}

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: proposer"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1.md

Do not write to any other path. Do not output anything else.
```

### Step 2.2: Dispatch critic subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-critic` agent definition. Wait for completion.

Verify the file exists at `{docket-path}/challenges/round-1.md`.

Output progress: `  Adversarial challenge... done`

---

## Phase 3: Response dispatch (proposer)

Output progress: `  Collecting proposer response...`

### Step 3.1: Extract challenges directed at proposer

Read `{docket-path}/challenges/round-1.md`. Extract the section under `## Challenges to: proposer` — everything from that header until the next `## Challenges to:` header or `## Shared blind spots` or end of file.

### Step 3.2: Assemble dispatch package

```
You are the Proposer. You are responding to adversarial challenges.

## Your original position
{contents of positions/round-1/proposer.md}

## Challenges directed at you
{extracted challenges section}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag. The engine
parses these tags to determine whether your defense is adequate.

Available actions:
- [ACTION: DEFEND] — Refute the challenge with evidence. You MUST include at
  least one [CITE: filename, section] marker. Example:

  [ACTION: DEFEND]
  The latency concern is addressed by the connection pooling configuration.
  [CITE: api-contract.md, section 4.2] specifies a maximum pool size of 50
  with 30-second idle timeout, which benchmarks show handles 10k concurrent
  requests under 15ms p99.

- [ACTION: CONCEDE] — Accept the challenge as valid. State what changes in
  your position. Example:

  [ACTION: CONCEDE]
  The critic is correct that single-node Redis is a SPOF. My revised position
  adds Redis Cluster as a requirement for the session store.

- [ACTION: DISSENT] — Accept the majority position but record your concern.
  Example:

  [ACTION: DISSENT]
  I accept the JWT approach but want it on the record that token revocation
  latency under 50ms has not been empirically verified. This is a risk flag
  for implementation review.

Do NOT ignore any challenge. Do NOT respond without an [ACTION:] tag.

## CRITICAL: Write your output to this exact file path
Write your complete response to: {docket-path}/responses/round-1/proposer.md
```

### Step 3.3: Dispatch proposer subagent

Dispatch and wait for completion. Verify file exists.

Output progress: `  Collecting proposer response... done`

---

## Phase 4: Synthesis (engine logic — NOT a subagent)

Output progress: `  Synthesizing round 1...`

This phase is performed by YOU (the engine), not by a subagent. You are categorizing challenge-response pairs using structural markers. Do not apply judgment — check for marker presence.

### Step 4.1: Read all response files

Read `{docket-path}/responses/round-1/proposer.md`.

### Step 4.2: Categorize each challenge-response pair

For each challenge that was directed at the proposer, find the corresponding response and categorize:

| Markers found | Category |
|--------------|----------|
| `[ACTION: DEFEND]` AND one or more `[CITE:]` markers present | **Settled** |
| `[ACTION: DEFEND]` WITHOUT any `[CITE:]` marker | **Contested** (unsupported defense) |
| `[ACTION: CONCEDE]` | **Settled** (position updated) |
| `[ACTION: DISSENT]` | **Settled with dissent** (concern recorded) |
| `[ACTION: VETO]` AND `[CITE:]` marker present | **Vetoed** |
| No `[ACTION:]` tag found for this challenge | **Contested** (unaddressed) |

Be case-insensitive when checking for markers. Accept whitespace variations (e.g., `[ACTION:DEFEND]` or `[ACTION: DEFEND]`).

### Step 4.3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables with your categorization results.
Write to `{docket-path}/synthesis/round-1.md`.

### Step 4.4: Determine round outcome

- If ALL challenges are settled (including settled with dissent): **ratified**
- If ANY challenges are contested AND current round < max_rounds: **proceed to round 2**
- If ANY challenges are contested AND current round >= max_rounds:
  - If `human_deferral: true`: **deferred**
  - If `human_deferral: false`: **forced** (proposer's position wins)
- If ANY challenges are vetoed: **vetoed**

Output progress: `  Synthesis: {N} settled, {N} contested → {outcome}`

---

## Phase 5: Decision

### If ratified or forced

Read the decision template from `${CLAUDE_PLUGIN_ROOT}/templates/decision.md`.

Assemble `decision.md` with:
- **Outcome:** ratified, ratified with dissent, or forced
- **Ratified specification:** The proposer's final position (incorporating any concessions)
- **Provenance table:** For each key point — who proposed it, who challenged it, how it was resolved
- **Dissent record:** If any `[ACTION: DISSENT]` responses were registered
- **Unresolved challenges:** If forced — list all contested challenges that were not addressed

Write to `{docket-path}/decision.md`.

### If deferred

Read the deferral template from `${CLAUDE_PLUGIN_ROOT}/templates/deferral.md` (if it exists — Phase 4 deliverable).

Assemble `deferral.md` with settled points, contested points with both sides, and concrete options for the human.

Write to `{docket-path}/deferral.md`.

---

## Phase 6: Docket finalization

### Step 6.1: Assemble docket.json

Write a JSON file to `{docket-path}/docket.json` with this structure:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "composition": "{composition name}",
  "mode": "lightweight",
  "proposition_summary": "{first sentence of proposition.md}",
  "input_artifacts": ["{list of input file paths}"],
  "delegates": [
    {
      "role": "proposer",
      "prompt_register": "engineering design doc",
      "grounding": null,
      "capabilities": []
    },
    {
      "role": "critic",
      "prompt_register": "legal brief",
      "grounding": null,
      "capabilities": ["challenge_all"]
    }
  ],
  "rules": {
    "max_rounds": 2,
    "independent_positions": false,
    "require_dissent_record": true,
    "human_deferral": false
  },
  "rounds": [
    {
      "round": 1,
      "positions_filed": 1,
      "challenges_filed": 1,
      "responses_filed": 1,
      "synthesis_status": "{settled|contested|vetoed}",
      "contested_points": ["{list from synthesis}"]
    }
  ],
  "outcome": "{ratified|forced|deferred|vetoed}",
  "dissent": {
    "present": "{true|false}",
    "delegate": "{role if present}",
    "concern": "{concern text if present}"
  },
  "provenance": [
    {
      "decision": "{key decision}",
      "proposed_by": "proposer",
      "challenged_by": "critic",
      "challenge": "{challenge text}",
      "resolved_by": "proposer",
      "resolution": "{how resolved}"
    }
  ]
}
```

### Step 6.2: Write dissent.md (if applicable)

If any `[ACTION: DISSENT]` was registered, write `{docket-path}/dissent.md` with:
- Delegate role
- Accepted position
- Specific concern
- Recommended action
- Status: "Accepted under protest"

### Step 6.3: Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Then present the contents of `decision.md` to the user in the conversation. The docket is the permanent record; the conversation output is the immediate summary.

---

## Round 2 (if needed)

If Phase 4 determined "proceed to round 2":

### Narrow scope

1. Create `{docket-path}/positions/round-2/` and `{docket-path}/responses/round-2/`
2. Compile compressed context:
   - **Settled points:** List by name only — "The following are settled and not under deliberation: {list}"
   - **Contested points:** For each — brief summary of the challenge and why the defense was insufficient
   - **Proposer's prior position:** Include for consistency

### Dispatch round 2

Repeat Phases 1-4 with the narrowed scope:
- Proposer receives compressed context + contested points only
- Critic receives proposer's new position on contested points only
- Proposer responds to new challenges
- Engine synthesizes round 2

Update `docket.json` rounds array with round 2 data.

If still contested after round 2, apply terminal behavior (forced or deferred per rules).

---
---

# Standard Protocol

Use this protocol when mode is standard (3-5 delegates + Chair, YAML composition with `mode: standard`). Parallel dispatch where independent, sequential where dependent. Anti-anchoring enforced.

Read the full protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/standard-deliberation/SKILL.md` for detailed rules on parallel dispatch, veto mechanics, human deferral, and context compression.

---

## Standard Phase 0: Parse composition

Read the YAML composition file. Extract:
- **Delegates list:** Each delegate's role, prompt, prompt_register, capabilities, grounding
- **Chair:** The delegate with `frame_propositions` capability (typically first in the list)
- **Adversarial delegates:** All delegates with `challenge_all` capability
- **Participating delegates:** All delegates EXCEPT the Chair (these take positions)
- **Rules:** max_rounds, independent_positions, require_dissent_record, human_deferral, veto_roles

### Delegate resolution

For each delegate role in the composition:
1. Check for project-level agent: `.claude/agents/deliberation-{role}.md` — if found, use it
2. Fall back to plugin built-in: `${CLAUDE_PLUGIN_ROOT}/agents/deliberation-{role}.md`
3. If neither exists: use the YAML `prompt` field directly (no agent file required)

**Prompt precedence when both agent file and YAML exist:**
- YAML `prompt` replaces the agent file body text
- YAML `prompt_register`, `capabilities`, `grounding` override agent frontmatter
- Agent file `tools` restriction always applies

### Validation

- Minimum 2 participating delegates (Chair does not count)
- Maximum 5 participating delegates
- At least one delegate must have `challenge_all` capability
- If `veto_roles` is set, those roles must exist in the delegate list

### Tone loading

If the composition YAML contains a `tone` field:

1. Read the `tone` value (e.g., `snarky`)
2. Attempt to read `.claude/delphi/tones/{tone}.md` — if found, use it
3. Otherwise, attempt to read `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` — if found, use it
4. If neither exists: output a warning (`Warning: tone '{tone}' not found, proceeding without tone`) and set tone content to empty — do not fail the deliberation
5. If found: extract the `## Voice directive` section content and the `## Examples` section content from the file body — these are the tone injection payloads used in all subsequent dispatch phases

If the composition YAML does not contain a `tone` field, skip tone loading entirely. No tone will be injected into dispatch prompts.

---

## Standard Phase 1: Chair proposition framing

Output progress: `Deliberation: {composition name} (standard mode, {N} delegates)`
Output progress: `  Framing proposition (Chair)...`

Dispatch the Chair as a subagent using the `deliberation-chair` agent definition:

```
You are the Chair. Frame the proposition for deliberation.

## Your role
{Chair's prompt from composition YAML}

## Quality register
{Chair's prompt_register from composition YAML}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Your task
Restate the following question as a decidable proposition — one that forces
delegates to take a clear position for or against. Identify the specific
tension that makes this decision non-obvious.

## The question
{user's question or "delphi on the provided input artifacts"}

## Input artifacts
{contents of each input artifact file}

## CRITICAL: Write your output to this exact file path
Write the framed proposition to: {docket-path}/proposition.md
```

Wait for completion. Verify `{docket-path}/proposition.md` exists.

Output progress: `  Framing proposition... done`

---

## Standard Phase 2: Parallel position dispatch

Output progress: `  Round {N} — Collecting positions ({count} delegates, parallel)...`

### Anti-anchoring enforcement

Each delegate receives ONLY:
- Their role description and quality register
- The proposition (from Chair)
- Input artifacts (from user)
- Their grounding material (if specified in YAML)

Each delegate does NOT receive:
- Any other delegate's position
- The composition's other delegate definitions

### Assemble dispatch packages

For EACH participating delegate (not the Chair, not challenge-only delegates):

```
You are the {role_name} in this deliberation.

## Your role
{delegate's prompt from composition YAML or agent file}

## Your capabilities
{delegate's capabilities list, or "none (standard delegate)"}

## Quality register
{delegate's prompt_register — this is how your output should read}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Grounding material
{contents of grounding file if specified, otherwise "none provided"}

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file}

## Output format
Follow this template exactly:
{contents of position template from ${CLAUDE_PLUGIN_ROOT}/templates/position.md}

Write "# Position: {role_name}" as your heading.

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/positions/round-{N}/{role_name}.md

Do not write to any other path. Do not output anything else.
```

### Dispatch ALL positions in a single response

Dispatch ALL participating delegate subagents simultaneously in one response. Each runs in an isolated context window — they cannot see each other. This is how anti-anchoring is architecturally enforced.

Wait for ALL to complete. Verify each position file exists.

Output progress: `  Round {N} — Collecting positions... done`

---

## Standard Phase 3: Adversarial challenge dispatch

Output progress: `  Round {N} — Adversarial challenge ({count} delegate)...`

Collect ALL position files from `{docket-path}/positions/round-{N}/`.

For each delegate with `challenge_all` capability, assemble:

```
You are the {role_name} with challenge_all capability. You MUST challenge
every position.

## Your role
{delegate's prompt from YAML or agent file}

## Quality register
{delegate's prompt_register}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Proposition
{contents of proposition.md}

## All positions to challenge

{For EACH position file, include:}
### {role_name}'s position:
{contents of positions/round-{N}/{role_name}.md}

---

## Output format
You MUST structure your output with explicit per-delegate headers.
Use this exact format for EACH delegate you challenge:

## Challenges to: {exact_role_name}

### Weakest claim
[Attack the claim with the least support]

### Untested assumption
[Name something taken as given without evidence]

### Failure scenario
[A concrete scenario where the approach fails]

Repeat for EACH delegate position.

Then add:

## Shared blind spots
[Where do delegates agree without testing that agreement?]

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/challenges/round-{N}.md
```

- If ONE adversarial delegate: dispatch sequentially (single subagent)
- If MULTIPLE adversarial delegates: dispatch in parallel, each writes to `challenges/round-{N}-{role}.md`

Wait for completion. Verify challenge file(s) exist.

Output progress: `  Round {N} — Adversarial challenge... done`

---

## Standard Phase 4: Parallel response dispatch

Output progress: `  Round {N} — Collecting responses ({count} delegates, parallel)...`

### Route challenges to each delegate

Read the challenge document(s). For each participating delegate (except the adversarial delegate who wrote the challenges):

1. Extract the section under `## Challenges to: {role_name}` — everything from that header until the next `## Challenges to:` header or `## Shared blind spots` or end of file
2. If no section exists for this delegate, they were not challenged — skip them

### Assemble response dispatch packages

For each challenged delegate:

```
You are the {role_name}. You are responding to adversarial challenges.

## Your role
{delegate's prompt}

## Quality register
{delegate's prompt_register}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Your original position
{contents of positions/round-{N}/{role_name}.md}

## Challenges directed at you
{extracted challenges section for this delegate}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag.

Available actions:
- [ACTION: DEFEND] — Refute with evidence. MUST include [CITE: filename, section].
- [ACTION: CONCEDE] — Accept the challenge. State what changed in your position.
- [ACTION: DISSENT] — Accept majority position but record your concern.
{if delegate is in veto_roles:}
- [ACTION: VETO] — Cite a specific domain invariant violation from your grounding
  material. MUST include [CITE: grounding-file, invariant]. A veto is a correctness
  constraint, not a preference.

Do NOT ignore any challenge. Every challenge gets exactly one action tag.

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/responses/round-{N}/{role_name}.md
```

### Dispatch ALL responses in a single response

Dispatch all challenged delegates simultaneously. Wait for ALL to complete. Verify each response file exists.

Output progress: `  Round {N} — Collecting responses... done`

---

## Standard Phase 5: Synthesis (engine logic — NOT a subagent)

Output progress: `  Round {N} — Synthesis...`

This phase is performed by YOU (the engine). Same categorization rules as lightweight mode.

### Read all response files

Read every file in `{docket-path}/responses/round-{N}/`.

### Categorize each challenge-response pair

For each delegate's response, for each challenge directed at them:

| Markers found | Category |
|--------------|----------|
| `[ACTION: DEFEND]` with `[CITE:]` | **Settled** |
| `[ACTION: DEFEND]` without `[CITE:]` | **Contested** (unsupported) |
| `[ACTION: CONCEDE]` | **Settled** (position updated) |
| `[ACTION: DISSENT]` | **Settled with dissent** |
| `[ACTION: VETO]` with `[CITE:]` | **Vetoed** |
| No `[ACTION:]` tag | **Contested** (unaddressed) |

Be case-insensitive. Accept whitespace variations.

### Write synthesis

Write to `{docket-path}/synthesis/round-{N}.md` using the synthesis template.

### Determine round outcome

- ALL settled (including with dissent): **ratified** → proceed to Standard Phase 6
- ANY contested AND rounds < max_rounds: **proceed to next round** (Standard Phase 7)
- ANY contested AND rounds >= max_rounds:
  - `human_deferral: true`: **deferred**
  - `human_deferral: false`: **forced**
- ANY vetoed: **vetoed**

Output progress: `  Round {N} — Synthesis: {settled} settled, {contested} contested → {outcome}`

---

## Standard Phase 6: Decision (Chair subagent + engine finalization)

### Chair writes decision.md

Output progress: `  Writing decision (Chair)...`

Dispatch the Chair subagent to write the ratified decision:

```
You are the Chair. Write the ratified decision document.

## Your role
{Chair's prompt}

## Quality register
{Chair's prompt_register}

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

## Your task
Read all deliberation materials and write decision.md — the authoritative
artifact the user will act on.

## Deliberation materials

### Proposition
{contents of proposition.md}

### Synthesis (all rounds)
{contents of each synthesis/round-{N}.md}

### Final positions
{contents of each delegate's latest position file}

### Challenges
{contents of challenge files}

### Responses
{contents of each delegate's response files}

## Outcome: {ratified | ratified with dissent | forced | deferred | vetoed}

## Instructions
- Write the decision as a coherent specification, not a summary
- Include a provenance table: for each key decision, who proposed, who challenged, how resolved
- If dissent was registered, include the dissent record
- If deferred, include the competing positions and the specific question for the human

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/decision.md
```

Wait for completion. Verify file exists.

Output progress: `  Writing decision... done`

### Engine writes docket.json

Assemble `docket.json` with:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "composition": "{composition name from YAML}",
  "mode": "standard",
  "proposition_summary": "{first sentence of proposition.md}",
  "input_artifacts": ["{list of input file paths}"],
  "delegates": [
    {
      "role": "{role}",
      "prompt_register": "{prompt_register}",
      "grounding": "{grounding path or null}",
      "capabilities": ["{capabilities}"]
    }
  ],
  "rules": {
    "max_rounds": "{from YAML}",
    "independent_positions": true,
    "require_dissent_record": "{from YAML}",
    "human_deferral": "{from YAML}",
    "veto_roles": ["{from YAML}"]
  },
  "rounds": [
    {
      "round": 1,
      "positions_filed": "{count}",
      "challenges_filed": "{count}",
      "responses_filed": "{count}",
      "synthesis_status": "{settled|contested|vetoed}",
      "contested_points": ["{list}"],
      "parallel_dispatches": [
        {"phase": "positions", "delegates": "{count}", "parallel": true},
        {"phase": "challenges", "delegates": "{count}", "parallel": "{true if multiple challenge_all}"},
        {"phase": "responses", "delegates": "{count}", "parallel": true}
      ]
    }
  ],
  "outcome": "{ratified|ratified_with_dissent|forced|deferred|vetoed}",
  "dissent": {
    "present": "{true|false}",
    "delegate": "{role}",
    "concern": "{concern text}"
  },
  "provenance": [
    {
      "decision": "{key decision}",
      "proposed_by": "{role}",
      "challenged_by": "{role}",
      "challenge": "{challenge text}",
      "resolved_by": "{role or consensus}",
      "resolution": "{how resolved}"
    }
  ]
}
```

### Write dissent.md (if applicable)

If any delegate used `[ACTION: DISSENT]`, write `{docket-path}/dissent.md`.

### Write deferral.md (if applicable)

If outcome is deferred, read `${CLAUDE_PLUGIN_ROOT}/templates/deferral.md` and assemble the deferral package with settled points, contested points with both sides, and concrete options for the human.

If outcome is vetoed, write a deferral-like package identifying the invariant violation and required revision.

### Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Present `decision.md` contents to the user. If deferred or vetoed, present `deferral.md` and ask the user for their decision.

---

## Standard Phase 7: Round 2+ (narrowed scope)

If synthesis determined "proceed to next round":

### Create round directories

```
mkdir -p {docket-path}/positions/round-{N}/
mkdir -p {docket-path}/responses/round-{N}/
```

### Compile compressed context

For each delegate's next-round dispatch:
- **Settled points:** List by name only — "The following are settled and not under deliberation: {list}"
- **Contested points:** For each — brief summary of the challenge and why the defense was insufficient
- **This delegate's prior positions:** Include for consistency across rounds
- **Grounding material:** Unchanged

### Dispatch narrowed round

Repeat Standard Phases 2-5 with compressed context:
- Position dispatch packages include compressed context instead of full proposition
- Delegates address ONLY contested points — do not revisit settled points
- Adversarial delegate re-challenges only the new positions
- Synthesis categorizes the new responses

Update `docket.json` rounds array with round N data.

If still contested after max_rounds, apply terminal behavior per rules (deferred or forced).
