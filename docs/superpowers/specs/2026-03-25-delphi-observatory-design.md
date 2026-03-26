# Delphi Observatory Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Author:** Claude + sdoherty

## Overview

A lightweight observatory that renders Delphi deliberations in a browser via the visualizer MCP, presenting issue-threaded views with AI commentary. Supports both live observation of in-progress deliberations and post-hoc review of completed dockets.

## Command Interface

### `/delphi-observe`

New command at `commands/delphi-observe.md`.

**Usage:**
- **Post-hoc:** `/delphi-observe .deliberation/dockets/20260324-event-sourcing/`
- **Live:** `/delphi-observe --live` (watches `.deliberation/dockets/` for the newest active docket)

**Behavior:**
1. Parse the argument. If a path is given, validate it contains `docket.json` or at minimum `proposition.md`.
2. If `--live`, find or wait for the most recent docket directory under `.deliberation/dockets/`.
3. Launch a visualizer session.
4. Read the docket, build the observatory HTML, push it.
5. In live mode: poll every ~5 seconds for file changes, re-push on updates.
6. Generate commentary at each push via inline Claude analysis (the command itself reasons about the content).
7. On deliberation completion (`decision.md` or `deferral.md` appears) or user interrupt: push final screen, stop polling. Session stays open for browsing.

**Tools required:** `Read`, `Glob`, `mcp__plugin_visualizer_visualizer__launch_session`, `mcp__plugin_visualizer_visualizer__push_screen`, `mcp__plugin_visualizer_visualizer__close_session`

## Issue Threading Model

The core transformation: phase-oriented docket files become issue-oriented threads.

### Extraction Process

1. **Parse `docket.json`** for metadata: mode, delegates, rounds, outcome, provenance table.
2. **Extract issues from challenges.** Each challenge in `challenges/round-N.md` targets a specific claim from a specific delegate (structured under `## Challenges to: {role_name}` headers, with three sub-challenges each). Each sub-challenge becomes an issue thread.
3. **Thread each issue across phases:**
   - **Origin** — which position file and claim spawned it
   - **Challenge** — the critic's specific attack
   - **Response** — the delegate's response with its `[ACTION: DEFEND|CONCEDE|DISSENT|VETO]` marker
   - **Round 2+** — if contested, the follow-up exchanges
   - **Resolution** — final status from synthesis (settled, contested, vetoed)
4. **Unchallenged positions** are grouped into a "Settled Without Challenge" section for completeness.
5. **Provenance table** from `docket.json` serves as cross-check: every provenance row should map to a thread.

## HTML Layout

Single-page observatory with four zones, top to bottom.

### 1. Header Bar

- Proposition text (from `proposition.md`)
- Mode badge (lightweight/standard), delegate count, round count
- Outcome badge (ratified / forced / deferred / vetoed) — color-coded: green/amber/red/red
- Timestamp from `docket.json`
- Live mode: pulsing dot indicator. Post-hoc: static.

### 2. Deliberation Pulse

A distinct commentary card at the top with the commentator's strategic overview.
- Live mode: updates each push with evolving analysis
- Post-hoc: holistic analysis of the full deliberation with hindsight

### 3. Issue Threads (main body)

Each thread is a collapsible card containing:
- **Thread header:** Issue name + resolution badge (settled/contested/vetoed/dissent) + delegates involved
- **Expanded view:** Vertical timeline within the thread:
  - Position excerpt (who said what, with role color)
  - Challenge (critic's attack, red-tinted styling)
  - Response (action marker displayed as prominent badge)
  - Round 2+ entries if they exist
  - Per-thread commentary in subtle aside style

**Sort order (by drama):** Vetoed first, then contested, then dissent, then settled. Most interesting content surfaces to the top.

### 4. Timeline Breadcrumb

Slim horizontal bar at the bottom showing phase progression:
`Proposition -> Positions (N) -> Challenges -> Responses -> Synthesis -> Decision`

- Live mode: completed phases solid, current phase pulses, future phases dimmed
- Clicking a phase scrolls to the first thread with content from that phase

### Color Language

- **Delegate roles:** Blue for proposers, red for critics, cyan for chair (matching agent frontmatter)
- **Action markers:** DEFEND = blue, CONCEDE = amber, DISSENT = orange, VETO = red
- **Resolution badges:** Same palette as action markers

## Live Mode Mechanics

### Polling

- Uses `Glob` to check the docket directory every ~5 seconds for new/changed files
- Maintains state of which files have been read. New files trigger re-read and re-push.

### Progressive Rendering

The observatory renders whatever is available:

| Files present | Display state |
|---|---|
| `proposition.md` only | Header populated, "Waiting for positions..." |
| `positions/round-N/*.md` | Threads appear in "forming" state (position content, no challenges) |
| `challenges/round-N*` | Threads expand with challenge content |
| `responses/round-N/*.md` | Responses fill in with action markers |
| `synthesis/round-N.md` | Resolution badges applied to threads |
| `decision.md` or `deferral.md` | Full deliberation rendered, polling stops |

### Completion

When `decision.md` or `deferral.md` appears, one final push with full analysis. Polling stops. Session stays open for browsing.

### Zero Engine Coupling

The engine writes files at each phase as it already does. The observatory is a pure reader. No engine modifications required.

## Commentary System

The `/delphi-observe` command itself acts as commentator — it reads docket content and reasons about it as part of building each HTML push.

### Three Voices

1. **Play-by-play** — Narrates what happened. Surfaces the most interesting exchange.
2. **Strategic** — Reads the room. Predicts trajectory based on current marker distribution.
3. **Educational** — Points out methodological features when illuminating (anti-anchoring, veto mechanics, etc.).

### Placement

- **Deliberation Pulse** (top card): 2-3 sentences of strategic + educational commentary on overall state
- **Per-thread asides**: 1-2 sentences of play-by-play on notable threads only (surprising concedes, unsupported defends, vetoes). Not every thread gets commentary.

### Mode Differences

- **Live:** Commentary evolves. Early = anticipatory, middle = analytical, final = summative.
- **Post-hoc:** Commentary generated once with full hindsight. More insightful since all information is available.

## Plugin Integration

- New file: `commands/delphi-observe.md` (command definition with YAML frontmatter)
- No new agents, skills, or templates required
- No modifications to existing engine, commands, or agents
- Visualizer MCP is a runtime dependency (already available in the environment)

## Design Principles Applied (Don Norman)

- **Natural mapping:** Issue-threaded layout maps to how humans think about debates — "what were the arguments about X?" not "what happened at timestamp T?"
- **Knowledge in the world:** All context for a point lives together in its thread. No memorization required.
- **Visibility:** Resolution badges, outcome badges, and phase indicators make status scannable at a glance.
- **Constraints:** Collapsible threads prevent information overload. Sort-by-drama surfaces what matters.
- **Feedback:** Live mode's pulsing indicators and progressive rendering show the system is alive and working.
