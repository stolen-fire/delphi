---
description: Observe a Delphi deliberation in the browser — live or post-hoc
allowed-tools: Read, Glob, Bash, mcp__plugin_visualizer_visualizer__launch_session, mcp__plugin_visualizer_visualizer__push_screen, mcp__plugin_visualizer_visualizer__close_session
argument-hint: '<docket-path> | --live'
---

# /delphi-observe

Render a Delphi deliberation as an interactive, issue-threaded observatory in the browser.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation mode:

**Mode 1 — Post-hoc (docket path provided):**
If `$ARGUMENTS` is a path (does not start with `--`):
- Treat it as the path to a docket directory
- Use `Glob` to verify the path exists and contains at least `proposition.md`
- If `docket.json` exists, this is a complete or in-progress docket — proceed
- If neither `proposition.md` nor `docket.json` exist, tell the user the path is not a valid docket directory and stop

**Mode 2 — Live (watching for active deliberation):**
If `$ARGUMENTS` contains `--live`:
- Use `Glob` to scan `.deliberation/dockets/*/proposition.md`
- Sort results by directory name (timestamp prefix means lexicographic = chronological)
- Pick the most recent docket directory
- If no dockets exist, tell the user: "No docket directories found. Start a deliberation with `/delphi` first, then run `/delphi-observe --live`." and stop
- Check if `decision.md` or `deferral.md` exists in that docket — if so, this docket is already complete. Tell the user and suggest post-hoc mode instead.

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:
```
/delphi-observe — Watch a Delphi deliberation unfold

Usage:
  /delphi-observe .deliberation/dockets/20260324-event-sourcing/   Review a completed deliberation
  /delphi-observe --live                                            Watch the latest active deliberation

Output: Opens a browser tab with the issue-threaded observatory view.
```
Then stop.

Set two variables for the rest of the command:
- `DOCKET_PATH` — the resolved absolute path to the docket directory
- `LIVE_MODE` — true if `--live` was used, false otherwise

## Read the docket

Read all available files from `DOCKET_PATH`. The docket may be incomplete (live mode) — read what exists and skip what doesn't.

### Step 1 — Metadata

If `{DOCKET_PATH}/docket.json` exists, read it and extract:
- `mode` (lightweight or standard)
- `delegates` (array of role objects)
- `rounds` (array of round summaries)
- `outcome` (ratified / ratified_with_dissent / forced / deferred / vetoed) — may be absent if incomplete
- `provenance` (array of decision/challenge/resolution records)
- `created` (ISO 8601 timestamp)

If `docket.json` does not exist yet (early live mode), infer what you can:
- Mode: check if `positions/round-1/` contains more than one file → standard; otherwise → lightweight
- Delegates: derive from filenames in `positions/round-1/` (each filename minus `.md` = role name)
- Outcome: unknown (deliberation in progress)

### Step 2 — Proposition

Read `{DOCKET_PATH}/proposition.md`. Extract the full text. This becomes the header content.

### Step 3 — Positions

Use `Glob` to find `{DOCKET_PATH}/positions/round-*/*.md`.
For each file:
- Extract the role name from the filename (e.g., `domain_architect.md` → `domain_architect`)
- Extract the round number from the path (e.g., `round-1` → 1)
- Read the full content — specifically the "Position statement" section (the one-sentence assertion) and the "Reasoning" section

### Step 4 — Challenges

Use `Glob` to find `{DOCKET_PATH}/challenges/round-*.md` and `{DOCKET_PATH}/challenges/round-*/*.md`.
For each challenge file:
- Parse the `## Challenges to: {role_name}` headers to identify which delegate is being challenged
- Under each header, extract three sub-challenges: "Weakest claim", "Untested assumption", "Failure scenario"
- Each sub-challenge becomes the seed of an issue thread

### Step 5 — Responses

Use `Glob` to find `{DOCKET_PATH}/responses/round-*/*.md`.
For each response file:
- Match the role name and round number
- Extract the `[ACTION: DEFEND|CONCEDE|DISSENT|VETO]` markers — there should be one per challenge addressed
- Extract `[CITE: ...]` markers where present
- Map each response section back to its corresponding challenge (by the challenge heading it addresses)

### Step 6 — Synthesis

Use `Glob` to find `{DOCKET_PATH}/synthesis/round-*.md`.
For each synthesis file:
- Parse the three tables: "Settled points", "Contested points", "Vetoed points"
- Each row maps to an issue thread's resolution

### Step 7 — Decision or Deferral

Check for `{DOCKET_PATH}/decision.md` or `{DOCKET_PATH}/deferral.md`.
If present, read the full content. Extract the outcome, provenance table, and any dissent record.

Also check for `{DOCKET_PATH}/dissent.md`. If present, read it for the dissent details.

## Build issue threads

Transform the phase-oriented data into issue-oriented threads.

**For each sub-challenge extracted in Step 4:**

Create a thread object with:
- **Issue name**: A short descriptive name derived from the challenge content (e.g., "Caching consistency under write-heavy loads"). Generate this name yourself — it should be concise and capture the essence of the dispute.
- **Target delegate**: The role being challenged
- **Challenger**: The critic role that issued the challenge
- **Challenge type**: "Weakest claim", "Untested assumption", or "Failure scenario"
- **Origin**: The specific claim from the target delegate's position that spawned this challenge. Quote the relevant excerpt from the position file.
- **Challenge content**: The full text of this sub-challenge
- **Response**: The matching response content with its `[ACTION:]` marker, if responses have been filed. Null if not yet available.
- **Action**: The `[ACTION:]` value (DEFEND, CONCEDE, DISSENT, VETO), or null
- **Has citation**: Whether a `[CITE:]` marker accompanies a DEFEND action
- **Resolution**: From synthesis — settled, contested (unsupported), contested (unaddressed), or vetoed. Null if synthesis not yet available.
- **Round**: Which round this thread belongs to
- **Round 2+ continuation**: If this issue was contested in round N and revisited in round N+1, link the continuation here

**Unchallenged positions:**
Any position content that was NOT targeted by a challenge gets grouped into a separate list called "Settled Without Challenge". These are not full threads — just the delegate role and their position statement.

**Sort threads by drama:**
1. Vetoed (most dramatic)
2. Contested (unresolved tension)
3. Dissent (accepted under protest)
4. Settled with DEFEND + CITE (resolved but interesting)
5. Settled with CONCEDE (cleanly resolved)
6. Settled Without Challenge (least dramatic)
