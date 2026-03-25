---
name: deliberate
description: >
  Main deliberation engine. Orchestrates structured multi-agent deliberation
  by dispatching delegate subagents, managing docket files, and performing
  synthesis. Use when the /deliberate command is invoked or when another skill
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

- If you received an inline question with no `--config`: use the **hardcoded lightweight composition** defined in the lightweight-deliberation protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/lightweight-deliberation/SKILL.md`
- If you received a `--config` path: read the YAML file, extract `mode:` field (lightweight or standard)

If the composition specifies `mode: standard`, read the standard-deliberation protocol at `${CLAUDE_PLUGIN_ROOT}/skills/standard-deliberation/SKILL.md` for dispatch rules (parallel positions, Chair subagent for proposition framing and decision writing, anti-anchoring, veto mechanics). The phases below still apply but dispatch patterns differ per the standard protocol.

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
