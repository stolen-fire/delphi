# Standard Protocol

Use this protocol when mode is standard (3-5 delegates + Chair, YAML composition with `mode: standard`). Parallel dispatch where independent, sequential where dependent. Anti-anchoring enforced.

## Shared references

Read these files as needed during execution:
- **Protocol rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/standard-rules.md` — read at the start for parallel dispatch rules, veto mechanics, human deferral, anti-anchoring, research authority, and source verification protocols
- **Categorization rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md` — read during Phase 5 (synthesis)
- **Docket schema**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md` — read during Phase 6 (docket finalization)
- **Synthesis rules**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/synthesis-rules.md` — read during Phase 5
- **Response instructions**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/response-instructions.md` — reference for Phase 4 response dispatch

---

Read the full protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/standard-rules.md` for detailed rules on parallel dispatch, veto mechanics, human deferral, and context compression.

---

## Standard Phase 0: Parse composition

Read the YAML composition file. Extract:
- **Delegates list:** Each delegate's role, prompt, prompt_register, capabilities, grounding
- **Chair:** The delegate with `frame_propositions` capability (typically first in the list)
- **Adversarial delegates:** All delegates with `challenge_all` capability
- **Research delegates:** All delegates with `research_authority` capability
- **Verification delegates:** All delegates with `verify_sources` capability
- **Participating delegates:** All delegates EXCEPT the Chair (these take positions)
- **Rules:** max_rounds, independent_positions, require_dissent_record, human_deferral, veto_roles

### Delegate resolution

For each delegate role in the composition:
1. Check for project-level agent: `.claude/agents/deliberation-{role}.md` — if found, use it
2. Fall back to plugin built-in: `${CLAUDE_PLUGIN_ROOT}/agents/deliberation-{role}.md`
3. If neither exists: use the YAML `prompt` field directly (no agent file required)

**Prompt precedence when both agent file and YAML exist:**
- YAML `prompt` replaces the agent file body text
- YAML `prompt_register`, `capabilities`, `grounding` override agent frontmatter
- Agent file `tools` restriction always applies

### Validation

- Minimum 2 participating delegates (Chair does not count)
- Maximum 5 participating delegates
- At least one delegate must have `challenge_all` capability
- If `veto_roles` is set, those roles must exist in the delegate list

### Tone loading

Determine the active tone: if a `--tone` flag was provided, use it (CLI overrides YAML). Otherwise, use the composition YAML's `tone` field if present.

If an active tone is set:

1. Read the tone slug (e.g., `snarky`)
2. Attempt to read `.claude/delphi/tones/{tone}.md` — if found, use it
3. Otherwise, attempt to read `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` — if found, use it
4. If neither exists: output a warning (`Warning: tone '{tone}' not found, proceeding without tone`) and set tone content to empty — do not fail the deliberation
5. If found: extract the `## Voice directive` section content and the `## Examples` section content from the file body — these are the tone injection payloads used in all subsequent dispatch phases

If no tone is set (no `--tone` flag and no `tone` field in YAML), skip tone loading entirely. No tone will be injected into dispatch prompts.

---

## Standard Phase 1: Chair proposition framing

Output progress: `Deliberation: {composition name} (standard mode, {N} delegates)`
Output progress: `  Framing proposition (Chair)...`

Dispatch the Chair as a subagent using the `deliberation-chair` agent definition:

```
You are the Chair. Frame the proposition for deliberation.

## Your role
{Chair's prompt from composition YAML}

## Quality register
{Chair's prompt_register from composition YAML}

[TONE BLOCK]

## Your task
Restate the following question as a decidable proposition — one that forces
delegates to take a clear position for or against. Identify the specific
tension that makes this decision non-obvious.

## The question
{user's question or "delphi on the provided input artifacts"}

## Input artifacts
{contents of each input artifact file}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the manifest. Use Read to examine any file."}
{if no evidence: omit this section}

## CRITICAL: Write your output to this exact file path
Write the framed proposition to: {docket-path}/proposition.md
```

Output progress: `  Framing proposition... done`

---

## Standard Phase 1A: Pre-deliberation research (if research_authority delegates exist)

