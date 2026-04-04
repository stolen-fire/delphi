# Delphi

**Structured multi-agent deliberation for Claude Code.**

When you ask an AI a design question, you get one opinion. `delphi` gives you a structured adversarial process: one agent proposes, another attacks, the proposer must defend with evidence or concede. The result is a decision document with full provenance — not a single-pass answer, but a stress-tested recommendation you can actually trust.

```
/delphi "Should we use event sourcing or CRUD for the order pipeline?"
```

That's it. Two agents argue. Challenges must be addressed with citations or concessions. You get a ratified decision with a provenance table showing exactly which claims survived scrutiny and which didn't.

---

## Concept

Delphi is a lightweight implementation of the [Democracy of AI](https://stolenfire.dev/posts/democracy-of-ai-deliberative-consensus) — a deliberative consensus framework that applies parliamentary institutional design to AI decision-making. Where single-model generation produces decisions filtered through one analytical framework, structured adversarial deliberation forces assumptions into the open, challenges comfortable consensus, and produces decisions with full provenance.

The pattern has roots in the [Delphi method (RAND, 1950s)](docs/delphi-lineage.md) and structured analytic techniques from the intelligence community, but extends them with formal convergence rules, documented dissent, human deferral, and adversarial challenge as a structural requirement rather than an optional practice.

Solo AI conversations have a well-documented failure mode: **evaluator leniency**. When the same model generates and evaluates, it tends to agree with itself. Uncomfortable truths get softened. Edge cases get hand-waved. `delphi` solves this architecturally — the critic's mandate is `challenge_all`, defenses require citations, and the engine categorizes outcomes by structural markers, not argument quality. There is no room for politeness to override rigor.

---

## What it generates

Every deliberation produces a **docket** — a complete, auditable record:

```
.deliberation/dockets/20260324-143022-event-sourcing-vs-crud/
  proposition.md              # The decidable question
  positions/round-1/
    proposer.md               # Initial position with evidence
  challenges/
    round-1.md                # Adversarial challenges
  responses/round-1/
    proposer.md               # Defend / Concede / Dissent for each challenge
  synthesis/
    round-1.md                # Engine categorization: settled vs contested
  decision.md                 # Final decision with provenance table
  docket.json                 # Machine-readable metadata
```

The **decision document** includes:

| Decision | Proposed by | Challenged by | Resolution |
|----------|-------------|---------------|------------|
| Use event sourcing for order state | proposer | critic | DEFEND — cited benchmark data |
| Skip CQRS read model initially | proposer | critic | CONCEDE — added read model to phase 2 |

Every claim traces back to who said it, who challenged it, and how it was resolved. No black boxes.

---

## Reading the output

![Deliberation document flow](docs/deliberation-flow.png)

**The adversarial handoff.** Documents flow between three actors. The proposer writes a position with evidence. The critic attacks it — weakest claim, untested assumption, concrete failure scenario. The proposer must respond to every challenge with exactly one action: defend (with a citation), concede, or record dissent.

**The round loop.** After each exchange, the engine categorizes outcomes by structural markers — not argument quality. A defense without a citation is "contested" regardless of how persuasive it sounds. If contested points remain and rounds are left, the scope narrows and another round begins. Settled points are locked and never revisited.

**Tracing a decision.** Every row in the provenance table in `decision.md` maps back through this chain: who proposed it, who challenged it, and how it was resolved. The docket directory is the permanent record — the conversation output is just the summary.

---

## Installation

### From the marketplace

```bash
claude plugin add stolen-fire/delphi
```

### From a local clone

```bash
git clone https://github.com/stolen-fire/delphi.git
claude --plugin-dir ./delphi
```

No dependencies. No build step. The plugin is pure markdown and YAML — Claude Code's subagent system handles all execution.

---

## Usage

### Quick deliberation

Ask any design question inline:

```
/delphi "Should we use Redis or Postgres for session storage?"
```

This runs **lightweight mode**: a proposer and a critic, up to 2 rounds, with a decision or forced outcome at the end.

Add `--tone` to any invocation for a different voice:

```
/delphi --tone snarky "Should we use Redis or Postgres for session storage?"
```

### Custom composition

Define your own deliberation roster in YAML:

```
/delphi --config compositions/integration-review.yml --input api-spec.md
```

Compositions let you configure delegates, capabilities, round limits, and rules like veto power or human deferral.

### Dry run

Preview the deliberation setup without executing:

```
/delphi --dry-run --config compositions/integration-review.yml
```

### Build a custom composition

Create a tailored deliberation panel through a guided interview:

```
/delphi-compose
```

The command asks about your decision, what's at risk, and any context files — then proposes a panel of delegates, generates the composition YAML, and optionally runs the deliberation immediately.

### Execute a remediation plan

After a code review, automatically implement all fixes and verify with a re-review:

```
/delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx
```

See [Remediation](#remediation) below for the full workflow.

---

## Four modes

### Lightweight

Two delegates — proposer and critic — in a sequential adversarial exchange. The engine handles framing and synthesis directly. Fast, focused, good for most design decisions.

- 2 delegates (proposer + critic)
- Up to 2 rounds
- Engine writes the decision directly

### Standard

Multiple delegates with independent positions, a Chair agent for procedural facilitation, veto mechanics, and human deferral for genuinely undecidable questions.

- 3-5 delegates dispatched in parallel (anti-anchoring by design)
- Chair agent frames propositions and writes ratified decisions
- Veto power for domain invariant violations
- Human deferral when consensus is unreachable — produces a structured options package, not a cop-out

### Code review

Adversarial code review with five distinct perspectives. A **Cartographer** identifies hand-rolled code that duplicates library components, an **Advocate** defends the implementation choices, a **Critic** attacks every position, a **Maintainer** reads the code as someone inheriting it in 6 months, and an **Enforcer** audits against a conventions document when no linter is available.

```
/delphi-review src/components/*.tsx
/delphi-review --diff HEAD~3
/delphi-review --conventions RULES.md src/*.tsx
/delphi-review --config review.yml src/*.tsx
/delphi-review --tone snarky src/Foo.tsx
```

**Delegates and dispatch order:**

1. **Lint pre-phase** — auto-detects linters (ESLint, Stylelint, Roslyn) from file extensions and config files, runs them, and feeds structured findings to all downstream delegates
2. **Cartographer** — scans for component replacements, variant corrections, and sub-component opportunities; uses lint violation clusters as signals for likely reimplementations; sources knowledge from MCP servers, grounding files, or training data
3. **Advocate** — defends the code like an engineering design doc, receiving Cartographer challenges directly
4. **Critic** — attacks weakest claims, untested assumptions, and constructs concrete failure scenarios
5. **Maintainer** — evaluates naming clarity, abstraction quality, modification safety, and missing context
6. **Enforcer** *(conditional)* — convention compliance auditor, activated only when no linter config is detected and `--conventions` is provided; produces a systematic pass/fail report with a coverage mandate spanning every file section

**Anti-anchoring mechanisms:**

- Cartographer runs *before* the Advocate exists — cannot be influenced by any position
- Critic and Maintainer receive only the raw code in their dispatch prompt, not the Advocate's position — they must form independent assessments first, then read the Advocate's position via file to challenge it
- Neither challenger reads the other's challenges — convergent findings across independent assessments are treated as strong signals
- Enforcer reads only code and conventions in complete isolation

**After all delegates complete:**

- The Advocate must respond to every challenge from Cartographer, Critic, and Maintainer with exactly one tag: `[ACTION: DEFEND]`, `[ACTION: CONCEDE]`, or `[ACTION: DISSENT]`
- The engine verifies citation coverage across all files — contiguous gaps of 10+ uncited lines are flagged; self-referential citations are classified separately
- Synthesis categorizes every challenge-response pair via structural markers (not subjective judgment): defense with citation = settled, defense without citation = contested, conceded = conceded
- Produces a prioritized **remediation plan** (Critical / Recommended / Optional) with file-line-action triples traced from `[CITE:]` markers

**Additional options:**

- `--diff [ref]` reviews git diffs (staged changes by default, or against a specific ref)
- `--conventions <path>` loads a style guide for Enforcer compliance auditing
- `--config <path.yml>` overrides the default delegate roster with a custom composition
- `--tone <name>` applies a voice (snarky, diplomatic, adversarial, socratic, parliamentary, or custom)

### Forensic verification

Adversarial fact-checking for forensic audit findings. When an investigation produces a report claiming specific values exist in specific files, three independent verifiers read those files and confirm or dispute every factual claim.

```
/delphi-audit docs/investigations/2026-04-01-WholeLifeAudit-Findings.yaml
```

- Three verifiers dispatched in parallel, each with a different strategy:
  - **Forward** — reads cited files and checks values match
  - **Reverse** — starts from `falsifiable_by` instructions and tries to disprove claims
  - **Cross** — checks values across *all* evidence files, not just the ones the audit cited
- Consensus synthesis: 3/3 agree = confirmed, any disagreement = discrepancy escalated to user
- Dual output: verification report in the docket + summary footer appended to the findings doc
- Discrepancy resolution feedback log that accumulates across audits — prior patterns are surfaced as suggestions when similar discrepancies appear

Designed for zero-tolerance domains where factual accuracy is non-negotiable.

### Remediation

Closed-loop fix-and-verify workflow for code review findings. `/delphi-remediate` reads a code review docket's remediation plan, implements every fix, then runs a full `/delphi-review` on the modified files. If the re-review surfaces new findings, it loops — fix and re-review until clean or the iteration limit is reached.

```
/delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx
/delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --skip-optional
/delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --max-iterations 5
/delphi-remediate .deliberation/dockets/20260401-221710-review-dashboard-tsx --dry-run
```

**How it works:**

1. **Parse** — reads `docket.json` and `remediation/plan.md` from the docket directory, extracts every item with its priority tier (critical / recommended / optional), target file, and fix action
2. **Fix** — walks items in priority order (critical first), reads each file's current state, implements the fix via targeted edits. Items already resolved by prior fixes are skipped automatically
3. **Re-review** — runs a full adversarial code review on the same files with the same parameters (composition, conventions, tone). A new docket is created for the re-review
4. **Evaluate** — if the re-review is clean, done. If findings remain and iterations are left, loops back to step 1 with the new remediation plan

**Options:**

- `--max-iterations N` — safety valve for the fix-review loop (default: 3)
- `--skip-optional` — fix only critical and recommended items, skip the optional tier
- `--dry-run` — parse and display the plan without modifying any files

**Design choices:**

- Each re-review is a full adversarial review from scratch — no shortcuts, no partial checks
- Each iteration creates a new docket. The chain of dockets is the audit trail
- The command does not commit — you review the changes and commit when satisfied
- Line numbers from the original review are never trusted after edits; fixes locate code by content matching

---

## The protocol

Every deliberation follows a six-phase protocol:

**Phase 0 — Initialization.** Create a docket directory. Frame the user's question as a decidable proposition.

**Phase 1 — Position.** The proposer writes a position statement: direct assertion, evidence with `[CITE:]` markers, risks, anticipated counterarguments.

**Phase 2 — Challenge.** The critic attacks: weakest claim, untested assumption, concrete failure scenario. No diplomatic softening.

**Phase 3 — Response.** The proposer must address every challenge with exactly one action:
- `[ACTION: DEFEND]` — refute with evidence (citation required)
- `[ACTION: CONCEDE]` — accept and update position
- `[ACTION: DISSENT]` — accept but record concern for the record

**Phase 4 — Synthesis.** The engine categorizes each exchange by structural markers — not argument quality. A defense without a citation is classified as *contested*, regardless of how persuasive it sounds.

**Phase 5 — Decision.** If all points are settled: ratified. If contested points remain: another round (up to the limit) or terminal outcome.

**Phase 6 — Docket finalization.** Write `decision.md`, `docket.json`, and any dissent records.

---

## Compositions

Compositions are YAML files that define the deliberation roster and rules. Two are included:

### `quick-review.yml` (lightweight)

```yaml
delegates:
  - role: proposer
  - role: critic
    capabilities: [challenge_all]

rules:
  max_rounds: 2
  require_dissent_record: true
```

### `integration-review.yml` (standard)

A four-delegate composition with a domain architect who can veto invariant violations, a frontend advocate, and an integration realist whose job is to manufacture failure scenarios:

```yaml
delegates:
  - role: chair
    capabilities: [frame_propositions]
  - role: domain_architect
    capabilities: [veto_invariant_violations]
  - role: frontend_advocate
  - role: integration_realist
    capabilities: [challenge_all]

rules:
  max_rounds: 3
  independent_positions: true    # Anti-anchoring: delegates can't see each other
  human_deferral: true           # Deadlocks produce a structured options package
  veto_roles: [domain_architect]
```

### `forensic-verification-example.yml` (forensic verification)

Three verifiers with different strategies — Forward (check cited files), Reverse (try to disprove), Cross (check all files):

```yaml
delegates:
  - role: verifier-forward
    role_type: auditor
    prompt: >
      Verification strategy: FORWARD. Read each cited file,
      find the employee row, report the actual values.

  - role: verifier-reverse
    role_type: auditor
    prompt: >
      Verification strategy: REVERSE. Start from the falsifiable_by
      instruction. Actively try to disprove each claim.

  - role: verifier-cross
    role_type: auditor
    prompt: >
      Verification strategy: CROSS. Check values across ALL files
      in the evidence index, not just the cited ones.

rules:
  max_rounds: 1
  independent_positions: true
```

Write your own compositions for your domain. Define the roles, assign capabilities, set the rules.

---

## Tones

Tones control how delegates *say* things without changing *what* they argue. Add `tone:` to any composition to change the deliberation voice:

```yaml
name: my-review
mode: standard
tone: parliamentary

delegates:
  # ...
```

### Built-in tones

| Tone | Voice |
| ------ | ------- |
| `snarky` | Chesterton meets on-call engineer. Sharp truths grounded in consequences — "This is who gets paged at 3 AM." |
| `diplomatic` | Steel-man before you critique. Measured precision, professional warmth, no hedging. |
| `adversarial` | Courtroom cross-examination. No pleasantries. Every claim is guilty until proven innocent. |
| `socratic` | Questions that corner you into your own answer. Never states what it can ask. |
| `parliamentary` | Monty Python's Holy Grail as British Parliament. The honourable members deliberate with coconut-based migration analogies and increasing procedural desperation. |

`/delphi-compose` offers tone selection during the guided interview. Or set it directly in YAML.

### Custom tones

Drop a markdown file in your project at `.claude/delphi/tones/{name}.md`:

```markdown
---
name: pirate
description: Arr, every design decision be a voyage into uncharted waters
---

## Voice directive

{Instructions for how delegates should write}

## Examples

### Before (neutral)
> {Neutral deliberation output}

### After (pirate)
> {Same content in pirate voice}
```

Your custom tone appears automatically in `/delphi-compose` and is available via `tone: pirate` in any composition.

---

## Evidence & verification

For deliberations involving source documents, Delphi provides an evidence pipeline and verification capabilities.

### Evidence submission

```bash
/delphi --config comp.yml --evidence ./documents/
```

Source files (PDFs, DOCX, text) are converted to searchable text with per-file provenance tracking. An evidence index records conversion method (born-digital vs. OCR), confidence level, and SHA-256 hashes for reproducibility.

### Capabilities

| Capability | Role | Timing | Purpose |
|---|---|---|---|
| `frame_propositions` | Chair | Proposition + decision | Precise framing, synthesis quality |
| `challenge_all` | Adversarial | Challenge phase | Mandatory challenges |
| `veto_invariant_violations` | Domain expert | Response phase | Correctness constraints |
| `research_authority` | Specialist | Pre-deliberation + recovery | Case law appendix with verified absences |
| `verify_sources` | Auditor | Challenge/response phases | Factual verification with coverage map |

### Verification coverage

The engine tracks which factual claims were independently verified and which were not. The decision document includes a coverage summary showing verification depth — epistemic honesty about what was checked vs. what delegates asserted without independent verification.

---

## When to use it

Architecture decisions are the obvious use case, but deliberation applies anywhere you'd want a second opinion before committing: **debugging** (force adversarial hypothesis testing instead of confirmation bias), **code review** (catch what linters miss — wrong abstractions, maintainability traps, design system misuse), **forensic verification** (confirm that every factual claim in an investigation report actually matches the source files), **incident post-mortems**, **migration strategy**, **dependency decisions**, **RFC review**, and more.

See **[docs/use-cases.md](docs/use-cases.md)** for the full range of scenarios with example commands.

---

## Design choices

**Structural markers over subjective judgment.** The engine never evaluates whether an argument is "good." It checks: did the defense include a citation? Was an action tag present? This makes synthesis deterministic and auditable.

**Anti-anchoring in standard mode.** Delegates are dispatched in parallel with isolated context windows. They literally cannot see each other's positions. This prevents the first responder from anchoring the entire deliberation.

**Forced outcomes over infinite loops.** If consensus isn't reached after max rounds, the proposer's position wins (lightweight) or the question is deferred to the human with a structured options package (standard). No deliberation runs forever.

**Docket-as-artifact.** The docket directory is the permanent record. The conversation output is just the summary. You can review, diff, or re-examine any deliberation after the fact.

---

## Background & further reading

- [The Democracy of AI](https://stolenfire.dev/posts/democracy-of-ai-deliberative-consensus) — The conceptual framework behind this plugin. Parliamentary institutional design applied to AI decision-making.
- [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — Anthropic's empirical findings on multi-agent harness design. Their generator/evaluator separation and file-based communication patterns informed this plugin's architecture.

---

## License

MIT
