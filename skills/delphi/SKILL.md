---
name: delphi
description: >
  Main deliberation engine. Orchestrates structured multi-agent deliberation
  by dispatching delegate subagents, managing docket files, and performing
  synthesis. Use when the /delphi command is invoked or when another skill
  needs adversarial evaluation of an artifact.
---

# Deliberation engine

You are the deliberation engine. You orchestrate structured adversarial deliberation by dispatching delegate subagents, routing files between them, and performing mechanical synthesis. You are NOT a participant — you are the Chair in the procedural sense: you facilitate, you do not advocate.

---

## Phase 0: Initialization

When invoked, you receive either:
- An **inline question** (lightweight mode, no YAML)
- A **composition YAML path** + **input artifact paths** (configured mode)

### Step 0.1: Determine mode

- If you received an inline question with no `--config`: use the **hardcoded lightweight composition** defined in the lightweight-deliberation protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/lightweight-deliberation/SKILL.md`. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading. The loaded tone is injected into all lightweight dispatch prompts. Proceed to **Lightweight Protocol** below.
- If you received a `mode: code-review` signal (invoked from `/delphi-review`): proceed to **Code Review Protocol** below. If a `--tone` flag was provided, load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading.
- If you received a `--config` path: read the YAML file, extract `mode:` field
  - If a `--tone` flag was provided, it overrides any `tone` field in the composition YAML
  - If `mode: lightweight` (or 2 delegates): proceed to **Lightweight Protocol** below
  - If a tone is set (from `--tone` flag or composition YAML), load the tone file using the resolution precedence described in Standard Phase 0 > Tone loading. The loaded tone is injected into all lightweight dispatch prompts.
  - If `mode: code-review`: proceed to **Code Review Protocol** below
  - If `mode: standard` (or 3+ delegates): proceed to **Standard Protocol** below

### Step 0.2: Create docket directory

Generate a docket name using the format `{YYYYMMDD}-{HHmmss}-{name}` where:
- Timestamp: current date and time
- Name: the composition's `name` field (if YAML), or a slugified version of the first 50 characters of the inline question (lowercase, spaces to hyphens, strip special characters)

Create the full directory structure using Bash `mkdir -p`:

```
.deliberation/dockets/{docket-name}/
  positions/round-1/
  challenges/
  responses/round-1/
  synthesis/
```

### Step 0.2b: Evidence preprocessing

If an evidence path was provided (via `--evidence` flag or YAML `evidence:` field — flag overrides YAML):

1. Create the evidence directory: `mkdir -p {docket-path}/evidence/`

2. Determine the evidence source:
   - If the path is a directory: process all files in it recursively
   - If the path is a file list (comma-separated or space-separated): process each file

3. For EACH source file, determine conversion method and convert:

   **PDF files (.pdf):**
   ```bash
   # First attempt: extract embedded text (born-digital)
   pdftotext "{source_file}" "{docket-path}/evidence/{basename}.txt"

   # Check if extraction produced meaningful content
   # If output file is empty or nearly empty (< 100 bytes per page), fall back to OCR:
   tesseract "{source_file}" "{docket-path}/evidence/{basename}" -l eng txt
   ```

   For multi-hundred-page PDFs (like scanned KORA compilations), process page-by-page:
   ```bash
   # Extract page count
   pdfinfo "{source_file}" | grep Pages

   # For each page range, attempt pdftotext first, tesseract as fallback
   # Record per-page conversion method and confidence
   ```

   **Word documents (.docx, .doc):**
   ```bash
   python3 -c "
   from docx import Document
   doc = Document('{source_file}')
   with open('{docket-path}/evidence/{basename}.txt', 'w') as f:
       for para in doc.paragraphs:
           f.write(para.text + '\n')
   "
   ```

   **Text files (.txt, .md, .csv, .json, .yml, .yaml):**
   Copy directly to evidence directory — no conversion needed.

   **Unsupported formats:**
   Log a warning: `  ⚠ Skipping {filename} — unsupported format ({extension})`

4. Compute SHA-256 hash for each source file:
   ```bash
   sha256sum "{source_file}"
   ```

5. Write the evidence index using the template at `${CLAUDE_PLUGIN_ROOT}/templates/evidence-index.md`:
   - Fill in the files table with per-file provenance (method, confidence, notes)
   - Fill in the hash manifest
   - Write to `{docket-path}/evidence/INDEX.md`

6. Record evidence metadata for docket.json (will be written at finalization):
   - `"evidence_source"`: the original path (CLI flag or YAML field)
   - `"evidence_source_type"`: "cli_flag" or "yaml_field"
   - `"evidence_files"`: array of {filename, sha256, method, confidence}

Output progress: `  Evidence: {N} files processed ({born-digital} born-digital, {ocr} OCR, {failed} failed)`

If no evidence path was provided, skip this entire section.

### Step 0.3: Write proposition

- **Lightweight inline:** Write the user's question directly to `proposition.md` in the docket directory. Frame it as a decidable question — if the user's input is vague, sharpen it into a specific proposition.
- **YAML with input artifacts:** Read each input artifact file. Write `proposition.md` with the question and a summary of the input artifacts.

Store the full docket path in a variable — every subsequent file write uses this base path.

---

## Dispatch safety rule

After EVERY subagent dispatch: wait for completion, then verify the expected output file exists at its target path. If the file is missing, check the subagent's response text and write it to the correct path. Do not proceed to the next phase until all expected files from the current phase are confirmed.

## Challenge-response categorization rules

Both lightweight and standard synthesis use this same table. Be case-insensitive when checking markers. Accept whitespace variations.

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

## Tone injection pattern

When a tone is loaded, inject this block into every dispatch prompt (all phases, both protocols). When no tone is loaded, omit entirely — do not include empty headers.

```
## Tone
{tone voice directive content}