If no delegates have `research_authority` capability, skip this phase entirely.

Output progress: `  Pre-deliberation research ({count} delegate)...`

For each delegate with `research_authority` capability, dispatch a subagent:

```
You are the {role_name} conducting pre-deliberation legal/domain research.

## Your role
{delegate's prompt from YAML or agent file}

## Quality register
{delegate's prompt_register}

[TONE BLOCK]

## Your task
Research the legal and domain landscape relevant to this deliberation BEFORE
positions are filed. Your output becomes a shared reference — all delegates
will cite from it.

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file}

## Evidence directory
{if evidence was processed: evidence directory path and INDEX.md reference}
{if no evidence: omit this section}

## Research instructions

You have access to Scout tools (browse, scout_page_tool) for web research.

1. Identify the key legal questions, statutory provisions, and doctrinal
   frameworks relevant to the proposition
2. For each, search for authoritative sources:
   - Case law (Google Scholar Case Law, state court records)
   - Statutes and regulations
   - Secondary authority (law review articles, treatises)
3. Record EVERY search — including searches that return NO results
4. Verified absences are findings: "no appellate authority on X" means
   the question is unsettled. Record these with the same rigor as
   verified cases.

## Output format
Follow this template exactly:
{contents of case law appendix template from ${CLAUDE_PLUGIN_ROOT}/templates/case-law-appendix.md}

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/appendix/case-law.md
```

Create the appendix directory first: `mkdir -p {docket-path}/appendix/`

Dispatch using an agent with tools: Read, Write, and Scout tools (browse, scout_page_tool, find_elements, execute_action_tool, close_session, launch_session). If the delegate has a corresponding agent file, use it but ADD Scout tools to its tool list for this dispatch.

Wait for completion. Verify `{docket-path}/appendix/case-law.md` exists.

Output progress: `  Pre-deliberation research... done`

### Make appendix available to all delegates

The case law appendix is now a shared artifact. In ALL subsequent dispatch phases (position, challenge, response), include after the `## Evidence directory` section:

```
## Case law appendix
{if appendix exists: contents of {docket-path}/appendix/case-law.md}
{if no appendix: omit this section entirely}
```

---

## Standard Phase 2: Parallel position dispatch

Output progress: `  Round {N} — Collecting positions ({count} delegates, parallel)...`

### Anti-anchoring enforcement

Each delegate receives ONLY:
- Their role description and quality register
- The proposition (from Chair)
- Input artifacts (from user)
- Their grounding material (if specified in YAML)

Each delegate does NOT receive:
- Any other delegate's position
- The composition's other delegate definitions

### Assemble dispatch packages

For EACH participating delegate (not the Chair, not challenge-only delegates):

```
You are the {role_name} in this deliberation.

## Your role
{delegate's prompt from composition YAML or agent file}

## Your capabilities
{delegate's capabilities list, or "none (standard delegate)"}

## Quality register
{delegate's prompt_register — this is how your output should read}

[TONE BLOCK]

## Grounding material
{contents of grounding file if specified, otherwise "none provided"}

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
Follow this template exactly:
{contents of position template from ${CLAUDE_PLUGIN_ROOT}/templates/position.md}

Write "# Position: {role_name}" as your heading.

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/positions/round-{N}/{role_name}.md

Do not write to any other path. Do not output anything else.
```

### Dispatch ALL positions in a single response

Dispatch ALL participating delegate subagents simultaneously in one response. Each runs in an isolated context window — they cannot see each other. This is how anti-anchoring is architecturally enforced.

Output progress: `  Round {N} — Collecting positions... done`

---

## Standard Phase 3: Adversarial challenge dispatch

Output progress: `  Round {N} — Adversarial challenge ({count} delegate)...`

Collect ALL position files from `{docket-path}/positions/round-{N}/`.

For each delegate with `challenge_all` capability, assemble:

