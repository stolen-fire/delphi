---
name: code-review-deliberation
description: >
  Code review deliberation protocol reference. 3 default delegates (Advocate,
  Critic, Maintainer) with sequential dispatch, conditional Enforcer when
  conventions provided, and remediation plan output. Used by the main engine
  when mode is code-review.
---

# Code review deliberation protocol

This document defines the rules for code-review mode. The main engine skill reads this as a protocol reference.

## Mode characteristics

- **Delegates:** 3 default (Advocate, Critic, Maintainer) + conditional Enforcer
- **Dispatch:** Sequential — each phase depends on prior output except Enforcer (independent)
- **Independent challenges:** Yes. Critic and Maintainer do not read each other's output (anti-anchoring)
- **Enforcer:** Conditional — activated only when `--conventions` is provided or composition includes an auditor-type delegate with grounding
- **Remediation plan:** Always generated — engine builds actionable plan from synthesis + compliance findings
- **Max rounds:** 1 for quick-path, configurable via composition
- **Code snapshot:** Input files/diff copied to `code-under-review/` for docket reproducibility

## Delegate dispatch rules

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Code + conventions | Position defending the code |
| `challenger` | Challenge | Code + participant position | `## Challenges to: advocate` |
| `auditor` | Independent | Code + grounding file | Compliance report |

### Sequential dispatch order (quick-path)

1. Advocate (participant) — reads code, writes position
2. Critic (challenger) — reads code + advocate position, writes challenges
3. Maintainer (challenger) — reads code + advocate position (NOT critic), writes challenges
4. Enforcer (auditor, conditional) — reads code + conventions, writes compliance report
5. Advocate (participant) — responds to Critic + Maintainer challenges
6. Engine — synthesis + remediation plan

### Anti-anchoring

- Critic and Maintainer each read the Advocate's position independently
- Neither challenger reads the other's challenges
- Enforcer reads only the code and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal

## Remediation plan generation

The engine (not a subagent) builds `remediation/plan.md` after synthesis:

### Priority mapping

| Source | Priority |
|--------|----------|
| Contested points (no defense or unsupported defense) | Critical |
| `[ACTION: CONCEDE]` by Advocate | Critical or Recommended |
| Enforcer failures (convention violation) | Critical |
| `[ACTION: DISSENT]` by Advocate | Recommended |
| Defended with self-referential `[CITE:]` | Optional |
| Successfully defended but Maintainer-flagged | Optional |

### Constraint

Every remediation item MUST have a File + Lines + Action triple. The engine traces findings back to code locations via `[CITE:]` markers. Vague findings are excluded.

## Composition override

When `--config` provides a YAML with `mode: code-review`:
- The composition's delegates replace the default roster
- Engine uses `role_type` field from each delegate to determine dispatch pattern
- Participant delegates → position phase, respond in response phase
- Challenger delegates → challenge phase, output routed to participants
- Auditor delegates → independent dispatch, report appended
- Facilitator delegates → framing and decision (for compositions that include a Chair)