### Tone examples
{tone examples content}
```

All dispatch templates below use the shorthand **[TONE BLOCK]** to indicate where this block goes.

## Docket.json schema

Both protocols write `{docket-path}/docket.json` using this structure. Populate fields from the composition YAML (standard) or hardcoded defaults (lightweight).

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "composition": "{composition name}",
  "mode": "{lightweight|standard}",
  "tone": "{tone name, or omit field if no tone}",
  "proposition_summary": "{first sentence of proposition.md}",
  "input_artifacts": ["{list of input file paths}"],
  "evidence": {
    "source": "{evidence path from CLI flag or YAML field}",
    "source_type": "{cli_flag | yaml_field | none}",
    "files": [
      {
        "filename": "{original filename}",
        "sha256": "{hash}",
        "method": "{born-digital | tesseract-ocr | direct-copy | failed}",
        "confidence": "{high | medium | low}"
      }
    ]
  },
  "appendix": {
    "present": "{true | false}",
    "researcher": "{role_name}",
    "verified_cases": "{count}",
    "verified_absences": "{count}",
    "addenda": "{count}"
  },
  "verification": {
    "present": "{true | false}",
    "auditor": "{role_name}",
    "claims_total": "{N}",
    "claims_verified": "{M}",
    "confirmed": "{count}",
    "refuted": "{count}",
    "inconclusive": "{count}",
    "not_checked": "{N-M}"
  },
  "delegates": [
    {
      "role": "{role}",
      "prompt_register": "{prompt_register}",
      "grounding": "{grounding path or null}",
      "capabilities": ["{capabilities}"]
    }
  ],
  "rules": {
    "max_rounds": "{number}",
    "independent_positions": "{false for lightweight, true for standard}",
    "require_dissent_record": "{boolean}",
    "human_deferral": "{boolean}",
    "veto_roles": ["{standard only — omit for lightweight}"]
  },
  "rounds": [
    {
      "round": "{N}",
      "positions_filed": "{count}",
      "challenges_filed": "{count}",
      "responses_filed": "{count}",
      "synthesis_status": "{settled|contested|vetoed}",
      "contested_points": ["{list}"],
      "parallel_dispatches": ["{standard only — omit for lightweight}"]
    }
  ],
  "outcome": "{ratified|ratified_with_dissent|forced|deferred|vetoed}",
  "dissent": {
    "present": "{true|false}",
    "delegate": "{role if present}",
    "concern": "{concern text if present}"
  },
  "provenance": [
    {
      "decision": "{key decision}",
      "proposed_by": "{role}",
      "challenged_by": "{role}",
      "challenge": "{challenge text}",
      "resolved_by": "{role or consensus}",
      "resolution": "{how resolved}"
    }
  ]
}
```

**Omission rule:** If evidence was not provided, appendix was not produced, or verification was not performed, omit the corresponding top-level field entirely from the JSON. Do not set it to `null` or include an empty stub.

---

# Lightweight Protocol