```
You are the {role_name} with challenge_all capability. You MUST challenge
every position.

## Your role
{delegate's prompt from YAML or agent file}

## Quality register
{delegate's prompt_register}

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## All positions to challenge

{For EACH position file, include:}
### {role_name}'s position:
{contents of positions/round-{N}/{role_name}.md}

---

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
You MUST structure your output with explicit per-delegate headers.
Use this exact format for EACH delegate you challenge:

## Challenges to: {exact_role_name}

### Weakest claim
[Attack the claim with the least support]

### Untested assumption
[Name something taken as given without evidence]

### Failure scenario
[A concrete scenario where the approach fails]

Repeat for EACH delegate position.

Then add:

## Shared blind spots
[Where do delegates agree without testing that agreement?]

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/challenges/round-{N}.md
```

- If ONE adversarial delegate: dispatch sequentially (single subagent)
- If MULTIPLE adversarial delegates: dispatch in parallel, each writes to `challenges/round-{N}-{role}.md`

**Tool access for verify_sources delegates:** When dispatching a delegate with `verify_sources` capability, add Scout tools (browse, scout_page_tool, launch_session, find_elements, execute_action_tool, close_session) and Read to their agent tool list. Also add to their dispatch prompt:

```
## Verification capability
You have verify_sources capability. You can use Scout tools to verify
factual claims against external sources, and Read to verify claims against
the evidence directory at {docket-path}/evidence/.

When you verify a claim, record each verification in this format:
- **Claim:** {what you checked}
- **Source:** {where you checked}
- **Result:** confirmed | refuted | inconclusive
- **Provenance:** {specific page, section, or URL}

Write your verification entries to: {docket-path}/verification-log.md
(append to the file if it already exists)
```

Output progress: `  Round {N} — Adversarial challenge... done`

---

## Standard Phase 4: Parallel response dispatch

Output progress: `  Round {N} — Collecting responses ({count} delegates, parallel)...`

### Route challenges to each delegate

Read the challenge document(s). Build a consolidated challenge map — a list of (challenged_delegate, challenge_text, challenger_role) tuples:

**For EACH challenge document** (one per adversarial delegate):

1. Identify the author — the adversarial delegate who wrote this document
2. For EACH participating delegate **other than this document's author**:
   a. Look for a `## Challenges to: {role_name}` header in this document
   b. If found: extract everything from that header until the next `## Challenges to:` header, `## Shared blind spots`, or end of file — add it to the challenge map as (role_name, extracted_text, author_role)
   c. If not found: this delegate was not challenged by this author — skip

**Important:** A delegate with `challenge_all` capability IS a valid challenge target for OTHER adversarial delegates. The exclusion applies only to the author of each specific document — a delegate never responds to their own challenges.

3. Merge the challenge map: if multiple adversarial delegates challenged the same delegate, concatenate their challenge sections under labeled sub-headers:

```
## Challenges directed at you

### From {challenger_1_role}:
{challenge_text_1}

### From {challenger_2_role}:
{challenge_text_2}
```

### Route shared blind spots as formal challenges

After building the per-delegate challenge map, extract the `## Shared blind spots` section from each challenge document.

1. If only ONE adversarial delegate exists: the shared blind spots are noted in synthesis but not routed (single perspective, not a convergent finding)

2. If MULTIPLE adversarial delegates exist: compare their shared blind spots sections. For each blind spot that appears in 2+ challenge documents (same concept, even if worded differently):
   - Promote it to a formal challenge directed at ALL non-adversarial delegates
   - Add to each non-adversarial delegate's challenge map as:

```
### Convergent blind spot (identified by {challenger_1}, {challenger_2})
{blind spot description from the challenger who articulated it most precisely}

This gap was independently identified by multiple adversarial delegates, indicating untested consensus. You MUST address it with an [ACTION:] tag.
```

3. These promoted blind spots enter synthesis like any other challenge — DEFEND+CITE, CONCEDE, or no response (contested)

### Assemble response dispatch packages

For each challenged delegate:

