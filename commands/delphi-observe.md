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

## Generate the observatory HTML

Build a single HTML page (as a fragment — the visualizer wraps it in its themed frame). The page has four zones.

### Color constants

Use these CSS custom properties throughout the HTML. Define them in a `<style>` block at the top of the fragment:

```html
<style>
  :root {
    --color-proposer: #4a90d9;
    --color-critic: #d94a4a;
    --color-chair: #4ad9c0;
    --color-defend: #4a90d9;
    --color-concede: #d9a84a;
    --color-dissent: #d97a4a;
    --color-veto: #d94a4a;
    --color-settled: #4a9;
    --color-contested: #d9a84a;
    --color-pulse-bg: #1a1a2e;
    --color-thread-bg: #12121a;
    --color-aside-bg: #1a1a28;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e0e0e0; line-height: 1.5; }

  .observatory { max-width: 900px; margin: 0 auto; padding: 20px; }

  /* --- Header Bar --- */
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 1.3em; font-weight: 600; margin-bottom: 8px; color: #fff; }
  .header .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
  .badge-mode { background: #2a2a3e; color: #a0a0c0; }
  .badge-outcome-ratified, .badge-outcome-ratified_with_dissent { background: #1a3a2a; color: #4a9; }
  .badge-outcome-forced { background: #3a3a1a; color: #d9a84a; }
  .badge-outcome-deferred, .badge-outcome-vetoed { background: #3a1a1a; color: #d94a4a; }
  .badge-outcome-unknown { background: #2a2a3e; color: #a0a0c0; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4a9; display: inline-block; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .timestamp { font-size: 0.8em; color: #888; }

  /* --- Deliberation Pulse --- */
  .pulse-card { background: var(--color-pulse-bg); border: 1px solid #2a2a3e; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .pulse-card h2 { font-size: 1em; color: #a0a0c0; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .pulse-card h2::before { content: '📡'; }
  .pulse-card .commentary { font-size: 0.95em; color: #c0c0d0; }

  /* --- Issue Threads --- */
  .threads { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
  .thread { background: var(--color-thread-bg); border: 1px solid #2a2a3e; border-radius: 8px; overflow: hidden; }
  .thread-header { padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .thread-header:hover { background: #1a1a24; }
  .thread-title { font-weight: 600; font-size: 0.95em; }
  .thread-badges { display: flex; gap: 6px; align-items: center; }
  .thread-body { padding: 0 16px 16px 16px; display: none; }
  .thread.open .thread-body { display: block; }
  .thread-toggle { color: #666; font-size: 0.8em; transition: transform 0.2s; }
  .thread.open .thread-toggle { transform: rotate(90deg); }

  /* Timeline entries within a thread */
  .entry { border-left: 3px solid #2a2a3e; margin-left: 8px; padding: 10px 16px; margin-bottom: 8px; }
  .entry-position { border-left-color: var(--color-proposer); }
  .entry-challenge { border-left-color: var(--color-critic); background: rgba(217, 74, 74, 0.05); }
  .entry-response { border-left-color: var(--color-defend); }
  .entry-response.concede { border-left-color: var(--color-concede); }
  .entry-response.dissent { border-left-color: var(--color-dissent); }
  .entry-response.veto { border-left-color: var(--color-veto); }
  .entry-label { font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .entry-content { font-size: 0.9em; color: #c0c0d0; }
  .entry-content blockquote { border-left: 2px solid #3a3a4e; padding-left: 10px; margin: 6px 0; color: #a0a0b0; font-style: italic; }
  .action-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 700; text-transform: uppercase; }
  .action-DEFEND { background: rgba(74, 144, 217, 0.2); color: var(--color-defend); }
  .action-CONCEDE { background: rgba(217, 168, 74, 0.2); color: var(--color-concede); }
  .action-DISSENT { background: rgba(217, 122, 74, 0.2); color: var(--color-dissent); }
  .action-VETO { background: rgba(217, 74, 74, 0.2); color: var(--color-veto); }

  /* Per-thread commentary aside */
  .aside { background: var(--color-aside-bg); border-radius: 6px; padding: 10px 14px; margin-top: 8px; font-size: 0.85em; color: #a0a0c0; border-left: 3px solid #3a3a5e; }
  .aside::before { content: '💬 Commentary'; display: block; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #7070a0; margin-bottom: 4px; }

  /* Settled without challenge section */
  .unchallenged { background: var(--color-thread-bg); border: 1px solid #2a2a3e; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .unchallenged h3 { font-size: 0.9em; color: #7070a0; margin-bottom: 8px; }
  .unchallenged li { font-size: 0.85em; color: #a0a0b0; margin-bottom: 4px; }

  /* --- Timeline Breadcrumb --- */
  .breadcrumb { display: flex; justify-content: center; gap: 4px; align-items: center; padding: 12px; background: #12121a; border: 1px solid #2a2a3e; border-radius: 8px; }
  .bc-phase { padding: 4px 10px; border-radius: 12px; font-size: 0.75em; font-weight: 500; cursor: pointer; }
  .bc-phase.done { background: #1a3a2a; color: #4a9; }
  .bc-phase.active { background: #2a2a4e; color: #a0a0ff; animation: pulse 1.5s infinite; }
  .bc-phase.pending { background: #1a1a22; color: #555; }
  .bc-arrow { color: #333; font-size: 0.7em; }
</style>
```