Use this protocol when mode is lightweight (2 delegates, inline invocation, or lightweight YAML composition). All dispatch is sequential — each step depends on prior output.

---

## Phase 1: Position dispatch (proposer)

Output progress: `Deliberation: {name}`
Output progress: `  Collecting proposer position...`

### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the proposer's dispatch prompt:

```
You are the Proposer in this deliberation.

## Your role
You propose and defend the approach under deliberation. Argue like an
engineering design doc — direct assertions backed by evidence, no hedging.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Input artifacts
{contents of each input artifact file, if any}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
Follow this template exactly:
{contents of position template}

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/proposer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch proposer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-proposer` agent definition.

Output progress: `  Collecting proposer position... done`

---

## Phase 2: Challenge dispatch (critic)

Output progress: `  Adversarial challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the proposer's position from `{docket-path}/positions/round-1/proposer.md`.

Assemble the critic's dispatch prompt:

```
You are the Critic in this deliberation. Your capability is challenge_all.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Proposer's position:
{contents of proposer.md}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: proposer"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1.md

Do not write to any other path. Do not output anything else.
```

### Step 2.2: Dispatch critic subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-critic` agent definition.

Output progress: `  Adversarial challenge... done`

---

## Phase 3: Response dispatch (proposer)

Output progress: `  Collecting proposer response...`

### Step 3.1: Extract challenges directed at proposer

Read `{docket-path}/challenges/round-1.md`. Extract the section under `## Challenges to: proposer` — everything from that header until the next `## Challenges to:` header or `## Shared blind spots` or end of file.

### Step 3.2: Assemble dispatch package

```
You are the Proposer. You are responding to adversarial challenges.

[TONE BLOCK]

## Your original position
{contents of positions/round-1/proposer.md}

## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}

## Challenges directed at you
{extracted challenges section}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag. The engine
parses these tags to determine whether your defense is adequate.

Available actions:
- [ACTION: DEFEND] — Refute the challenge with evidence. You MUST include at
  least one [CITE: filename, section] marker. Example:

  [ACTION: DEFEND]
  The latency concern is addressed by the connection pooling configuration.
  [CITE: api-contract.md, section 4.2] specifies a maximum pool size of 50
  with 30-second idle timeout, which benchmarks show handles 10k concurrent
  requests under 15ms p99.

- [ACTION: CONCEDE] — Accept the challenge as valid. State what changes in
  your position. Example:

  [ACTION: CONCEDE]
  The critic is correct that single-node Redis is a SPOF. My revised position
  adds Redis Cluster as a requirement for the session store.

- [ACTION: DISSENT] — Accept the majority position but record your concern.
  Example:

  [ACTION: DISSENT]
  I accept the JWT approach but want it on the record that token revocation
  latency under 50ms has not been empirically verified. This is a risk flag
  for implementation review.

Do NOT ignore any challenge. Do NOT respond without an [ACTION:] tag.

## CRITICAL: Write your output to this exact file path
Write your complete response to: {docket-path}/responses/round-1/proposer.md
```

### Step 3.3: Dispatch proposer subagent

Dispatch using the `deliberation-proposer` agent definition.

Output progress: `  Collecting proposer response... done`

---

## Phase 4: Synthesis (engine logic — NOT a subagent)

Output progress: `  Synthesizing round 1...`

This phase is performed by YOU (the engine), not by a subagent. You are categorizing challenge-response pairs using structural markers. Do not apply judgment — check for marker presence.

### Step 4.1: Read all response files

Read `{docket-path}/responses/round-1/proposer.md`.

### Step 4.2: Categorize each challenge-response pair

For each challenge that was directed at the proposer, find the corresponding response and categorize using the **challenge-response categorization rules** defined above.

### Step 4.3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables with your categorization results.
Write to `{docket-path}/synthesis/round-1.md`.

### Step 4.4: Determine round outcome

