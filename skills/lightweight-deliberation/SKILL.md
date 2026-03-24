---
name: lightweight-deliberation
description: >
  Lightweight deliberation protocol reference. 2 delegates (proposer + critic),
  sequential dispatch, no Chair subagent. Used by the main deliberate engine
  when mode is lightweight or when invoked inline.
---

# Lightweight deliberation protocol

This document defines the rules for lightweight mode. The main engine skill reads this as a protocol reference — it does not orchestrate anything itself.

## Mode characteristics

- **Delegates:** 2 (proposer + critic)
- **Dispatch:** Sequential (each step depends on the prior output)
- **Independent positions:** No. The critic sees the proposer's position — this is acceptable because the critic's role is adversarial by design. Seeing the position is a prerequisite for challenging it, not an anchoring risk.
- **Chair subagent:** No. The engine handles proposition framing (mechanically, from the user's input) and decision writing (using the built-in decision template).
- **Max rounds:** 1-2
- **Anti-anchoring:** Not applicable with only 2 delegates in adversarial roles

## Protocol flow

```
1. Engine frames proposition from user's input (no subagent)
2. Dispatch Proposer → position
3. Dispatch Critic with proposition + position → challenges
4. Dispatch Proposer with challenges → response (with [ACTION:] markers)
5. Engine performs synthesis (categorize per marker rules)
6. If all settled → decision (ratified)
7. If contested + rounds remaining → round 2 with narrowed scope
8. If contested + max rounds reached → terminal behavior
```

## Terminal behavior

When `max_rounds` exhausted with contested points remaining:

- **`human_deferral: true`** — engine produces `deferral.md` with competing positions and the specific question for the human.
- **`human_deferral: false`** — engine produces `decision.md` with the Proposer's final position as the ratified decision. The outcome is marked `"forced"` in `docket.json`. All unresolved challenges are recorded in the docket. The decision document notes which points were contested but resolved by default (proposer's position wins absent consensus).

## Round 2 narrowing

When proceeding to round 2, the engine compresses:

- **Settled points:** Listed by name only. These are no longer under deliberation — do not revisit.
- **Contested points:** Brief summary of the challenge and the proposer's insufficient response.
- **Proposer's prior position:** Included so the proposer maintains consistency.

The proposer addresses ONLY the contested points. The critic re-challenges ONLY the new responses.

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