### Zone 1 — Header Bar

Generate the header bar HTML:

```html
<div class="observatory">
  <div class="header">
    <h1>{proposition text — first sentence or full short title}</h1>
    <div class="meta">
      <span class="badge badge-mode">{MODE}</span>
      <span class="badge badge-mode">{delegate count} delegates</span>
      <span class="badge badge-mode">{round count} round(s)</span>
      <span class="badge badge-outcome-{outcome}">{OUTCOME or 'In Progress'}</span>
      {if LIVE_MODE: <span class="live-dot"></span><span class="timestamp">Live</span>}
      {if not LIVE_MODE: <span class="timestamp">{formatted date from docket.json}</span>}
    </div>
  </div>
```

Replace all `{...}` placeholders with actual values from the parsed docket metadata. If a value is not yet available (live mode, early stages), use sensible defaults: outcome = "In Progress", round count = number of round directories found so far.

### Zone 2 — Deliberation Pulse

Generate the commentary card. The commentary content is YOUR analysis — write it inline as you build the HTML.

```html
  <div class="pulse-card">
    <h2>Deliberation Pulse</h2>
    <div class="commentary">
      {YOUR COMMENTARY HERE — see the Commentary section below for voice guidance}
    </div>
  </div>
```

### Zone 3 — Issue Threads

For each thread (sorted by drama as defined in "Build issue threads"):

```html
  <div class="threads">

    <div class="thread open"> <!-- first thread starts open, rest closed -->
      <div class="thread-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="thread-title">{Issue name}</span>
        <span class="thread-badges">
          <span class="badge badge-outcome-{resolution_class}">{Resolution}</span>
          <span style="color: var(--color-proposer); font-size: 0.8em;">{target_delegate}</span>
          <span class="thread-toggle">▶</span>
        </span>
      </div>
      <div class="thread-body">

        <!-- Position excerpt -->
        <div class="entry entry-position">
          <div class="entry-label" style="color: var(--color-proposer);">{role_name} — Position</div>
          <div class="entry-content">
            <blockquote>{Position statement excerpt}</blockquote>
            {Relevant reasoning excerpt that relates to this specific challenge}
          </div>
        </div>

        <!-- Challenge -->
        <div class="entry entry-challenge">
          <div class="entry-label" style="color: var(--color-critic);">{critic_role} — {Challenge type}</div>
          <div class="entry-content">{Challenge text}</div>
        </div>

        <!-- Response (if available) -->
        <div class="entry entry-response {action_lowercase}">
          <div class="entry-label">
            {role_name} — Response <span class="action-badge action-{ACTION}">{ACTION}</span>
          </div>
          <div class="entry-content">{Response text. Include [CITE:] references inline if present.}</div>
        </div>

        <!-- Round 2+ entries follow the same pattern if they exist -->

        <!-- Per-thread commentary (only on notable threads) -->
        <div class="aside">{Thread-specific commentary — only include if this thread has something interesting}</div>

      </div>
    </div>

    <!-- Repeat for each thread -->

  </div>
```

