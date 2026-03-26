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