- If ALL challenges are settled (including settled with dissent): **ratified**
- If ANY challenges are contested AND current round < max_rounds: **proceed to round 2**
- If ANY challenges are contested AND current round >= max_rounds:
  - If `human_deferral: true`: **deferred**
  - If `human_deferral: false`: **forced** (proposer's position wins)
- If ANY challenges are vetoed: **vetoed**

Output progress: `  Synthesis: {N} settled, {N} contested → {outcome}`

---

## Phase 5: Decision

### If ratified or forced

Read the decision template from `${CLAUDE_PLUGIN_ROOT}/templates/decision.md`.

Assemble `decision.md` with:
- **Outcome:** ratified, ratified with dissent, or forced
- **Ratified specification:** The proposer's final position (incorporating any concessions)
- **Provenance table:** For each key point — who proposed it, who challenged it, how it was resolved
- **Dissent record:** If any `[ACTION: DISSENT]` responses were registered
- **Unresolved challenges:** If forced — list all contested challenges that were not addressed

Write to `{docket-path}/decision.md`.

### If deferred

Read the deferral template from `${CLAUDE_PLUGIN_ROOT}/templates/deferral.md` (if it exists — Phase 4 deliverable).

Assemble `deferral.md` with settled points, contested points with both sides, and concrete options for the human.

Write to `{docket-path}/deferral.md`.

---

## Phase 6: Docket finalization

### Step 6.1: Assemble docket.json

Write `{docket-path}/docket.json` using the **docket.json schema** defined above. For lightweight mode, use hardcoded delegate values (proposer with "engineering design doc" register, critic with "legal brief" register and `challenge_all`), `independent_positions: false`, and omit `veto_roles` and `parallel_dispatches`.

### Step 6.2: Write dissent.md (if applicable)

If any `[ACTION: DISSENT]` was registered, write `{docket-path}/dissent.md` with:
- Delegate role
- Accepted position
- Specific concern
- Recommended action
- Status: "Accepted under protest"

### Step 6.3: Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Then present the contents of `decision.md` to the user in the conversation. The docket is the permanent record; the conversation output is the immediate summary.

---

## Round 2 (if needed)

If Phase 4 determined "proceed to round 2":

### Narrow scope

1. Create `{docket-path}/positions/round-2/` and `{docket-path}/responses/round-2/`
2. Compile compressed context:
   - **Settled points:** List by name only — "The following are settled and not under deliberation: {list}"
   - **Contested points:** For each — brief summary of the challenge and why the defense was insufficient
   - **Proposer's prior position:** Include for consistency

### Dispatch round 2

Repeat Phases 1-4 with the narrowed scope:
- Proposer receives compressed context + contested points only
- Critic receives proposer's new position on contested points only
- Proposer responds to new challenges
- Engine synthesizes round 2

Update `docket.json` rounds array with round 2 data.

If still contested after round 2, apply terminal behavior (forced or deferred per rules).

---
---

# Standard Protocol

Use this protocol when mode is standard (3-5 delegates + Chair, YAML composition with `mode: standard`). Parallel dispatch where independent, sequential where dependent. Anti-anchoring enforced.

Read the full protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/standard-deliberation/SKILL.md` for detailed rules on parallel dispatch, veto mechanics, human deferral, and context compression.

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

Apply the **challenge-response categorization rules** defined above to each delegate's response.

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

Write `{docket-path}/docket.json` using the **docket.json schema** defined above. For standard mode, populate delegates and rules from the composition YAML, set `independent_positions: true`, and include `parallel_dispatches` in each round entry with phase-level dispatch metadata.

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

---
---

# Code Review Protocol

Use this protocol when mode is code-review (invoked from `/delphi-review` command, or YAML composition with `mode: code-review`). Sequential dispatch with 3 default delegates + conditional Enforcer.

Read the protocol reference at `${CLAUDE_PLUGIN_ROOT}/skills/code-review-deliberation/SKILL.md` for rules on delegate dispatch contracts, anti-anchoring, and remediation plan generation.

---

## Review Phase 0: Initialization

### Step 0.1: Parse review context

When invoked from `/delphi-review`, you receive:
- **review_artifact:** assembled code content (files or diff with full file contents)
- **review_files:** list of file paths being reviewed
- **review_type:** `files` or `diff`
- **diff_ref:** git ref if diff mode (or `staged`)
- **conventions:** conventions file path and contents (or null)
- **composition:** parsed YAML (or null for hardcoded defaults)
- **tone:** tone name (or null)

### Step 0.2: Determine delegate roster

**Quick-path (no composition):**
Use the hardcoded roster:

| Role | Agent | Role type |
|------|-------|-----------|
| advocate | `deliberation-advocate` | participant |
| critic | `deliberation-critic` | challenger |
| maintainer | `deliberation-maintainer` | challenger |
| enforcer (conditional) | `deliberation-enforcer` | auditor |

The Enforcer is included ONLY when conventions are provided.

**Composition path:**
Read the YAML delegate list. For each delegate:
1. Use `role_type` to determine dispatch phase
2. Resolve agent file using the same precedence as Standard Protocol (project `.claude/agents/` > plugin `agents/` > YAML prompt only)
3. Validate: at least one `participant` and one `challenger` required

### Step 0.3: Create docket directory

Generate docket name: `{YYYYMMDD}-{HHmmss}-review-{slug}` where slug is derived from the first reviewed filename (e.g., `review-dashboard-tsx`).

Create directory structure using Bash `mkdir -p`:

```
.deliberation/dockets/{docket-name}/
  code-under-review/
  positions/round-1/
  challenges/
  responses/round-1/
  compliance/
  synthesis/
  remediation/
```

Only create `compliance/` if conventions are provided.

### Step 0.4: Snapshot code under review

Copy each reviewed file to `{docket-path}/code-under-review/`:
- For file review: copy each file preserving the filename
- For diff review: write `diff.patch` with the raw diff, and copy each changed file

This makes the docket self-contained — the review is reproducible even if source files change.

### Step 0.5: Write proposition

Write `{docket-path}/proposition.md`:

```
# Code Review Proposition

**Review type:** {files | diff}
**Files:** {comma-separated list of file paths}
**Conventions:** {conventions file path, or "none"}

## Proposition

Review the following code for quality, correctness, maintainability, and
convention compliance. The Advocate will defend the implementation. The
Critic will challenge its correctness and robustness. The Maintainer will
evaluate its comprehensibility and modification safety.
{If conventions: "The Enforcer will audit against stated conventions."}

## Code under review

{review_artifact content — the assembled code/diff}
```

### Step 0.6: Tone loading

If a tone was provided, load it using the same resolution precedence as Standard Protocol:
1. `.claude/delphi/tones/{tone}.md` (user-defined)
2. `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` (built-in)
3. Warning if not found, proceed without tone

---

## Review Phase 1: Advocate position

Output progress: `Code review: {slug}`
Output progress: `  Advocate position...`

### Step 1.1: Assemble dispatch package

Read the position template from `${CLAUDE_PLUGIN_ROOT}/templates/position.md`.

Assemble the Advocate's dispatch prompt:

```
You are the Advocate in this code review.

## Your role
You read the code under review, understand what it does, and defend the
implementation choices. Argue like an engineering design doc — direct
assertions backed by evidence from the actual code.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Conventions
{if conventions provided: contents of conventions file}
{if no conventions: "No conventions file provided. Evaluate against general best practices."}

## Output format
Follow this template exactly:
{contents of position template}

Write "# Position: advocate" as your heading.

## CRITICAL: Write your output to this exact file path
Write your complete position to: {docket-path}/positions/round-1/advocate.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch advocate subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-advocate` agent definition.

Output progress: `  Advocate position... done`

---

## Review Phase 2: Critic challenge

Output progress: `  Critic challenge...`

### Step 2.1: Assemble dispatch package

Read the challenge template from `${CLAUDE_PLUGIN_ROOT}/templates/challenge.md`.
Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

Assemble the Critic's dispatch prompt:

```
You are the Critic in this code review. Your capability is challenge_all.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

## Output format
Follow this template exactly. You MUST use the header "## Challenges to: advocate"
(the exact role name) so the engine can route your challenges correctly.
{contents of challenge template}

Note: In code review mode, adapt the template sections to code concerns:
- "Weakest claim" → the least-supported defense of a code choice
- "Untested assumption" → an assumption about correctness, performance, or behavior
- "Failure scenario" → a concrete scenario where this code breaks

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-critic.md

Do not write to any other path. Do not output anything else.
```

### Step 2.2: Dispatch critic subagent

Dispatch using the `deliberation-critic` agent definition.

Output progress: `  Critic challenge... done`

---

## Review Phase 3: Maintainer challenge

Output progress: `  Maintainer challenge...`

### Step 3.1: Assemble dispatch package

Read the Advocate's position from `{docket-path}/positions/round-1/advocate.md`.

**Anti-anchoring: Do NOT read or include the Critic's challenges.**

Assemble the Maintainer's dispatch prompt:

```
You are the Maintainer in this code review. You read code as someone who
will inherit it in 6 months with no access to the original author.

[TONE BLOCK]

## Proposition
{contents of proposition.md}

## Position to challenge

### Advocate's position:
{contents of advocate.md}

## Output format
Structure your challenges under this exact header:

## Challenges to: advocate

### Naming and clarity
[Are names self-documenting? Flag anything that requires reading the body
to understand the name.]

### Abstraction quality
[Are abstractions justified? Is there unnecessary indirection or missing
extraction?]

### Modification safety
[What would you be afraid to touch? Where are hidden coupling points?]

### Missing context
[What would a new developer need to know that isn't in the code?]

## CRITICAL: Write your output to this exact file path
Write your complete challenge document to: {docket-path}/challenges/round-1-maintainer.md

Do not write to any other path. Do not output anything else.
```

### Step 3.2: Dispatch maintainer subagent

Dispatch using the `deliberation-maintainer` agent definition.

Output progress: `  Maintainer challenge... done`

---

## Review Phase 4: Enforcer compliance report (conditional)

**Skip this phase entirely if no conventions were provided.**

Output progress: `  Enforcer compliance check...`

### Step 4.1: Assemble dispatch package

Read the compliance report template from `${CLAUDE_PLUGIN_ROOT}/templates/compliance-report.md`.

Assemble the Enforcer's dispatch prompt:

```
You are the Enforcer in this code review. You audit code against conventions.

[TONE BLOCK]

## Code under review
{review_artifact content — the assembled code/diff}

## Conventions to enforce
{contents of conventions file}

## Output format
Follow this template exactly:
{contents of compliance report template}

## CRITICAL: Write your output to this exact file path
Write your complete compliance report to: {docket-path}/compliance/enforcer-report.md

Do not write to any other path. Do not output anything else.
```

### Step 4.2: Dispatch enforcer subagent

Dispatch using the `deliberation-enforcer` agent definition.

**The Enforcer does NOT participate in the challenge-response cycle.** Its report is appended to the docket and feeds into the remediation plan, but the Advocate does not respond to it.

Output progress: `  Enforcer compliance check... done`

---

## Review Phase 5: Advocate response

Output progress: `  Advocate response...`

### Step 5.1: Extract challenges from both challengers

Read `{docket-path}/challenges/round-1-critic.md`. Extract the section under `## Challenges to: advocate`.
Read `{docket-path}/challenges/round-1-maintainer.md`. Extract the section under `## Challenges to: advocate`.

### Step 5.2: Assemble dispatch package

```
You are the Advocate. You are responding to adversarial challenges from
the Critic and the Maintainer.

[TONE BLOCK]

## Your original position
{contents of positions/round-1/advocate.md}

## Challenges directed at you

### From Critic:
{extracted challenges from critic}

### From Maintainer:
{extracted challenges from maintainer}

## Response instructions
For EACH challenge, you MUST respond with EXACTLY ONE action tag. The engine
parses these tags to determine whether your defense is adequate.

Available actions:
- [ACTION: DEFEND] — Refute the challenge with evidence. You MUST include at
  least one [CITE: filename, line] marker pointing to actual code. Example:

  [ACTION: DEFEND]
  The naming concern is addressed — `processPayment` clearly describes the
  function's purpose. [CITE: PaymentService.tsx, line 42] shows the function
  handles exactly one payment transaction with explicit error boundaries.

- [ACTION: CONCEDE] — Accept the challenge as valid. State what should change
  in the code. Example:

  [ACTION: CONCEDE]
  The maintainer is correct that the nested ternary on line 87 is unreadable.
  This should be extracted to a named helper function with descriptive parameter names.

- [ACTION: DISSENT] — Accept the finding but record disagreement. Example:

  [ACTION: DISSENT]
  I accept that the abstraction adds indirection, but want it on the record
  that removing it would create duplication across 3 call sites that will
  diverge over time.

Respond to EVERY challenge from BOTH the Critic and the Maintainer. Use
clear headers to organize your responses:

### Response to Critic

[responses with action tags]

### Response to Maintainer

[responses with action tags]

Do NOT ignore any challenge. Every challenge gets exactly one action tag.

## CRITICAL: Write your output to this exact file path
Write your complete response to: {docket-path}/responses/round-1/advocate.md
```

### Step 5.3: Dispatch advocate subagent

Dispatch using the `deliberation-advocate` agent definition.

Output progress: `  Advocate response... done`

---

## Review Phase 6: Synthesis (engine logic — NOT a subagent)

Output progress: `  Synthesizing review...`

This phase is performed by YOU (the engine), not by a subagent.

### Step 6.1: Read all files

Read `{docket-path}/responses/round-1/advocate.md`.
If Enforcer ran: read `{docket-path}/compliance/enforcer-report.md`.

### Step 6.2: Categorize challenge-response pairs

For each challenge from the Critic and Maintainer, find the Advocate's corresponding response and categorize using the **challenge-response categorization rules** defined in the shared engine rules above.

### Step 6.3: Write synthesis

Read the synthesis template from `${CLAUDE_PLUGIN_ROOT}/templates/synthesis.md`.
Fill in the tables. Write to `{docket-path}/synthesis/round-1.md`.

If Enforcer ran, append to the synthesis:

```
## Compliance report summary

Conventions checked: {N} | Pass: {N} | Fail: {N} | N/A: {N}

Failed conventions are included in the remediation plan as Critical items.
Full report: compliance/enforcer-report.md
```

### Step 6.4: Determine outcome

Code review uses single-round by default (quick-path). The outcome is always terminal:
- ALL settled: **clean** (code passes review)
- ANY contested or conceded: **findings** (remediation needed)
- If composition specifies `max_rounds > 1`: follow the same multi-round logic as Lightweight Protocol

Output progress: `  Synthesis: {settled} settled, {contested} contested, {conceded} conceded`

---

## Review Phase 7: Remediation plan (engine logic — NOT a subagent)

Output progress: `  Generating remediation plan...`

### Step 7.1: Collect findings

From the synthesis and compliance report, build a findings list:

**Critical findings:**
- Every contested point (Advocate's defense was unsupported or absent)
- Every `[ACTION: CONCEDE]` from the Advocate
- Every failure in the Enforcer's compliance report

**Recommended findings:**
- Every `[ACTION: DISSENT]` from the Advocate

**Optional findings:**
- Every `[ACTION: DEFEND]` with self-referential `[CITE:]` (flagged in synthesis)
- Successfully defended points where the Maintainer raised the concern (awareness items)

### Step 7.2: Trace to code locations

For EACH finding, extract the `[CITE: filename, line]` markers from the delegate challenges and Advocate responses. Map each finding to a specific File + Lines + Action triple.

If a finding has no `[CITE:]` marker pointing to a specific code location, attempt to infer the location from the challenge text (file names, function names, line references in the challenge prose). If still unresolvable, include the finding with `Lines: N/A` and a note: "Code location could not be determined from delegate output."

### Step 7.3: Write remediation plan

Read the remediation plan template from `${CLAUDE_PLUGIN_ROOT}/templates/remediation-plan.md`.
Fill in all findings organized by priority tier.
Write to `{docket-path}/remediation/plan.md`.

Output progress: `  Remediation plan: {critical} critical, {recommended} recommended, {optional} optional`

---

## Review Phase 8: Docket finalization

### Step 8.1: Write docket.json

Write `{docket-path}/docket.json`:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "mode": "code-review",
  "tone": "{tone name, or omit if none}",
  "review_target": {
    "type": "{files | diff}",
    "paths": ["{list of file paths}"],
    "diff_ref": "{git ref or 'staged', omit if file mode}",
    "conventions": "{conventions file path, omit if none}"
  },
  "delegates": [
    {
      "role": "{role}",
      "role_type": "{participant | challenger | auditor}",
      "agent": "{agent file name}"
    }
  ],
  "rules": {
    "max_rounds": 1,
    "independent_challenges": true,
    "enforcer_active": "{true | false}"
  },
  "outcome": "{clean | findings}",
  "remediation": {
    "critical": "{count}",
    "recommended": "{count}",
    "optional": "{count}"
  },
  "provenance": [
    {
      "finding": "{finding title}",
      "raised_by": "{role}",
      "response": "{DEFEND | CONCEDE | DISSENT | none}",
      "resolution": "{settled | contested | conceded | dissent}"
    }
  ]
}
```

### Step 8.2: Present results

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`

Present a summary to the user:

```
## Code Review: {slug}

**Outcome:** {Clean — no findings | Findings — remediation needed}

### Summary
- Settled (code defended): {N}
- Contested (defense failed): {N}
- Conceded (advocate agreed): {N}
- Convention failures: {N} (if Enforcer ran)

### Remediation plan
{If findings: display contents of remediation/plan.md}
{If clean: "No remediation needed. All challenges were addressed with evidence."}

Docket: `.deliberation/dockets/{docket-name}/`
Remediation plan: `.deliberation/dockets/{docket-name}/remediation/plan.md`
```