```
You are the {role_name}. You are responding to adversarial challenges.

## Your role
{delegate's prompt}

## Quality register
{delegate's prompt_register}

[TONE BLOCK]

## Your original position
{contents of positions/round-{N}/{role_name}.md}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Challenges directed at you
{extracted challenges section for this delegate}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag.

Available actions:
- [ACTION: DEFEND] — Refute with evidence. MUST include [CITE: filename, section].
- [ACTION: CONCEDE] — Accept the challenge. State what changed in your position.
- [ACTION: DISSENT] — Accept majority position but record your concern.
{if delegate is in veto_roles:}
- [ACTION: VETO] — Cite a specific domain invariant violation from your grounding
  material. MUST include [CITE: grounding-file, invariant]. A veto is a correctness
  constraint, not a preference.

**Research recovery (research_authority delegates only):**
If you have `research_authority` capability AND you are CONCEDING a challenge
that attacked one of your cited cases: you may perform ONE scoped research
call using Scout tools to find replacement authority before finalizing your
response. If you find a replacement, cite it with [CITE:] and use
[ACTION: DEFEND]. If you confirm the absence of replacement authority,
record the verified absence and use [ACTION: CONCEDE].

Any research performed during the response phase MUST be appended to the
case law appendix as an Addendum entry with a "Round {N} Response Phase"
timestamp.

Do NOT ignore any challenge. Every challenge gets exactly one action tag.

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/responses/round-{N}/{role_name}.md
```

### Dispatch ALL responses in a single response

Dispatch all challenged delegates simultaneously. For delegates with `research_authority`, add Scout tools to their dispatch (same tool list as Phase 1A: browse, scout_page_tool, find_elements, execute_action_tool, close_session, launch_session).

**Tool access for verify_sources delegates:** When dispatching a delegate with `verify_sources` capability, add Scout tools (browse, scout_page_tool, launch_session, find_elements, execute_action_tool, close_session) and Read to their agent tool list. Also add to their dispatch prompt:

```
## Verification capability
You have verify_sources capability. You can use Scout tools to verify
factual claims against external sources, and Read to verify claims against
the evidence directory at {docket-path}/evidence/.

When you verify a claim, record each verification in this format:
- **Claim:** {what you checked}
- **Source:** {where you checked}
- **Result:** confirmed | refuted | inconclusive
- **Provenance:** {specific page, section, or URL}

Write your verification entries to: {docket-path}/verification-log.md
(append to the file if it already exists)
```

Output progress: `  Round {N} — Collecting responses... done`

### Verify response completeness

Before proceeding to synthesis, verify that every delegate in the challenge map produced a response file:

1. For each delegate that appears as a challenge target in the challenge map (from "Route challenges to each delegate" above):
   - Check that `{docket-path}/responses/round-{N}/{role_name}.md` exists
   - If missing: this delegate was challenged but did not respond

2. If ANY response files are missing:
   - Output warning: `  ⚠ Missing responses: {list of role names}`
   - For synthesis purposes, treat every challenge directed at a non-responding delegate as **Contested (unaddressed)** — the "No `[ACTION:]` tag" row in the categorization table applies
   - Do NOT halt the deliberation — proceed to synthesis with the contested markers

This check catches the exact failure mode where a delegate is incorrectly excluded from response routing — the downstream effect is contested points that force a Round 2, rather than silent premature settlement.

---

## Standard Phase 5: Synthesis (engine logic — NOT a subagent)

Output progress: `  Round {N} — Synthesis...`

This phase is performed by YOU (the engine). Same categorization rules as lightweight mode.

### Read all response files

Read every file in `{docket-path}/responses/round-{N}/`.

### Categorize each challenge-response pair

Apply the challenge-response categorization rules at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/categorization-rules.md` to each delegate's response.

### Write synthesis

Write to `{docket-path}/synthesis/round-{N}.md` using the synthesis template.

### Verification coverage map

If a verification log exists at `{docket-path}/verification-log.md`:

1. Read the verification log
2. Read the latest synthesis or decision document
3. Identify all factual claims — statements that assert something about evidence, documents, dates, amounts, or events (NOT legal arguments or analytical conclusions)
4. Cross-reference each factual claim against the verification log
5. Append a coverage summary to the verification log using the template format:
   - Count of factual claims
   - Count verified (confirmed + refuted + inconclusive)
   - Count not checked
   - List each unchecked claim with its source reference

6. Also append a brief verification coverage line to the synthesis output:

```
## Verification coverage
Factual claims: {N} | Verified: {M} ({confirmed} confirmed, {refuted} refuted, {inconclusive} inconclusive) | Not checked: {N-M}
```

### Determine round outcome

- ALL settled (including with dissent): **ratified** → proceed to Standard Phase 6
- ANY contested AND rounds < max_rounds: **proceed to next round** (Standard Phase 7)
- ANY contested AND rounds >= max_rounds:
  - `human_deferral: true`: **deferred**
  - `human_deferral: false`: **forced**
- ANY vetoed: **vetoed**

Output progress: `  Round {N} — Synthesis: {settled} settled, {contested} contested → {outcome}`

---

## Standard Phase 6: Decision (Chair subagent + engine finalization)

### Chair writes decision.md

Output progress: `  Writing decision (Chair)...`

Dispatch the Chair subagent to write the ratified decision:

```
You are the Chair. Write the ratified decision document.

