# Delphi Lineage

How the plugin relates to the classical RAND Delphi method (1950s) and where it diverges.

---

## Faithful to Delphi

### Anti-anchoring

Classical Delphi's entire point was preventing the loudest voice from dominating. Panelists never know who said what. The plugin enforces this architecturally — delegates run in isolated context windows during position dispatch. They can't even see each other's output, not just names. This is arguably *stronger* than RAND's anonymity.

### Facilitator neutrality

The Delphi monitor shapes the question and summarizes responses but never evaluates substance. The Chair agent maps directly to this role — procedural authority only. Explicitly prohibited from evaluating arguments, softening positions, or resolving contested points.

### Independent initial responses

Each Delphi panelist forms their opinion before seeing anyone else's. The plugin enforces this with parallel position dispatch in standard mode — all delegates write simultaneously in isolated contexts. Independence is architectural, not requested.

### Iterative narrowing

Delphi rounds focus on unresolved items. Settled points aren't re-debated. The plugin works the same way — settled points are listed by name only in subsequent rounds, contested points get compressed context with what specifically needs addressing.

### Dissent preservation

RAND insisted minority opinions be preserved in the final output, not averaged away. The plugin's `[ACTION: DISSENT]` does this — classified as settled-with-dissent, written to `dissent.md`, included in the decision document. The dissenter explicitly accepts the position but gets their concern on the record.

### Heterogeneous expertise

Delphi panels are selected for diverse domain knowledge. Compositions define delegates with different roles, grounding files, and quality registers — different analytical lenses on the same question.

### Controlled termination

Delphi uses predetermined round limits or convergence thresholds. The plugin uses `max_rounds` with terminal outcomes: ratified, forced, deferred, or vetoed.

---

## Divergences

### Adversarial challenge is mandatory

Classical Delphi doesn't have a dedicated critic. Experts challenge each other implicitly through disagreement. The `challenge_all` capability makes adversarial review structural — someone's job is to attack every position. This is closer to intelligence community structured analytic techniques (red teaming, devil's advocacy) than pure Delphi.

### No statistical aggregation

RAND Delphi uses median and interquartile range to measure convergence. The plugin uses binary structural markers — `DEFEND` with `CITE` is settled, `DEFEND` without `CITE` is contested. Software decisions are ratified or they aren't. "The median opinion on database schema design" doesn't make sense.

### Evidence requirement via citations

Delphi asks experts for rationale but doesn't require citations. The engine treats a defense without a `[CITE:]` marker as contested regardless of how persuasive it sounds. This is stricter than RAND and closer to legal or academic evidentiary standards.

### Veto power

Classical Delphi has no veto. Everyone's input has equal weight. The plugin's veto mechanics for domain invariant violations are borrowed from parliamentary procedure — constitutional constraints that can't be overridden by majority vote. A security-focused delegate can halt a deliberation that violates an invariant.

### Formalized human deferral

Delphi reports the final distribution even if experts still disagree. The plugin produces a structured deferral package: what's settled, what's contested, why a human needs to decide, and concrete options to choose between. More opinionated and more useful than "the panel disagreed."

---

## Summary

The plugin is Delphi with teeth. The core mechanics are faithful — anonymity, independence, iteration, facilitator neutrality, dissent preservation, heterogeneous expertise. The extensions come from intelligence community red-teaming and parliamentary traditions: mandatory adversarial challenge, structural evidence requirements, veto power, and formalized human deferral.

| Principle | RAND Delphi | This plugin |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Anonymity / anti-anchoring        | Panelists anonymous to each other         | Isolated context windows — can't see each other    |
| Independent initial responses     | Requested                                 | Architecturally enforced via parallel dispatch     |
| Facilitator neutrality            | Monitor shapes questions, doesn't judge   | Chair agent — procedural authority only            |
| Iterative narrowing               | Rounds re-survey on unresolved items      | Settled points locked, contested points narrowed   |
| Dissent preservation              | Minority reports in final output          | `[ACTION: DISSENT]` — first-class docket artifact  |
| Convergence measurement           | Statistical (median, IQR)                 | Structural (marker-based, binary per point)        |
| Adversarial challenge             | Implicit through disagreement             | Mandatory — `challenge_all` capability             |
| Evidence requirements             | Rationale requested, not required         | `DEFEND` without `CITE` = contested                |
| Veto power                        | None — equal weight                       | Domain invariant violations can halt deliberation  |
| Human deferral                    | Reports final distribution                | Structured options package for the human           |
