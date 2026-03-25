# Standard Deliberation Engine — Design Spec

**Date:** 2026-03-24
**Status:** Draft
**Scope:** Implement standard deliberation mode in the engine skill (`skills/deliberate/SKILL.md`)

## Summary

Enable standard deliberation mode (3-5 delegates + Chair, parallel position dispatch, veto mechanics, anti-anchoring, context compression) in the existing engine. The protocol reference at `skills/standard-deliberation/SKILL.md` is already complete — this spec covers the engine changes to support it.

**Architecture decision:** Single engine file with phased dispatch table. Each phase checks the mode and calls the appropriate dispatch strategy. No separate engine skill for standard mode.

**Dispatch strategy:** Hybrid — parallel for independent phases (positions, responses, challenges with multiple critics), sequential for dependent phases (Chair framing, synthesis, decision).

---

## Phase 0 — Initialization & Mode Routing

### Extend the existing routing

Line 27 of `skills/deliberate/SKILL.md` already routes to the standard protocol reference when `mode: standard`. This routing must be preserved and extended with concrete dispatch logic for each phase below. The current instruction ("read the standard-deliberation protocol for dispatch rules") is correct but insufficient — the engine needs inline dispatch logic, not just a pointer to the protocol reference.

### Parse delegate roster (standard mode)

Read `delegates[]` from the composition. Each entry has: `role`, `prompt`, `prompt_register`, optional `capabilities[]`, optional `grounding[]`.

### Identify special roles

| Capability                     | Role type            | Agent definition        | Notes                           |
| ------------------------------ | -------------------- | ----------------------- | ------------------------------- |
| `frame_propositions`           | Chair                | `deliberation-chair`    | Exactly one per composition     |
| `challenge_all`                | Critic               | `deliberation-critic`   | One or more                     |
| `veto_invariant_violations`    | Position (with veto) | `deliberation-proposer` | Full position participant + veto in responses           |
| *(none of above)*              | Position             | `deliberation-proposer` | Standard position delegates     |

### Docket structure

Unchanged directory layout. Subdirectories already support multiple delegates:

- `positions/round-N/{role}.md`
- `challenges/round-N/{critic_role}.md` (new: per-critic files in standard mode)
- `responses/round-N/{role}.md`
- `synthesis/round-N.md`

### Chair dispatch (standard only)

Before positions, dispatch the Chair agent with the raw question + input artifacts. Chair produces `proposition.md`. The Chair never sees the delegate list or their prompts (procedural neutrality).

In lightweight mode, the engine frames the proposition directly (unchanged).

---

## Phase 1 — Position Dispatch

### Lightweight — unchanged

Single proposer dispatched sequentially.

### Standard mode

**Parallel dispatch** — all position delegates dispatched simultaneously in a single `Agent` tool call block.

**Anti-anchoring isolation** — each delegate's prompt includes ONLY:

- Their own `role` name and `prompt` (from composition)
- Their `prompt_register` (writing style directive)
- The proposition (from Chair's `proposition.md`)
- Their `grounding[]` files (read from user's project, relative paths)
- The position template (`templates/position.md`)
- The output file path

**Nothing else.** No other delegate names, composition structure, or other positions.

**Agent selection:** All position delegates use the `deliberation-proposer` agent definition. Role-specific behavior comes from the composition's `prompt` field.

**Output:** `{docket}/positions/round-1/{role}.md`

**Completion gate:** Engine waits for all parallel agents to return before proceeding.

---

## Phase 2 — Challenge Dispatch

### Lightweight — unchanged

Single critic challenges the single proposer.

### Standard mode

**Sequential dispatch** — challenges happen after all positions are collected.

**Critic input:**

- ALL position documents (critics must see all positions for cross-cutting analysis)
- The proposition
- Their own `prompt` and `prompt_register`
- The challenge template (`templates/challenge.md`)

**Challenge structure:** `## Challenges to: {role_name}` sections per position delegate, plus `## Shared blind spots`.

**Multiple critics:** If composition has multiple `challenge_all` delegates, each is dispatched in parallel (same anti-anchoring rationale as positions — critic ordering should not influence challenge framing). Duplicate challenges across critics are signal, not waste — the engine does not deduplicate. Output: `{docket}/challenges/round-1/{critic_role}.md`.

**Cross-position conflict flagging:** Critics are responsible for identifying contradictions between positions. When a critic detects that two delegates take incompatible stances on the same point, they flag it with `[CONFLICT: role_a vs role_b on {point}]` in the `## Shared blind spots` section. The engine parses this marker mechanically and classifies the point as **Contested (cross-delegate conflict)** in synthesis, regardless of individual DEFEND outcomes. This requires updating the critic agent definition — see Files Modified.

**Agent selection:** All critics use the `deliberation-critic` agent definition.

### Structural change

- Lightweight: single `challenges/round-1.md`
- Standard: `challenges/round-1/{critic_role}.md` (per-critic files)

The engine merges challenges when assembling response prompts — grouping all challenges directed at a given delegate regardless of which critic wrote them.

### Challenge header matching

Headers must match `## Challenges to: {role_name}` format (case-insensitive, whitespace-trimmed). The `{role_name}` must exactly match a role from the delegate roster. Sections with unmatched role names are appended to ALL position delegates as general challenges, ensuring no criticism is silently dropped.

---

## Phase 3 — Response Dispatch

### Lightweight — unchanged

Single proposer responds to critic's challenges.

### Standard mode

**Per-delegate challenge assembly** — engine collects all `## Challenges to: {role_name}` sections from all critic files, bundles per position delegate.

**Parallel dispatch** — all position delegates respond simultaneously (independent contexts).

**Response prompt includes:**

- Their original position (`positions/round-1/{role}.md`)
- Bundled challenges directed at them
- Action marker instructions: `DEFEND`, `CONCEDE`, `DISSENT`
- `VETO` instruction included ONLY if `role in composition.rules.veto_roles`
- Output file path

**Veto prompt gating:** Non-authorized delegates don't know veto exists. A veto from a non-authorized delegate (if somehow produced) is reclassified as dissent.

**Output:** `{docket}/responses/round-1/{role}.md`

---

## Phase 4 — Synthesis (Engine Logic, NOT a Subagent)

### Classification rules (shared)

| Marker                | Condition            | Classification                     |
| --------------------- | -------------------- | ---------------------------------- |
| `DEFEND` + `CITE`     | —                    | Settled                            |
| `DEFEND` without CITE | —                    | Contested (unsupported)            |
| `CONCEDE`             | —                    | Settled (position updated)         |
| `DISSENT`             | —                    | Settled with dissent               |
| `VETO` + `CITE`       | Role in `veto_roles` | Vetoed                             |
| `VETO`                | Role NOT in veto     | Reclassified as Dissent            |
| `CONFLICT`            | Flagged by critic    | Contested (cross-delegate conflict)|
| *(no marker)*         | —                    | Contested (unaddressed)            |

Marker parsing: case-insensitive, whitespace-flexible (existing behavior).

### Cross-delegate conflict detection (new, standard only)

The engine does NOT attempt semantic reasoning about contradictions. Instead, critics flag conflicts explicitly using `[CONFLICT: role_a vs role_b on {point}]` markers during Phase 2. The engine parses these mechanically: any point tagged with a `CONFLICT` marker is classified as **Contested (cross-delegate conflict)** regardless of individual DEFEND outcomes. This preserves the principle that synthesis is mechanical parsing, not evaluation.

### Synthesis output

Uses `templates/synthesis.md`. Existing table structure (settled, contested, vetoed) unchanged — the `Defender` column already tracks delegate ownership.

### Round outcome determination

| Condition                                          | Outcome              |
| -------------------------------------------------- | -------------------- |
| All settled, no vetoes                             | Ratified             |
| Vetoed points exist                                | Vetoed (terminal)    |
| Contested + rounds < max                           | Proceed to round N+1 |
| Contested + rounds = max + `human_deferral: true`  | Deferred             |
| Contested + rounds = max + `human_deferral: false` | Forced               |

### Context compression at round boundary

When proceeding to round N+1, the engine compiles compressed context per delegate:

**Settled context (shared across all delegates):**
> "The following points are settled and not under deliberation: {name1}, {name2}, ... Do not revisit these."

**Contested context (per delegate):**
> For each contested point: the challenge text, why the defense was insufficient (no CITE, unaddressed, or cross-delegate conflict), and what specifically needs to be addressed.

**Per-delegate dispatch for round N+1 positions:**

- Their own prior position from round N (for consistency)
- The settled context block
- The contested points directed at them
- Their grounding material (unchanged)
- Anti-anchoring still enforced: no other delegate's round N position included

**Per-delegate dispatch for round N+1 responses:** Same as round 1 response dispatch but with narrowed scope — only contested points from round N synthesis.

**Critics in round N+1:** Receive only the new position statements on contested points + the settled context block. No round N positions.

---

## Phase 5 — Decision & Docket Finalization

### Lightweight — unchanged

Engine writes `decision.md` directly.

### Standard mode — Chair dispatch for decision

Chair receives:

- The proposition
- All synthesis documents (all rounds)
- All position documents
- All dissent records
- The decision template (`templates/decision.md`)
- The outcome status

Chair writes `decision.md` with provenance table (decision / proposed by / challenged by / resolution). Chair does NOT evaluate arguments or soften/strengthen positions.

### Deferral path

Engine (not Chair) assembles `deferral.md` using `templates/deferral.md`. Mechanical assembly of contested points with both sides, rationale for human judgment, and concrete options.

### Veto path

Decision document identifies vetoed points, vetoing delegate, cited invariant, and grounding reference. No further rounds.

### Docket finalization

`docket.json` extended with:

- Full delegate roster (roles, capabilities)
- Per-round synthesis summaries
- Veto records (if any)
- Dissent records (if any)
- `dissent.md` written if any DISSENT actions registered

---

## Files Modified

| File                                       | Change                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `skills/deliberate/SKILL.md`               | Remove gate, add standard-mode routing at each phase |
| `skills/standard-deliberation/SKILL.md`    | No changes (protocol reference, already complete)    |
| `skills/lightweight-deliberation/SKILL.md` | No changes                                           |
| `agents/deliberation-chair.md`             | No changes (already defined)                         |
| `agents/deliberation-critic.md`            | Add `[CONFLICT:]` marker instructions for std mode   |
| `agents/deliberation-proposer.md`          | No changes                                           |
| `templates/*.md`                           | No changes (already support standard mode fields)    |
| `compositions/integration-review.yml`      | No changes (already a valid standard composition)    |

**Two files change:** `skills/deliberate/SKILL.md` (engine) and `agents/deliberation-critic.md` (CONFLICT marker).

---

## Invariants

1. Chair never sees delegate list, prompts, or composition structure
2. Position delegates never see each other's positions during dispatch (anti-anchoring)
3. Veto instructions only shown to `veto_roles` delegates
4. Synthesis is always engine logic, never a subagent
5. Action markers are case-insensitive and whitespace-flexible
6. Vetoed outcome is terminal — no subsequent rounds
7. Grounding files are relative to user's project, not plugin directory
