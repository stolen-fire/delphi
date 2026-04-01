# Synthesis — Round {N}

## Settled points

Points where all challenges were addressed with evidence, conceded, or accepted with dissent.

| Point | Defender | Action | Evidence | Citation quality |
|-------|----------|--------|----------|-----------------|
| {description} | {role} | DEFEND | [CITE: ...] present | Independent |
| {description} | {role} | DEFEND | [CITE: ...] present | ⚠ Self-referential |
| {description} | {role} | CONCEDE | Position updated | — |
| {description} | {role} | DISSENT | Concern recorded | — |

## Contested points

Points where challenges received unsupported defense or no response.

| Point | Challenger | Issue | Status |
|-------|-----------|-------|--------|
| {description} | {role} | Defense without [CITE:] | Unsupported |
| {description} | {role} | No [ACTION:] tag | Unaddressed |

## Vetoed points

[If any — invariant violations cited by veto-capable delegates. Vetoed points cannot be resolved by subsequent rounds.]

| Point | Vetoer | Invariant | Grounding |
|-------|--------|-----------|-----------|
| {description} | {role} | {invariant} | [CITE: ...] |

## Round outcome

- Total challenges: {N}
- Settled: {N}
- Contested: {N}
- Vetoed: {N}
- Status: {All settled → ratified | Contested points remain → proceed to round {N+1} | Max rounds reached → forced/deferred | Vetoed → vetoed}

## Convention checking

{One of:}
- Convention checking: lint ({N} errors, {M} warnings from {tools})
- Convention checking: Enforcer (LLM fallback — no linter config detected)
- Convention checking: skipped (no linter config or conventions doc provided)

{If lint: "Lint findings are embedded in the proposition and included in the remediation plan."}
{If Enforcer: "Full report: compliance/enforcer-report.md"}

## Cartographer findings

{If Cartographer ran:}
- Component replacements proposed: {N}
- Variant corrections proposed: {N}
- Sub-component opportunities proposed: {N}
- Total violations eliminable: {N}

{If Cartographer did not run: omit this section}
