# Spec: README "Reading the output" section

**Date:** 2026-03-28
**Status:** Draft

## Problem

The README explains *what* files a deliberation generates (directory tree in "What it generates") and *what* the protocol phases are (numbered list in "The protocol"), but nothing bridges the two. A reader can't easily see which file gets produced at which phase, who produces it, or how rounds loop. The docket output lacks a visual reading guide.

## Solution

Add a new "Reading the output" section between "What it generates" and "Installation" in the README. It consists of:

1. A swimlane diagram (PNG image committed to `docs/deliberation-flow.png`)
2. Three annotated callout paragraphs explaining what to notice

### Diagram

A swimlane diagram with three columns (Proposer, Critic, Engine) showing:

- Phase labels on the left (Phase 0 through 5-6)
- Document cards in the column of the actor who produces them
- Directional arrows with labels showing handoff sequence
- A branch point after synthesis showing three outcomes (all settled, contested, max rounds)
- A legend at the bottom

The diagram uses GitHub's dark theme colors. It is a static PNG captured from an HTML prototype at `.superpowers/brainstorm/128830-1774746834/content/swimlane-v1.html`. The PNG is already saved at `docs/deliberation-flow.png`.

**Design rationale (Don Norman):**
- **Visibility:** Three actors are structural columns — you can't miss that deliberation is multi-party
- **Natural mapping:** Spatial layout maps to conceptual model — proposer left, critic middle, engine right
- **Knowledge in the world:** The swimlane shows who writes each document by position, no memorization needed
- **Feedback:** Handoff arrows with labels ("position sent to critic", "must defend or concede") make the adversarial sequence unmistakable

### Annotated walkthrough

Three short paragraphs (~120 words total), each teaching one concept:

1. **The adversarial handoff** — Documents flow between three actors. Proposer writes position with evidence, critic attacks (weakest claim, untested assumption, failure scenario), proposer must respond with DEFEND/CONCEDE/DISSENT.

2. **The round loop** — Engine categorizes by structural markers, not argument quality. Defense without citation = contested. Contested + rounds remaining = another round with narrowed scope. Settled points locked.

3. **Tracing a decision** — Every row in the provenance table in `decision.md` maps back through this chain. Docket directory is the permanent record; conversation output is just the summary.

### Placement

After the existing "What it generates" section (currently ending at line 53 of README.md), before "Installation" (currently at line 55). The `---` separator between them becomes the natural boundary.

### Exact markdown

```markdown
## Reading the output

![Deliberation document flow](docs/deliberation-flow.png)

**The adversarial handoff.** Documents flow between three actors. The proposer writes a position with evidence. The critic attacks it — weakest claim, untested assumption, concrete failure scenario. The proposer must respond to every challenge with exactly one action: defend (with a citation), concede, or record dissent.

**The round loop.** After each exchange, the engine categorizes outcomes by structural markers — not argument quality. A defense without a citation is "contested" regardless of how persuasive it sounds. If contested points remain and rounds are left, the scope narrows and another round begins. Settled points are locked and never revisited.

**Tracing a decision.** Every row in the provenance table in `decision.md` maps back through this chain: who proposed it, who challenged it, and how it was resolved. The docket directory is the permanent record — the conversation output is just the summary.
```

## Scope

- **In scope:** New README section, diagram image already committed
- **Out of scope:** Changes to existing "What it generates" or "The protocol" sections; diagram for standard mode (multi-delegate swimlane); interactive/animated versions

## Files to modify

| File | Change |
|------|--------|
| `README.md` | Insert new "Reading the output" section after the `---` on line 53 (end of "What it generates"), before the `---` that precedes "Installation" (line 55). The new section includes its own trailing `---`. |
| `docs/deliberation-flow.png` | Already exists — no change needed |
