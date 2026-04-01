# Checkpoint: Delphi v0.7.0 code review protocol fix — ready for re-test

## Completed

- **Scorecard v1 produced** — Delphi v0.6.0 vs Vanilla CC scored against 46-violation manifest. Delphi: 38-42/46 (83-91%), Vanilla: 41/46 (89%). Delphi won on depth (15 vs 6 higher-order findings), lost on recall. Scorecard at `.deliberation/dockets/20260331-191253-review-dashboard-tsx/scorecard.md`
- **Root cause identified** — three protocol gaps: (1) engine abbreviated code in dispatch prompts, (2) challengers only saw code through the Advocate's lens, (3) no coverage verification
- **Plan written and crucible-reviewed** — `docs/superpowers/plans/2026-03-31-code-review-coverage-fixes.md`. Crucible found two blocking issues (condensed code proposal, unenforceable "read before position" instruction) which were corrected before execution
- **Protocol fixes implemented and released as v0.7.0** — three changes to `skills/delphi/SKILL.md` and `skills/code-review-deliberation/SKILL.md`:
  1. **Anti-abbreviation rule**: Engine MUST embed FULL, UNABRIDGED code in every dispatch. Never truncate. Hard rule.
  2. **Structural independent review**: Advocate's position EXCLUDED from Critic/Maintainer dispatch prompts. Challengers get full code + a Read tool path to the position in the docket. They read code first, form assessment, then read position and challenge.
  3. **Coverage verification**: Engine builds citation coverage map after all delegates. Reports gaps of 10+ uncited lines in synthesis. Detection only — no self-audit.
  4. **Enforcer coverage mandate**: Must cite findings spanning every section of every file. Explicit instruction: "If a file has 75 lines, your citations must span top to bottom."
  5. **Composition custom prompts**: All delegates now inject custom prompts from composition YAML when provided.
- **v0.7.0 released** — committed, tagged, pushed, GitHub release at https://github.com/stolen-fire/delphi/releases/tag/v0.7.0
- **Plugin reloaded** — `/reload-plugins` confirms v0.7.0 is active

## Current State

- **Docket directory created for v2 test** — `.deliberation/dockets/20260401-095427-review-dashboard-tsx/` with code-under-review/ snapshot copied
- **Proposition NOT yet written** — session was interrupted before the engine wrote proposition.md
- **No delegates dispatched yet** — the review has not started

## Next Actions

1. **Run the v0.7.0 review** — `/delphi-review --config compositions/antd-design-review.yml --conventions .docs/antd-v6-conventions.md src/components/Dashboard.tsx src/components/Dashboard.module.css`
   - This should be done in a fresh session. The current session has consumed significant context from the v0.6.0 run, plan writing, crucible review, and implementation.
2. **Score against manifest** — compare delegate outputs against the 46-violation manifest:
   - TSX target: 30/30 (was 29/30)
   - CSS target: 16/16 (was 9-13/16)
   - Higher-order target: >= 15 (was 15)
   - Coverage gaps target: 0 (was: Enforcer skipped CSS lines 50-74)
3. **Write scorecard v2** — side-by-side comparison: v0.6.0 Delphi vs v0.7.0 Delphi vs Vanilla CC

## Open Questions

- **Docket naming**: The partially-created docket `20260401-095427-review-dashboard-tsx` can be deleted or reused. A fresh `/delphi-review` invocation will create its own docket.
- **Vanilla re-test?**: Should Vanilla CC also be re-run for a clean comparison, or use the v1 results as baseline?

## Critical Context

### Test fixtures (do NOT modify for re-test)
- `src/components/Dashboard.tsx` — 271 lines, 30 planted violations (V1-V30)
- `src/components/Dashboard.module.css` — 75 lines, 16 planted violations (CSS1-CSS16)
- `compositions/antd-design-review.yml` — 4-delegate composition (Advocate, Design System Critic, Maintainer, Convention Enforcer), snarky tone
- `.docs/antd-v6-conventions.md` — 7-section conventions grounding file

### Violation manifest (scoring key)
Full manifest is in the scorecard at `.deliberation/dockets/20260331-191253-review-dashboard-tsx/scorecard.md`, Section 1. Key categories:
- §1 Component selection: 7 TSX violations (raw button, img, h2, h3, p, progress, input)
- §3 Layout/spacing: 6 TSX violations (display:flex, grid, Layout.Header/Content)
- §4 Design tokens: 8+ TSX violations, 10+ CSS violations (hardcoded hex colors, fontSize, borderRadius)
- §5 Forbidden patterns: 7 violations (internal imports, className on antd, .ant-* overrides, !important)
- §6 Composition: 4 violations (wrapper divs, no Card.Meta, manual form row)
- CSS-only: display:flex in modules (CSS1, CSS12), token values in formRow/dateInput area (CSS13-16)

### What Delphi missed in v0.6.0 (the bar to clear)
- V10 (Card.Meta) — Enforcer ruled N/A
- CSS1, CSS12 — display:flex in CSS modules
- CSS13-16 — formRow/dateInput token violations (Enforcer stopped reading after line ~48)
- `<Statistic>` component suggestion — no delegate proposed this highest-leverage refactor

### What Vanilla CC missed (Delphi's unique value)
- ConfigProvider no-op (sets antd defaults, does nothing)
- StatusBadge token bypass (passes hardcoded hex, not tokens)
- Dual filter UX conflict (two filter mechanisms, same column)
- borderRadius 12px vs ConfigProvider 8 conflict
- Disconnected date inputs (no state binding)
- 100vh scope ambiguity
- 4 naming issues (StatusBadge→StatusTag, filterOpen, `m` variable)

### Protocol changes to verify
The fresh session MUST confirm these behaviors in the delegate outputs:
1. Full unabridged code appears in every dispatch (check Advocate's position — line numbers should match source exactly)
2. Critic and Maintainer form independent assessments (check if they find things the Advocate didn't mention)
3. Enforcer cites violations across the FULL CSS file including lines 50-75
4. Engine reports coverage stats in synthesis
