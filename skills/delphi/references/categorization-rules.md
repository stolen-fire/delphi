# Challenge-response categorization rules

All protocols use this same table for synthesis. Be case-insensitive when checking markers. Accept whitespace variations.

| Markers found | Category |
|--------------|----------|
| `[ACTION: DEFEND]` with `[CITE:]` referencing input artifacts, grounding material, evidence directory, or case law appendix | **Settled** |
| `[ACTION: DEFEND]` with `[CITE:]` referencing ONLY the delegate's own position file or other deliberation documents (proposition, other positions) | **Settled (self-referential citation)** — flag in synthesis |
| `[ACTION: DEFEND]` without any `[CITE:]` marker | **Contested** (unsupported) |
| `[ACTION: CONCEDE]` | **Settled** (position updated) |
| `[ACTION: DISSENT]` | **Settled with dissent** |
| `[ACTION: VETO]` with `[CITE:]` | **Vetoed** |
| No `[ACTION:]` tag | **Contested** (unaddressed) |

**Citation validation:** A citation to the delegate's own position file (e.g., `[CITE: positions/round-1/prosecuting_analyst.md, ...]`) or to the proposition (e.g., `[CITE: proposition.md, ...]`) is self-referential — it adds no independent evidence. These defenses are still classified as Settled (the engine does not override the delegate's judgment), but they are flagged in the synthesis table so the Chair and human readers can assess citation quality.
