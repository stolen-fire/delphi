# Lightweight Protocol

Use this protocol when mode is lightweight (2 delegates, inline invocation, or lightweight YAML composition). All dispatch is sequential — each step depends on prior output.

## Shared references

Read these files as needed during execution:
- **Categorization rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md` — read during Phase 4 (synthesis)
- **Docket schema**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md` — read during Phase 6 (docket finalization)
- **Synthesis rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/synthesis-rules.md` — read during Phase 4
- **Response instructions**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/response-instructions.md` — reference for Phase 3 response dispatch

---

## Default composition (used for inline invocation)

```yaml
name: inline-review
mode: lightweight
delegates:
  - role: proposer
    prompt: >
      You propose and defend the approach under deliberation. Argue like
      an engineering design doc — direct assertions backed by evidence,
      no hedging, no "it depends."
  - role: critic
    capabilities: [challenge_all]
    prompt: >
      Every comfortable consensus conceals an untested assumption. Your
      job is to find it. Identify weaknesses, untested assumptions, and
      concrete failure scenarios. Do not soften your challenges.
rules:
  max_rounds: 2
  independent_positions: false
  require_dissent_record: true
  human_deferral: false
output:
  include_transcript: true
  include_provenance: true
```

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

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file, if any}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
Follow this template exactly:
{contents of position template}

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/proposer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch proposer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-proposer` agent definition.

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

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Proposer's position:
{contents of proposer.md}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: proposer"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1.md

Do not write to any other path. Do not output anything else.
```

### Step 2.2: Dispatch critic subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-critic` agent definition.

Output progress: `  Adversarial challenge... done`

---

## Phase 3: Response dispatch (proposer)

Output progress: `  Collecting proposer response...`

### Step 3.1: Extract challenges directed at proposer

Read `{docket-path}/challenges/round-1.md`. Extract the section under `## Challenges to: proposer` — everything from that header until the next `## Challenges to:` header or `## Shared blind spots` or end of file.

### Step 3.2: Assemble dispatch package

```
You are the Proposer. You are responding to adversarial challenges.

[TONE BLOCK]

## Your original position
{contents of positions/round-1/proposer.md}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

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

Dispatch using the `deliberation-proposer` agent definition.

Output progress: `  Collecting proposer response... done`

---

## Phase 4: Synthesis (engine logic — NOT a subagent)

Output progress: `  Synthesizing round 1...`

This phase is performed by YOU (the engine), not by a subagent. You are categorizing challenge-response pairs using structural markers. Do not apply judgment — check for marker presence.

### Step 4.1: Read all response files

Read `{docket-path}/responses/round-1/proposer.md`.

### Step 4.2: Categorize each challenge-response pair

For each challenge that was directed at the proposer, find the corresponding response and categorize using the **challenge-response categorization rules** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md`.

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

Write `{docket-path}/docket.json` using the **docket.json schema** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md`. For lightweight mode, use hardcoded delegate values (proposer with "engineering design doc" register, critic with "legal brief" register and `challenge_all`), `independent_positions: false`, and omit `veto_roles` and `parallel_dispatches`.

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
