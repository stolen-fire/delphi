# Code review deliberation protocol rules

This document defines the rules for code-review mode. The engine reads this as a protocol reference during code review deliberations.

## Mode characteristics

- **Delegates:** 3 default (Advocate, Critic, Maintainer) + Cartographer (always) + conditional Enforcer
- **Lint pre-phase:** Engine auto-detects and runs linters before delegate dispatch. Lint replaces Enforcer as default convention checker.
- **Dispatch:** Sequential — Cartographer first (after lint), then Advocate, then challengers independently
- **Independent challenges:** Yes. Critic and Maintainer do not read each other's output (anti-anchoring). Cartographer does not read Advocate position.
- **Enforcer:** Fallback only — activated when no linter config detected AND `--conventions` is provided
- **Remediation plan:** Always generated — engine builds actionable plan from lint findings + synthesis + Cartographer findings + compliance findings
- **Max rounds:** 1 for quick-path, configurable via composition
- **Code snapshot:** Input files/diff copied to `code-under-review/` for docket reproducibility

## Delegate dispatch rules

### Anti-abbreviation rule

The engine MUST embed FULL, UNABRIDGED source code in every dispatch prompt. NEVER truncate, abbreviate, condense, summarize, or use `[...]` placeholders. Opus 4.6 has a 1M context window — there is no reason to abbreviate. Any abbreviation of code under review is a protocol violation.

File paths to `{docket-path}/code-under-review/` are also provided in every dispatch so delegates can use the Read tool to verify line numbers against the snapshot files.

### Role type dispatch contract

| Role type | Phase | Input | Output |
|-----------|-------|-------|--------|
| `participant` | Position | Full code (embedded) + lint findings + conventions + Cartographer findings + Read tool file paths | Position defending the code |
| `challenger` (Cartographer) | Pre-position challenge | Full code (embedded) + lint findings + grounding file (if provided) | Replacement Map with `## Challenges to: advocate` |
| `challenger` (Critic/Maintainer) | Post-position challenge | Full code (embedded) + lint findings + Read tool path to participant position | `## Challenges to: advocate` |
| `auditor` | Independent (fallback) | Full code (embedded) + grounding file + Read tool file paths | Compliance report with coverage mandate |

### Sequential dispatch order (quick-path)

1. Engine — lint pre-phase (auto-detect linters, run, embed findings in proposition)
2. Engine — Enforcer fallback decision (if no linter config AND conventions provided → dispatch Enforcer)
3. Cartographer (challenger) — receives full code + lint findings in prompt, writes Replacement Map with challenges
4. Advocate (participant) — receives full code + lint findings + Cartographer challenges in prompt, writes position
5. Critic (challenger) — receives full code + lint findings in prompt, reads Advocate position from docket via Read tool, writes challenges
6. Maintainer (challenger) — receives full code + lint findings in prompt, reads Advocate position from docket via Read tool (NOT Critic or Cartographer), writes challenges
7. Advocate (participant) — responds to Cartographer + Critic + Maintainer challenges
8. Engine — coverage verification + synthesis + remediation plan

### Anti-anchoring

- Challengers receive full code but NOT the Advocate's position in their dispatch prompt
- Challengers read the Advocate's position from the docket via Read tool AFTER forming their independent assessment
- Neither challenger reads the other's challenges
- Enforcer reads only the code and conventions — no positions or challenges
- Independent findings that converge across challengers are a strong signal

### Lint pre-phase rules

The engine detects and runs linters as engine logic (not a subagent) before any delegate dispatch.

**Detection:** Inspect file extensions of code under review and search for linter configs:

| File extensions | Linter | Config files searched |
|----------------|--------|---------------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | ESLint | `eslint.config.*`, `.eslintrc.*`, `package.json` (eslintConfig field) |
| `.css`, `.module.css` | Stylelint | `stylelint.config.*`, `.stylelintrc.*` |
| `.cs` | Roslyn Analyzers | `.editorconfig`, `Directory.Build.props`, `.globalconfig` |

**Execution:** Run detected linters via Bash, parse JSON output into normalized findings table.

**Decision tree:**
- Linter config found → run linter → embed findings in proposition → skip Enforcer
- No linter config + conventions provided → dispatch Enforcer (LLM fallback)
- No linter config + no conventions → skip convention checking, note in synthesis