## Your role
{Chair's prompt}

## Quality register
{Chair's prompt_register}

[TONE BLOCK]

## Your task
Read all deliberation materials and write decision.md — the authoritative
artifact the user will act on.

## Deliberation materials

### Proposition
{contents of proposition.md}

### Synthesis (all rounds)
{contents of each synthesis/round-{N}.md}

### Final positions
{contents of each delegate's latest position file}

### Challenges
{contents of challenge files}

### Responses
{contents of each delegate's response files}

### Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the manifest. Use Read to examine any file."}
{if no evidence: omit this section}

### Case law appendix
{if appendix exists: contents of {docket-path}/appendix/case-law.md}
{if no appendix: omit this section}

### Verification log
{if verification log exists: contents of {docket-path}/verification-log.md}
{if no verification log: omit this section}

## Outcome: {ratified | ratified with dissent | forced | deferred | vetoed}

## Instructions
- Write the decision as a coherent specification, not a summary
- Include a provenance table: for each key decision, who proposed, who challenged, how resolved
- If dissent was registered, include the dissent record
- If deferred, include the competing positions and the specific question for the human
- Cross-reference delegate claims against the evidence directory and case
  law appendix. If a delegate claims X but the evidence shows Y, note the
  discrepancy.
- If challenges raised issue X and the response addressed issue Y (adjacent
  but different topics), flag this as potentially miscategorized in synthesis
- Include the verification coverage summary in the decision if a verification
  log exists

## CRITICAL: Write your output to this exact file path
Write to: {docket-path}/decision.md
```

Output progress: `  Writing decision... done`

### Engine writes docket.json

Write `{docket-path}/docket.json` using the docket.json schema at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md`. For standard mode, populate delegates and rules from the composition YAML, set `independent_positions: true`, and include `parallel_dispatches` in each round entry with phase-level dispatch metadata.

### Write dissent.md (if applicable)

If any delegate used `[ACTION: DISSENT]`, write `{docket-path}/dissent.md`.

### Write deferral.md (if applicable)

If outcome is deferred, read `${CLAUDE_PLUGIN_ROOT}/templates/deferral.md` and assemble the deferral package with settled points, contested points with both sides, and concrete options for the human.

If outcome is vetoed, write a deferral-like package identifying the invariant violation and required revision.

### Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Present `decision.md` contents to the user. If deferred or vetoed, present `deferral.md` and ask the user for their decision.

---

## Standard Phase 7: Round 2+ (narrowed scope)

If synthesis determined "proceed to next round":

### Create round directories

```
mkdir -p {docket-path}/positions/round-{N}/
mkdir -p {docket-path}/responses/round-{N}/
```

### Compile compressed context

For each delegate's next-round dispatch:
- **Settled points:** List by name only — "The following are settled and not under deliberation: {list}"
- **Contested points:** For each — brief summary of the challenge and why the defense was insufficient
- **This delegate's prior positions:** Include for consistency across rounds
- **Grounding material:** Unchanged

### Dispatch narrowed round

Repeat Standard Phases 2-5 with compressed context:
- Position dispatch packages include compressed context instead of full proposition
- Delegates address ONLY contested points — do not revisit settled points
- Adversarial delegate re-challenges only the new positions
- Synthesis categorizes the new responses

Update `docket.json` rounds array with round N data.

If still contested after max_rounds, apply terminal behavior per rules (deferred or forced).
