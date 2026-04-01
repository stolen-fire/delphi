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

### Anti-abbreviation rule

The engine MUST embed FULL, UNABRIDGED source code in every dispatch prompt. NEVER truncate, abbreviate, condense, summarize, or use `[...]` placeholders. Opus 4.6 has a 1M context window — there is no reason to abbreviate. Any abbreviation of code under review is a protocol violation.

File paths to `{docket-path}/code-under-review/` are also provided in every dispatch so delegates can use the Read tool to verify line numbers against the snapshot files.

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Full code (embedded) + conventions + Read tool file paths | Position defending the code |
| `challenger` | Challenge | Full code (embedded) + Read tool path to participant position | `## Challenges to: advocate` |
| `auditor` | Independent | Full code (embedded) + grounding file + Read tool file paths | Compliance report with coverage mandate |

### Sequential dispatch order (quick-path)

1. Advocate (participant) — receives full code in prompt, writes position
2. Critic (challenger) — receives full code in prompt, reads advocate position from docket via Read tool, writes challenges
3. Maintainer (challenger) — receives full code in prompt, reads advocate position from docket via Read tool (NOT critic), writes challenges
4. Enforcer (auditor, conditional) — receives full code in prompt + conventions, writes compliance report with coverage mandate
5. Advocate (participant) — responds to Critic + Maintainer challenges
6. Engine — coverage verification + synthesis + remediation plan

### Anti-anchoring

- Challengers receive full code but NOT the Advocate's position in their dispatch prompt
- Challengers read the Advocate's position from the docket via Read tool AFTER forming their independent assessment
- Neither challenger reads the other's challenges
- Enforcer reads only the code and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal

### Coverage verification

After all delegates complete, the engine builds a citation coverage map from all `[CITE: filename, line]` markers across all delegate outputs. Any contiguous range of 10+ lines with zero citations is a coverage gap. Gaps are reported in the synthesis — the engine does not attempt to audit them itself.

### Enforcer coverage mandate

The Enforcer must cite findings (pass, fail, or N/A) spanning every section of every reviewed file. Coverage that drops off partway through a file is an audit failure. The dispatch prompt explicitly instructs: "Check every line range of every file."

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