**Failure handling:** Lint is best-effort. If a linter command fails, warn and proceed without lint findings. Do NOT fall back to Enforcer on lint failure (failure to lint ≠ no lint config).

**Composition override:** If composition YAML sets `lint.enabled: false`, skip lint and use the Enforcer path even if linter config exists.

### Cartographer dispatch contract

The Cartographer is a `challenger` that runs AFTER lint findings are known and BEFORE the Advocate takes a position. It does not read the Advocate's position — it forms an independent assessment of component selection.

**Input:** Full code (embedded) + lint findings (if available) + grounding file (if provided via composition `grounding:` field) + conventions doc (if provided)

**Output:** Replacement Map written to `{docket-path}/challenges/round-1-cartographer.md` — contains component replacements, variant corrections, sub-component opportunities, and a `## Challenges to: advocate` section.

**Anti-anchoring:** The Cartographer does NOT read the Advocate's position (the Advocate hasn't written one yet). The Cartographer does NOT read Critic or Maintainer output (they haven't run yet).

**Adversarial cycle:** The Advocate receives Cartographer challenges in their position prompt (not via Read tool — the Cartographer runs before the Advocate). The Advocate must DEFEND, CONCEDE, or DISSENT against each Cartographer challenge in their response phase (Phase 7, alongside Critic and Maintainer responses).

### Coverage verification

After all delegates complete, the engine builds a citation coverage map from all `[CITE: filename, line]` markers across all delegate outputs. Any contiguous range of 10+ lines with zero citations is a coverage gap. Gaps are reported in the synthesis — the engine does not attempt to audit them itself.

### Enforcer coverage mandate

The Enforcer must cite findings (pass, fail, or N/A) spanning every section of every reviewed file. Coverage that drops off partway through a file is an audit failure. The dispatch prompt explicitly instructs: "Check every line range of every file."

## Remediation plan generation

The engine (not a subagent) builds `remediation/plan.md` after synthesis:

### Priority mapping

| Source | Priority |
|--------|----------|
| Lint errors | Critical |
| Lint warnings | Recommended |
| Cartographer replacement — Advocate conceded or contested | Critical |
| Cartographer variant correction — Advocate conceded or contested | Critical |
| Cartographer sub-component opportunity — Advocate conceded or contested | Critical |
| Cartographer finding — Advocate dissented | Recommended |
| Cartographer finding — Advocate defended with evidence | Optional |
| Enforcer failures (fallback path only) | Critical |
| Contested points (no defense or unsupported defense) | Critical |
| `[ACTION: CONCEDE]` by Advocate | Critical or Recommended |
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

## MCP grounding rules

### Phase A: Deterministic prefetch

The engine parses the composition YAML `mcp:` field during initialization. If present, it loads MCP tools via ToolSearch, extracts component names from the code under review's import statements, and calls MCP tools for each detected component. Results are assembled into `{docket-path}/mcp-grounding.md` and injected into all dispatch prompts via `[MCP GROUNDING BLOCK]`.

**Required gate:** If `mcp.required` is `true` and the MCP server is unavailable, the engine halts. If `false` or omitted, the engine warns and proceeds without grounding.

**Token budget:** Bounded by what the code imports. The engine does not fetch the full component catalog — only components detected in import statements.

### Phase B: Verification fetch (code-review mode only)

After the Cartographer dispatches, the engine reads the Cartographer's replacement proposals and identifies components recommended that were not in the Phase A prefetch. These are components the code *should* use but doesn't import — the Cartographer's highest-value findings.

The engine fetches MCP data for these components and appends to `mcp-grounding.md`. This is a verification pipeline: the Cartographer asserts from training knowledge, the engine fetches authoritative documentation so the Advocate can evaluate the claim against real specs.

**Bounded scope:** One follow-up fetch, not a loop. If the Advocate discovers further components during response, those are flagged as "unverified claim" in synthesis rather than triggering another fetch.

### Delegate contract

Delegates never call MCP tools. They receive grounding as text in their dispatch prompts. Agent tool lists remain `[Read, Write]`. The engine owns all MCP interaction. This keeps agents framework-agnostic — the same Cartographer works for antd, Blazor, Material UI, or any library the composition configures.
