---
name: standard-deliberation
description: >
  Standard deliberation protocol reference. 3-5 delegates with parallel
  position dispatch, anti-anchoring enforcement, Chair subagent for framing
  and decision writing, adversarial challenges, synthesis, dissent, and
  human deferral. Used by the main engine when mode is standard.
---

# Standard deliberation protocol

This document defines the rules for standard mode. The main engine skill reads this as a protocol reference.

## Mode characteristics

- **Delegates:** 3-5 participating (Chair does not count against limit)
- **Dispatch:** Parallel where independent, sequential where dependent
- **Independent positions:** Yes. All delegates dispatched simultaneously — anti-anchoring architecturally enforced via isolated subagent context windows
- **Chair subagent:** Yes. Dispatched for proposition framing and decision.md writing
- **Max rounds:** Up to 3
- **Anti-anchoring:** Enforced — no delegate sees another's position until the challenge phase

## Parallel dispatch rules

### Parallelizable phases (dispatch ALL in a single Agent tool call)

- **Position statements:** Every delegate reads the same proposition, writes to a different file. Each runs in an isolated context window — cannot see other delegates' output.
- **Challenge responses:** Each delegate responds to their own challenges independently.
- **Position statements in round 2+:** Same as round 1, with compressed context.

### Sequential phases (must wait for prior results)

- **Chair proposition framing:** Must complete before any delegate receives input.
- **Adversarial challenges:** Requires all position statements as input.
  - One `challenge_all` delegate: single dispatch (sequential)
  - Multiple `challenge_all` delegates: dispatch in parallel
- **Engine synthesis:** Requires all positions, challenges, and responses. Always sequential.

### The rule

**NEVER dispatch in parallel when the output of one agent is input to another.** Parallel dispatch is only for independent work (same inputs, different outputs).

## Protocol flow

```
ROUND 1:

1.  Engine reads composition + input artifacts
2.  Chair subagent dispatched to frame proposition → proposition.md

    ┌─── PARALLEL DISPATCH ──────────────────────────────────┐
3.  │ Delegate A dispatched with proposition → position A     │
    │ Delegate B dispatched with proposition → position B     │
    │ Delegate C dispatched with proposition → position C     │
    └─── ALL COMPLETE BEFORE PROCEEDING ─────────────────────┘

4.  Engine collects all position files

5.  Adversarial delegate(s) dispatched with ALL positions → challenges

    ┌─── PARALLEL DISPATCH ──────────────────────────────────┐
6.  │ Delegate A → response to challenges directed at A       │
    │ Delegate B → response to challenges directed at B       │
    └─── ALL COMPLETE BEFORE PROCEEDING ─────────────────────┘

7.  Engine produces synthesis (rule-governed categorization)
    → settled points, contested points

8.  If contested points remain and rounds < max_rounds → ROUND 2
```

## Chair dispatch protocol

The Chair is dispatched as a subagent for exactly two tasks:

1. **Proposition framing** (before round 1): Read input artifacts, write `proposition.md` as a decidable question that forces delegates to take positions.

2. **Decision writing** (after final synthesis): Read all synthesis documents, positions, challenges, and responses. Write `decision.md` as the authoritative artifact. Apply the quality register from the composition.

The Chair is NOT dispatched during position, challenge, or response phases. Those are delegate tasks. The Chair is NOT dispatched for synthesis — that is engine logic.

## Anti-anchoring enforcement

Each delegate's dispatch package for the position phase includes ONLY:
- Their role description and quality register
- The proposition (from Chair)
- Input artifacts (from user)
- Their grounding material (if specified)

It does NOT include:
- Any other delegate's position
- Any prior round's positions (in round 1)
- The composition's other delegate definitions

Anti-anchoring is reinforced by parallel dispatch: all delegates run in isolated context windows simultaneously. They literally cannot see each other.

## Context compression for rounds 2+

The engine compresses at every round boundary:

**Written to docket files (permanent, full fidelity):** Complete position statements, challenges, responses.

**Compiled for next-round dispatch (compressed):**
- Settled points: listed by name only — "The following are settled: {list}. Do not revisit."
- Contested points: for each — brief summary of the challenge, the insufficient response, and what needs to be addressed
- This delegate's own prior positions (for consistency across rounds)
- Relevant grounding material (unchanged)

## Veto mechanics

A delegate with `veto_invariant_violations` capability (listed in `rules.veto_roles`) can register a veto during the response phase:

- `[ACTION: VETO]` with `[CITE: grounding-file, invariant]`
- A veto cites a specific domain invariant that the proposition violates
- A veto is a correctness constraint, not a preference

Engine handling:
1. Vetoed point marked as `vetoed` (not merely `contested`)
2. Vetoed points CANNOT be resolved by subsequent rounds
3. If any point vetoed → deliberation outcome = `vetoed`
4. Engine produces a deferral-like package identifying the invariant violation and required revision
5. A veto from a delegate NOT listed in `rules.veto_roles` is treated as dissent

## Human deferral

When contested points remain after `max_rounds` and `human_deferral: true`:

1. Engine reads `${CLAUDE_PLUGIN_ROOT}/templates/deferral.md`
2. Assembles the deferral package with:
   - Settled points (for context)
   - Each contested point with both sides' positions
   - Why this needs human judgment (what the delegates lack — organizational context, business priority, etc.)
   - Concrete options the human can choose between
3. Writes `deferral.md` to the docket
4. Presents the deferral to the user in the conversation

## Dissent

Any delegate can register `[ACTION: DISSENT]` during the response phase. This means:
- "I accept the emerging majority position"
- "But I want it on the record that {specific concern}"
- "This is a risk flag, not a veto"

The engine records dissent as settled-with-dissent (the point is not contested — the dissenter explicitly accepted the position). Dissent is recorded in `dissent.md` and `docket.json`.