For threads where response or synthesis data is not yet available (live mode), omit those entries and show a subtle "Awaiting response..." placeholder in muted text.

**Unchallenged positions** (if any):

```html
  <div class="unchallenged">
    <h3>Settled Without Challenge</h3>
    <ul>
      <li><strong>{role_name}</strong>: {position statement}</li>
      <!-- repeat -->
    </ul>
  </div>
```

### Zone 4 — Timeline Breadcrumb

Determine which phases have completed based on which files exist:

```html
  <div class="breadcrumb">
    <span class="bc-phase {done|active|pending}">Proposition</span>
    <span class="bc-arrow">→</span>
    <span class="bc-phase {done|active|pending}">Positions ({N})</span>
    <span class="bc-arrow">→</span>
    <span class="bc-phase {done|active|pending}">Challenges</span>
    <span class="bc-arrow">→</span>
    <span class="bc-phase {done|active|pending}">Responses</span>
    <span class="bc-arrow">→</span>
    <span class="bc-phase {done|active|pending}">Synthesis</span>
    <span class="bc-arrow">→</span>
    <span class="bc-phase {done|active|pending}">Decision</span>
  </div>

</div> <!-- end .observatory -->
```

Phase state logic:
- A phase is `done` if its files exist in the docket
- A phase is `active` if it is the first phase whose files do NOT yet exist (live mode only; in post-hoc mode, all existing phases are `done` and missing phases are `pending`)
- A phase is `pending` if it comes after the active phase

### Collapsible thread JavaScript

Add a small script at the end of the HTML fragment for thread toggle behavior:

```html
<script>
  // First thread starts open; clicking any header toggles its thread
  document.querySelectorAll('.thread-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
</script>
```

## Generate commentary

You are the commentator. As you build the HTML, you generate commentary that helps the user understand the deliberation. You have three voices — mix them based on what's interesting.

### Voice 1 — Play-by-play

Narrate the most interesting exchange. Be specific — name the delegates, quote key phrases, highlight surprising moves.

Examples:
- "The critic targeted the architect's claim that eventual consistency is acceptable — but the architect defended with a direct citation to the CAP theorem discussion in the grounding document."
- "A surprising concession: the security reviewer agreed that the auth middleware is over-engineered, abandoning their original position entirely."

### Voice 2 — Strategic

Read the overall trajectory. What does the current state of markers suggest about where this deliberation is heading?

Examples:
- "Two of three contested points lack citations. If the architect can't ground these in round 2, this deliberation is heading toward deferral."
- "Clean sweep — every challenge was defended with citations. This is heading toward a confident ratification."
- "The veto on data model changes means the original architecture proposal is effectively dead. The remaining threads are negotiating the fallback."

### Voice 3 — Educational

When the deliberation method itself is illuminating, explain it. Don't force this — only use it when there's something genuinely interesting to point out.

Examples:
- "This is where anti-anchoring pays off — notice how the frontend advocate and the domain architect arrived at the same conclusion about API boundaries independently, without seeing each other's positions."
- "The 'failure scenario' challenge type is doing heavy lifting here — it forced the proposer to address a concrete production scenario rather than arguing in the abstract."
- "A dissent record means the delegate accepted the majority position but went on record with their concern. This is by design — it preserves the minority viewpoint for future reference."

### Placement rules

**Deliberation Pulse** (Zone 2 card):
- 2-3 sentences combining strategic + educational voices
- In live mode: adapt to the current phase:
  - Positions only: anticipatory — what are the key tensions between positions?
  - After challenges: analytical — which challenges seem strongest?
  - After responses: predictive — based on action markers, what's the likely outcome?
  - After synthesis: summative — what was the verdict and why?
  - After decision: reflective — what was most surprising or noteworthy?
- In post-hoc mode: write with full hindsight. Reference the outcome. Highlight the most consequential exchange.

**Per-thread asides** (inside thread bodies):
- 1-2 sentences of play-by-play, only on notable threads
- A thread is "notable" if any of these are true:
  - It contains a VETO
  - It contains a CONCEDE (someone changed their mind)
  - It contains a DEFEND without a CITE (unsupported defense — drama)
  - It contains a DISSENT
  - The challenge type is "Failure scenario" and the response is particularly strong or weak
- Threads that are straightforward DEFEND + CITE settlements do NOT get commentary — they resolved cleanly and don't need narration
- Never add commentary to every thread. Silence is a signal that things went as expected.

### Tone

Write like a knowledgeable commentator who respects the process. Not sycophantic, not snarky. Direct, specific, occasionally wry. Think sports commentary for intellectuals — you're explaining what happened and why it matters, not cheerleading.

Do NOT use phrases like "fascinating", "impressive", "excellent point". Describe what happened and what it means. Let the reader judge quality.

## Launch and push

### Step 1 — Launch a visualizer session

Call `mcp__plugin_visualizer_visualizer__launch_session` to start a browser session. Store the returned `session_id`.

Tell the user: "Observatory launched — opening browser at {url}"

### Step 2 — First render

Execute the full pipeline:
1. Read the docket (§ Read the docket)
2. Build issue threads (§ Build issue threads)
3. Generate commentary (§ Generate commentary)
4. Assemble the HTML (§ Generate the observatory HTML)
5. Push the HTML via `mcp__plugin_visualizer_visualizer__push_screen` with:
   - `session_id`: the session ID from Step 1
   - `html`: the assembled HTML fragment
   - `title`: "Observatory: {proposition short title}"

### Step 3 — Live mode polling (skip if post-hoc)

If `LIVE_MODE` is true, enter a polling loop:

1. Record the set of files currently in the docket directory (use `Glob` with pattern `{DOCKET_PATH}/**/*.md` and `{DOCKET_PATH}/**/*.json`)
2. Wait approximately 5 seconds (use `Bash` with `sleep 5`)
3. Re-scan the docket directory with the same Glob pattern
4. Compare the file lists. If new files have appeared or the file count has changed:
   a. Re-read the docket
   b. Re-build issue threads
   c. Re-generate commentary (the commentary should EVOLVE — don't repeat yourself)
   d. Re-assemble the HTML
   e. Push the updated HTML via `push_screen`
5. Check for completion: if `{DOCKET_PATH}/decision.md` or `{DOCKET_PATH}/deferral.md` now exists:
   a. Do one final push with full analysis commentary
   b. Tell the user: "Deliberation complete — {outcome}. Observatory showing final state."
   c. Exit the polling loop (do NOT close the session — leave it open for browsing)
6. If no completion, repeat from step 2

**Polling limits:** After 60 polling cycles (approximately 5 minutes) with no new files, tell the user: "No changes detected for 5 minutes. The deliberation may have stalled. You can re-run `/delphi-observe --live` to resume watching." Then exit the loop.

### Step 4 — Post-hoc completion

If `LIVE_MODE` is false:
- After the first render push, tell the user: "Observatory rendered — browse the deliberation in the browser tab."
- Do NOT close the session. Leave it open for the user to browse.
- The command is complete.
