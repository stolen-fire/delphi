# Delphi v0.5: Evidence Pipeline, Capabilities, and Routing Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the multi-challenger routing bug that caused premature 1-round settlement, add an evidence submission pipeline with document conversion, introduce `research_authority` and `verify_sources` capabilities, give the Chair evidence access, and add a verification coverage map to synthesis output.

**Architecture:** Five workstreams modifying the engine skill (`skills/delphi/SKILL.md`), command (`commands/delphi.md`), composition builder (`commands/delphi-compose.md`), templates, and agent definitions. All changes are pure Markdown/YAML — no build system. The engine skill is the primary file (~916 lines) and receives the most edits. New templates and a new agent definition are created for the evidence and research phases.

**Tech Stack:** Markdown, YAML, Bash (pdftotext, Tesseract OCR, sha256sum), Claude Code plugin system

---

## File Structure

### Files to modify
| File | Responsibility | Workstream |
|------|---------------|------------|
| `skills/delphi/SKILL.md` | Main engine — routing, phases, synthesis, capabilities | 1, 2, 3, 4, 5 |
| `commands/delphi.md` | CLI argument parsing — `--evidence` flag | 2 |
| `commands/delphi-compose.md` | Composition builder — evidence step, new capabilities | 2, 3, 4 |
| `templates/synthesis.md` | Synthesis output format — verification coverage | 1, 4 |
| `templates/challenge.md` | Challenge template — shared blind spots routing | 1 |
| `agents/deliberation-chair.md` | Chair agent — evidence access in decision writing | 5 |
| `skills/standard-deliberation/SKILL.md` | Protocol reference — new capabilities, phases | 2, 3, 4, 5 |
| `compositions/integration-review.yml` | Example composition — evidence field | 2 |

### Files to create
| File | Responsibility | Workstream |
|------|---------------|------------|
| `templates/evidence-index.md` | Evidence INDEX.md format with provenance columns | 2 |
| `templates/case-law-appendix.md` | Case law appendix format with verified absences | 3 |
| `templates/verification-log.md` | Verification log format with four categories | 4 |

---

## Workstream 1: Routing Bug Fixes

### Task 1: Fix multi-challenger response routing

The engine at `skills/delphi/SKILL.md:648` says "For each participating delegate (except the adversarial delegate who wrote the challenges)". When multiple `challenge_all` delegates exist, this is ambiguous — the executing session skipped ALL adversarial delegates instead of only the author of each specific challenge document.

**Files:**
- Modify: `skills/delphi/SKILL.md:640-700` (Standard Phase 4)

- [ ] **Step 1: Replace the routing instruction at lines 646-651**

Replace this block at `skills/delphi/SKILL.md` lines 646-651:

```markdown
### Route challenges to each delegate

Read the challenge document(s). For each participating delegate (except the adversarial delegate who wrote the challenges):

1. Extract the section under `## Challenges to: {role_name}` — everything from that header until the next `## Challenges to:` header or `## Shared blind spots` or end of file
2. If no section exists for this delegate, they were not challenged — skip them
```

With this explicit per-document routing:

```markdown
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
```

- [ ] **Step 2: Verify the change is self-consistent with the dispatch template**

Read the dispatch template at lines 655-694. Confirm that `## Challenges directed at you` at line 675 matches the new header name from Step 1. No change needed — the existing template already uses this header.

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: explicit per-document challenge routing for multi-challenger deliberations

When multiple challenge_all delegates exist, route challenges from each
document independently. A delegate is excluded only from their own challenge
document, not from all challenge documents. Fixes premature settlement when
adversarial delegates challenge each other."
```

---

### Task 2: Add pre-synthesis completeness check

The engine proceeds from response collection to synthesis without verifying that every challenged delegate actually responded. Missing response files should be caught before synthesis, not silently treated as settled.

**Files:**
- Modify: `skills/delphi/SKILL.md:696-704` (between response dispatch and synthesis)

- [ ] **Step 1: Add completeness check after response dispatch**

After the existing line 700 (`Output progress: ... done`) and before line 702 (`---`), insert:

```markdown
### Verify response completeness

Before proceeding to synthesis, verify that every delegate in the challenge map produced a response file:

1. For each delegate that appears as a challenge target in the challenge map (from Step "Route challenges to each delegate"):
   - Check that `{docket-path}/responses/round-{N}/{role_name}.md` exists
   - If missing: this delegate was challenged but did not respond

2. If ANY response files are missing:
   - Output warning: `  ⚠ Missing responses: {list of role names}`
   - For synthesis purposes, treat every challenge directed at a non-responding delegate as **Contested (unaddressed)** — the "No `[ACTION:]` tag" row in the categorization table applies
   - Do NOT halt the deliberation — proceed to synthesis with the contested markers

This check catches the exact failure mode where a delegate is incorrectly excluded from response routing — the downstream effect is contested points that force a Round 2, rather than silent premature settlement.
```

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "fix: pre-synthesis completeness check for missing response files

Verify every challenged delegate produced a response before synthesis.
Missing responses are treated as contested (unaddressed), forcing Round 2
instead of silently settling."
```

---

### Task 3: Make shared blind spots actionable

Currently, `## Shared blind spots` is used as a termination sentinel during challenge extraction — the content is identified but never routed to any delegate. When multiple challengers flag the same gap, it should become a formal challenge.

**Files:**
- Modify: `skills/delphi/SKILL.md:646-651` (the routing section from Task 1 — extend it)
- Modify: `templates/challenge.md:27-30` (add guidance)

- [ ] **Step 1: Add shared blind spots routing to the challenge map logic**

After the challenge map construction (from Task 1), add this section to `skills/delphi/SKILL.md` in the routing logic:

```markdown
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
```

- [ ] **Step 2: Update the challenge template guidance**

In `templates/challenge.md`, replace lines 27-30:

```markdown
## Shared blind spots

[Where do multiple delegates agree? What does that agreement conceal? Agreement that hasn't been adversarially tested is more dangerous than open disagreement. If all positions share an assumption, that assumption is the most important thing to challenge.]
```

With:

```markdown
## Shared blind spots

[Where do multiple delegates agree? What does that agreement conceal? Agreement that hasn't been adversarially tested is more dangerous than open disagreement. If all positions share an assumption, that assumption is the most important thing to challenge.

NOTE: When multiple adversarial delegates independently identify the same blind spot, the engine promotes it to a formal challenge that all non-adversarial delegates must address. Be specific — name the assumption, explain what it conceals, and describe how the deliberation's conclusions change if the assumption is wrong.]
```

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md templates/challenge.md
git commit -m "feat: promote convergent shared blind spots to formal challenges

When multiple adversarial delegates independently identify the same blind
spot, promote it to a formal challenge routed to all non-adversarial
delegates. Single-challenger blind spots remain noted but not routed."
```

---

### Task 4: Flag self-referential citations in synthesis

The engine treats all `[CITE:]` markers identically. A delegate citing their own position file is circular, not independent evidence. The synthesis should flag this.

**Files:**
- Modify: `skills/delphi/SKILL.md:714-727` (Standard Phase 5 categorization)
- Modify: `skills/delphi/SKILL.md:241-254` (Lightweight Phase 4 categorization)
- Modify: `templates/synthesis.md:7-11` (settled points table)

- [ ] **Step 1: Add citation validation to the standard mode categorization**

In `skills/delphi/SKILL.md`, replace the categorization section at lines 714-727:

```markdown
### Categorize each challenge-response pair

For each delegate's response, for each challenge directed at them:

| Markers found | Category |
|--------------|----------|
| `[ACTION: DEFEND]` with `[CITE:]` | **Settled** |
| `[ACTION: DEFEND]` without `[CITE:]` | **Contested** (unsupported) |
| `[ACTION: CONCEDE]` | **Settled** (position updated) |
| `[ACTION: DISSENT]` | **Settled with dissent** |
| `[ACTION: VETO]` with `[CITE:]` | **Vetoed** |
| No `[ACTION:]` tag | **Contested** (unaddressed) |

Be case-insensitive. Accept whitespace variations.
```

With:

```markdown
### Categorize each challenge-response pair

For each delegate's response, for each challenge directed at them:

| Markers found | Category |
|--------------|----------|
| `[ACTION: DEFEND]` with `[CITE:]` referencing input artifacts, grounding material, evidence directory, or case law appendix | **Settled** |
| `[ACTION: DEFEND]` with `[CITE:]` referencing ONLY the delegate's own position file or other deliberation documents (proposition, other positions) | **Settled (self-referential citation)** — flag in synthesis |
| `[ACTION: DEFEND]` without any `[CITE:]` marker | **Contested** (unsupported) |
| `[ACTION: CONCEDE]` | **Settled** (position updated) |
| `[ACTION: DISSENT]` | **Settled with dissent** |
| `[ACTION: VETO]` with `[CITE:]` | **Vetoed** |
| No `[ACTION:]` tag | **Contested** (unaddressed) |

**Citation validation:** Check what each `[CITE: filename, section]` references. A citation to the delegate's own position file (e.g., `[CITE: positions/round-1/prosecuting_analyst.md, ...]`) or to the proposition (e.g., `[CITE: proposition.md, ...]`) is self-referential — it adds no independent evidence. These defenses are still classified as Settled (the engine does not override the delegate's judgment), but they are flagged in the synthesis table so the Chair and human readers can assess citation quality.

Be case-insensitive when checking for markers. Accept whitespace variations.
```

- [ ] **Step 2: Apply the same change to the lightweight mode categorization**

In `skills/delphi/SKILL.md`, update the lightweight categorization at lines 241-254 with the identical table and citation validation paragraph.

- [ ] **Step 3: Update the synthesis template**

In `templates/synthesis.md`, replace the settled points table at lines 7-11:

```markdown
| Point | Defender | Action | Evidence |
|-------|----------|--------|----------|
| {description} | {role} | DEFEND | [CITE: ...] present |
| {description} | {role} | CONCEDE | Position updated |
| {description} | {role} | DISSENT | Concern recorded |
```

With:

```markdown
| Point | Defender | Action | Evidence | Citation quality |
|-------|----------|--------|----------|-----------------|
| {description} | {role} | DEFEND | [CITE: ...] present | Independent |
| {description} | {role} | DEFEND | [CITE: ...] present | ⚠ Self-referential |
| {description} | {role} | CONCEDE | Position updated | — |
| {description} | {role} | DISSENT | Concern recorded | — |
```

- [ ] **Step 4: Commit**

```bash
git add skills/delphi/SKILL.md templates/synthesis.md
git commit -m "feat: flag self-referential citations in synthesis

Citations referencing a delegate's own position or other deliberation
documents are flagged as self-referential in the synthesis table. Still
classified as settled (engine does not override delegate judgment), but
flagged for Chair and human assessment of citation quality."
```

---

## Workstream 2: Evidence Pipeline

### Task 5: Add `--evidence` flag to the command

**Files:**
- Modify: `commands/delphi.md:11-49` (argument parsing)

- [ ] **Step 1: Add `--evidence` flag to Mode 2 parsing**

In `commands/delphi.md`, replace lines 22-27:

```markdown
**Mode 2 — YAML composition:**
If `$ARGUMENTS` contains `--config`:
- Extract the path after `--config` — this is the composition YAML file
- If `$ARGUMENTS` also contains `--input`, extract all paths after `--input` — these are input artifact files
- If `$ARGUMENTS` also contains `--tone`, extract the tone name — this overrides any `tone` field in the composition YAML
- Read the YAML to determine the mode (lightweight or standard)
```

With:

```markdown
**Mode 2 — YAML composition:**
If `$ARGUMENTS` contains `--config`:
- Extract the path after `--config` — this is the composition YAML file
- If `$ARGUMENTS` also contains `--input`, extract all paths after `--input` — these are input artifact files
- If `$ARGUMENTS` also contains `--evidence`, extract the path after `--evidence` — this is the evidence directory or file list (overrides YAML `evidence:` field)
- If `$ARGUMENTS` also contains `--tone`, extract the tone name — this overrides any `tone` field in the composition YAML
- Read the YAML to determine the mode (lightweight or standard)
```

- [ ] **Step 2: Add `--evidence` to the usage help**

In `commands/delphi.md`, replace lines 41-48:

```markdown
  /delphi "Should we use event sourcing or CRUD?"     Quick 2-delegate review
  /delphi --tone snarky "Should we use a monorepo?"   Quick review with tone
  /delphi --config comp.yml --input api.md            Custom composition
  /delphi --config comp.yml --input a.md b.md c.md    Multiple artifacts
  /delphi --config comp.yml --tone parliamentary      Override composition tone
  /delphi --dry-run --config comp.yml                 Preview without executing
```

With:

```markdown
  /delphi "Should we use event sourcing or CRUD?"     Quick 2-delegate review
  /delphi --tone snarky "Should we use a monorepo?"   Quick review with tone
  /delphi --config comp.yml --input api.md            Custom composition
  /delphi --config comp.yml --input a.md b.md c.md    Multiple artifacts
  /delphi --config comp.yml --evidence ./docs/        Submit evidence directory
  /delphi --config comp.yml --tone parliamentary      Override composition tone
  /delphi --dry-run --config comp.yml                 Preview without executing
```

- [ ] **Step 3: Add `evidence` to the engine pass-through**

In `commands/delphi.md`, replace lines 55-60:

```markdown
Pass to the engine:
- **question:** the inline text or "deliberate on the provided input artifacts"
- **composition:** the parsed YAML (or null for inline — engine uses hardcoded defaults)
- **input_artifacts:** list of file paths from `--input` (or empty)
- **tone:** the tone name from `--tone` flag (or null — engine checks YAML `tone` field as fallback)
- **dry_run:** true/false
```

With:

```markdown
Pass to the engine:
- **question:** the inline text or "deliberate on the provided input artifacts"
- **composition:** the parsed YAML (or null for inline — engine uses hardcoded defaults)
- **input_artifacts:** list of file paths from `--input` (or empty)
- **evidence:** the evidence directory/file path from `--evidence` flag (or null — engine checks YAML `evidence:` field as fallback)
- **tone:** the tone name from `--tone` flag (or null — engine checks YAML `tone` field as fallback)
- **dry_run:** true/false
```

- [ ] **Step 4: Commit**

```bash
git add commands/delphi.md
git commit -m "feat: add --evidence flag for evidence directory submission

Accepts a directory or file path for evidence conversion. Overrides YAML
evidence: field. Passed to engine for preprocessing."
```

---

### Task 6: Create the evidence index template

**Files:**
- Create: `templates/evidence-index.md`

- [ ] **Step 1: Write the evidence index template**

```markdown
# Evidence Index

Source: {evidence source — CLI --evidence flag or YAML evidence: field}
Generated: {ISO 8601 timestamp}

## Files

| File | Pages | Method | Confidence | Notes |
|------|-------|--------|------------|-------|
| {original filename} | {page count or "1" for single-page} | {born-digital / tesseract-ocr / failed} | {high / medium / low} | {notable issues: OCR artifacts, partial extraction, embedded documents} |

## Conversion summary

- Total source files: {N}
- Born-digital (high confidence): {N}
- OCR converted (medium confidence): {N}
- OCR converted (low confidence): {N}
- Failed conversion: {N}

## Hash manifest

| Source file | SHA-256 | Size |
|-------------|---------|------|
| {original path} | {hash} | {bytes} |
```

- [ ] **Step 2: Commit**

```bash
git add templates/evidence-index.md
git commit -m "feat: add evidence index template with provenance and hashing"
```

---

### Task 7: Add evidence conversion to engine setup

This is engine preprocessing — happens before Phase 1 (lightweight) or Standard Phase 0 (standard). Not a deliberation phase.

**Files:**
- Modify: `skills/delphi/SKILL.md:16-53` (Phase 0: Initialization — add evidence preprocessing after docket directory creation)

- [ ] **Step 1: Add evidence preprocessing to the engine initialization**

In `skills/delphi/SKILL.md`, after the docket directory creation (around line 45, after `mkdir -p` commands) and before proposition writing (around line 47), insert:

```markdown
### Evidence preprocessing

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

6. Record evidence metadata in docket.json (will be written at finalization):
   - `"evidence_source"`: the original path (CLI flag or YAML field)
   - `"evidence_source_type"`: "cli_flag" or "yaml_field"
   - `"evidence_files"`: array of {filename, sha256, method, confidence}

Output progress: `  Evidence: {N} files processed ({born-digital} born-digital, {ocr} OCR, {failed} failed)`

If no evidence path was provided, skip this entire section.
```

- [ ] **Step 2: Add evidence directory to delegate dispatch packages**

In `skills/delphi/SKILL.md`, update the Standard Phase 2 position dispatch template (around line 541). After the existing grounding material section:

```markdown
## Grounding material
{contents of grounding file if specified, otherwise "none provided"}
```

Add:

```markdown
## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the file manifest with conversion provenance. You can use the Read tool to examine any evidence file directly."}
{if no evidence: omit this section entirely}
```

Apply the same addition to:
- Lightweight Phase 1 position dispatch (around line 93)
- Standard Phase 3 challenge dispatch (around line 599)
- Standard Phase 4 response dispatch (around line 672)
- Lightweight Phase 2 challenge dispatch (around line 148)
- Lightweight Phase 3 response dispatch (around line 206)

- [ ] **Step 3: Add evidence field to YAML composition schema**

In `commands/delphi-compose.md`, update the YAML schema at lines 211-242. After the `tone:` line (line 214), add:

```yaml
evidence: {path to evidence directory or file list, or omit if none}
```

- [ ] **Step 4: Commit**

```bash
git add skills/delphi/SKILL.md commands/delphi-compose.md
git commit -m "feat: evidence preprocessing pipeline with conversion and hashing

Converts PDFs (pdftotext + Tesseract fallback), DOCX, and text files into
a searchable evidence directory. Generates INDEX.md with per-file provenance
(born-digital/OCR/failed, confidence). SHA-256 hashes for reproducibility.
Evidence directory path passed to all delegate dispatch packages."
```

---

## Workstream 3: Research Authority

### Task 8: Create the case law appendix template

**Files:**
- Create: `templates/case-law-appendix.md`

- [ ] **Step 1: Write the template**

```markdown
# Case Law Appendix

Researcher: {role_name}
Generated: {ISO 8601 timestamp}
Jurisdiction: {primary jurisdiction from composition context}

## Verified authority

| Case | Citation | Holding | Relevance | Source |
|------|----------|---------|-----------|--------|
| {case name} | {full citation} | {one-sentence holding} | {how it applies to this deliberation} | {URL or database} |

## Verified absences

Searches that returned no applicable authority. These are findings, not gaps — they establish that the legal question is unsettled or one of first impression.

| Search terms | Databases checked | Result | Implication |
|-------------|-------------------|--------|-------------|
| {search query} | {e.g., Google Scholar Case Law, state court records} | No appellate authority found | {what the absence means for the deliberation} |

## Addenda

{Round N addenda are appended here during the deliberation when a delegate concedes a cited case and the research_authority recovery window is triggered.}

### Addendum — Round {N} Response Phase ({ISO 8601 timestamp})

**Trigger:** Concession on {case name} ({reason for concession})
**Search:** {search terms used}
**Result:** {case found or verified absence}
**Relevance:** {how it applies}
```

- [ ] **Step 2: Commit**

```bash
git add templates/case-law-appendix.md
git commit -m "feat: add case law appendix template with verified absences"
```

---

### Task 9: Add `research_authority` capability to the engine

**Files:**
- Modify: `skills/delphi/SKILL.md:416-457` (Standard Phase 0 — add capability recognition)
- Modify: `skills/delphi/SKILL.md:458-499` (insert new phase between Phase 0 and Phase 1)
- Modify: `skills/standard-deliberation/SKILL.md` (add capability to protocol reference)

- [ ] **Step 1: Add `research_authority` to capability parsing in Standard Phase 0**

In `skills/delphi/SKILL.md`, update line 421 to add research_authority identification:

Replace:
```markdown
- **Adversarial delegates:** All delegates with `challenge_all` capability
```

With:
```markdown
- **Adversarial delegates:** All delegates with `challenge_all` capability
- **Research delegates:** All delegates with `research_authority` capability
```

- [ ] **Step 2: Insert Standard Phase 1A: Pre-deliberation research**

In `skills/delphi/SKILL.md`, after Standard Phase 1 (Chair proposition framing, ending around line 499) and before Standard Phase 2 (position dispatch, starting around line 501), insert a new phase:

```markdown
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

## Tone
{tone voice directive content, if tone was loaded — omit this entire section if no tone}

### Tone examples
{tone examples content, if tone was loaded — omit this entire section if no tone}

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

Dispatch using an agent with tools: Read, Write, and Scout tools (browse, scout_page_tool, find_elements, execute_action_tool, close_session, launch_session). If the delegate has a corresponding agent file, use it but ADD Scout tools to its tool list for this dispatch.

Wait for completion. Verify `{docket-path}/appendix/case-law.md` exists.

Output progress: `  Pre-deliberation research... done`

### Make appendix available to all delegates

The case law appendix is now a shared artifact. In ALL subsequent dispatch phases (position, challenge, response), include:

```
## Case law appendix
{contents of {docket-path}/appendix/case-law.md}
```

This goes after `## Evidence directory` and before `## Proposition` in every dispatch template.
```

- [ ] **Step 3: Add research_authority recovery window to Standard Phase 4**

In `skills/delphi/SKILL.md`, in the Standard Phase 4 response dispatch section (around line 678), add to the response instructions:

After the existing ACTION tag definitions, before "Do NOT ignore any challenge", add:

```markdown
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
```

Update the response dispatch tool list: for delegates with `research_authority`, add Scout tools to their dispatch (same as Phase 1A).

- [ ] **Step 4: Update the standard-deliberation protocol reference**

In `skills/standard-deliberation/SKILL.md`, add a new section after the "Chair dispatch protocol" section (after line 81):

```markdown
## Research authority protocol

Delegates with `research_authority` capability have access to Scout tools for external research.

### Pre-deliberation window (primary)
- Dispatched after Chair proposition framing, before position statements
- Produces a shared case law appendix at `{docket-path}/appendix/case-law.md`
- Appendix includes verified authority AND verified absences (searches with no results)
- Available to all delegates in subsequent phases

### Response-phase recovery window (secondary)
- Triggered only when a research_authority delegate CONCEDES a cited case under challenge
- Scoped to ONE research call to find replacement authority for the conceded citation
- Result appended to case law appendix as a timestamped addendum
- If no replacement found, verified absence recorded

### Anchoring mitigation
- The appendix is produced by a delegate who also has `challenge_all` — adversarial delegates structurally challenge the research
- Anchoring risk is lower in adversarial systems than consensus-seeking ones
```

- [ ] **Step 5: Commit**

```bash
git add skills/delphi/SKILL.md skills/standard-deliberation/SKILL.md
git commit -m "feat: research_authority capability with pre-deliberation appendix and recovery window

Delegates with research_authority produce a case law appendix before
positions are filed. Includes verified authority and verified absences.
Recovery window during response phase allows one scoped research call
when a cited case is conceded under challenge."
```

---

## Workstream 4: Verify Sources and Coverage Map

### Task 10: Create the verification log template

**Files:**
- Create: `templates/verification-log.md`

- [ ] **Step 1: Write the template**

```markdown
# Verification Log

Auditor: {role_name}
Deliberation: {docket-id}

## Verified claims

| Timestamp | Claim | Source checked | Result | Provenance |
|-----------|-------|---------------|--------|------------|
| {ISO 8601} | {factual claim being verified} | {file path, URL, or database} | {confirmed / refuted / inconclusive} | {page number, section, screenshot URL} |

## Coverage summary

Appended by the engine during synthesis.

| Category | Count |
|----------|-------|
| Factual claims in decision | {N} |
| Verified — confirmed | {N} |
| Verified — refuted | {N} |
| Verified — inconclusive | {N} |
| Not checked | {N} |

### Unchecked claims

| Claim | Source reference | Why unchecked |
|-------|----------------|---------------|
| {claim text} | {where it appears in the decision} | {not contested / not flagged by auditor / outside evidence scope} |
```

- [ ] **Step 2: Commit**

```bash
git add templates/verification-log.md
git commit -m "feat: add verification log template with four-category coverage map"
```

---

### Task 11: Add `verify_sources` capability to the engine

**Files:**
- Modify: `skills/delphi/SKILL.md:416-423` (Standard Phase 0 — capability recognition)
- Modify: `skills/delphi/SKILL.md:640-700` (Standard Phase 4 — tool access for verify_sources delegates)
- Modify: `skills/standard-deliberation/SKILL.md` (protocol reference)

- [ ] **Step 1: Add verify_sources to capability parsing**

In `skills/delphi/SKILL.md`, update the capability extraction (around line 422):

After the line added in Task 9:
```markdown
- **Research delegates:** All delegates with `research_authority` capability
```

Add:
```markdown
- **Verification delegates:** All delegates with `verify_sources` capability
```

- [ ] **Step 2: Grant Scout tools to verify_sources delegates during challenge and response phases**

In `skills/delphi/SKILL.md`, in the Standard Phase 3 challenge dispatch (around line 576) and Standard Phase 4 response dispatch (around line 655):

Add a note after each dispatch template:

```markdown
**Tool access override for verify_sources delegates:** When dispatching a delegate with `verify_sources` capability, add Scout tools (browse, scout_page_tool, launch_session, find_elements, execute_action_tool, close_session) and Read to their agent tool list. Also add to their dispatch prompt:

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
```

- [ ] **Step 3: Add verification coverage map to synthesis**

In `skills/delphi/SKILL.md`, in the Standard Phase 5 synthesis section (around line 729, after "Write synthesis"), add:

```markdown
### Verification coverage map

If a verification log exists at `{docket-path}/verification-log.md`:

1. Read the decision document (or the latest synthesis if decision not yet written)
2. Identify all factual claims — statements that assert something about evidence, documents, dates, amounts, or events (NOT legal arguments or analytical conclusions)
3. Cross-reference each factual claim against the verification log
4. Append a coverage summary to the verification log using the template format:
   - Count of factual claims in the decision
   - Count verified (confirmed + refuted + inconclusive)
   - Count not checked
   - List each unchecked claim with its source reference

5. Also append a brief verification coverage line to the synthesis output:

```
## Verification coverage
Factual claims: {N} | Verified: {M} ({confirmed} confirmed, {refuted} refuted, {inconclusive} inconclusive) | Not checked: {N-M}
```
```

- [ ] **Step 4: Update the standard-deliberation protocol reference**

In `skills/standard-deliberation/SKILL.md`, add after the research authority section:

```markdown
## Source verification protocol

Delegates with `verify_sources` capability have access to Scout tools and the evidence directory for factual verification during challenge and response phases.

### Timing
- Available during Phase 3 (challenge) and Phase 4 (response) — not during position statements
- Verification is on-demand: the auditor decides what to check based on what claims seem uncertain or contested

### Verification log
- Each verification is recorded with timestamp, claim, source, result, and provenance
- Results: confirmed (claim holds), refuted (claim fails), inconclusive (couldn't determine), not checked (no verification attempted)
- The engine appends a coverage summary during synthesis

### Effect on deliberation
- A confirmed claim strengthens the defense — no conditional hedging needed
- A refuted claim becomes a formal input to synthesis — the Chair and engine can assess its impact
- Not-checked claims are disclosed in the coverage map — epistemic honesty about verification depth
```

- [ ] **Step 5: Commit**

```bash
git add skills/delphi/SKILL.md skills/standard-deliberation/SKILL.md
git commit -m "feat: verify_sources capability with mid-deliberation verification and coverage map

Delegates with verify_sources get Scout + Read access during challenge and
response phases. Verification log tracks confirmed/refuted/inconclusive/
not-checked claims. Engine appends coverage summary to synthesis showing
what percentage of factual claims were independently verified."
```

---

## Workstream 5: Chair Evidence Access

### Task 12: Grant Chair Read access to evidence and appendix

**Files:**
- Modify: `skills/delphi/SKILL.md:749-800` (Standard Phase 6 — Chair decision dispatch)
- Modify: `agents/deliberation-chair.md` (agent definition — document evidence access)

- [ ] **Step 1: Add evidence and appendix to Chair decision dispatch**

In `skills/delphi/SKILL.md`, update the Chair decision dispatch template (around lines 773-789). After the existing `### Responses` section and before `## Outcome`:

Add:

```markdown
### Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the manifest. Use Read to examine any file."}
{if no evidence: omit this section}

### Case law appendix
{if appendix exists: contents of {docket-path}/appendix/case-law.md}
{if no appendix: omit this section}

### Verification log
{if verification log exists: contents of {docket-path}/verification-log.md}
{if no verification log: omit this section}
```

Also add a quality instruction to the Chair's dispatch, after the existing instructions (around line 797):

```markdown
- Cross-reference delegate claims against the evidence directory and case
  law appendix. If a delegate claims X but the evidence shows Y, note the
  discrepancy.
- If challenges raised issue X and the response addressed issue Y (adjacent
  but different topics), flag this as potentially miscategorized in synthesis
- Include the verification coverage summary in the decision if a verification
  log exists
```

- [ ] **Step 2: Also add evidence to Chair proposition framing dispatch**

In `skills/delphi/SKILL.md`, update the Chair proposition dispatch template (around lines 490-493). After `## Input artifacts`:

Add:

```markdown
## Evidence directory
{if evidence was processed: "Verified evidence files are available at {docket-path}/evidence/. See {docket-path}/evidence/INDEX.md for the manifest. Use Read to examine any file."}
{if no evidence: omit this section}
```

- [ ] **Step 3: Update the Chair agent definition**

In `agents/deliberation-chair.md`, add after the existing prohibitions section (around line 45):

```markdown
## Evidence access

When evidence directory, case law appendix, or verification log are provided
in your dispatch, use them to:
- Verify that delegate positions are grounded in actual evidence
- Assess whether settled points in synthesis reflect substantive resolution
  or merely structural marker presence
- Note discrepancies between what delegates claim and what the evidence shows
- Include verification coverage in the decision document
```

- [ ] **Step 4: Commit**

```bash
git add skills/delphi/SKILL.md agents/deliberation-chair.md
git commit -m "feat: Chair evidence access for proposition framing and decision writing

Chair receives evidence directory, case law appendix, and verification log
during proposition framing and decision writing. Enables cross-referencing
delegate claims against evidence and catching miscategorized synthesis points."
```

---

## Workstream Cross-Cutting: Update docket.json schema

### Task 13: Extend docket.json with evidence, research, and verification metadata

**Files:**
- Modify: `skills/delphi/SKILL.md:806-866` (Standard docket.json template)
- Modify: `skills/delphi/SKILL.md:304-362` (Lightweight docket.json template)

- [ ] **Step 1: Add new fields to the standard docket.json template**

In `skills/delphi/SKILL.md`, in the standard docket.json template (around line 818), after the existing `"input_artifacts"` field, add:

```json
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
```

- [ ] **Step 2: Add the same fields to the lightweight docket.json template**

In `skills/delphi/SKILL.md`, apply the same additions to the lightweight docket.json template (around line 318). Note: lightweight mode is less likely to use these features, but the schema should be consistent. If evidence/appendix/verification are not used, these fields should be omitted from the JSON (not set to null).

- [ ] **Step 3: Commit**

```bash
git add skills/delphi/SKILL.md
git commit -m "feat: extend docket.json schema with evidence, appendix, and verification metadata

Records evidence provenance (source, hashes, conversion method), research
appendix metadata (case count, verified absences), and verification coverage
(confirmed/refuted/inconclusive/not-checked counts)."
```

---

## Workstream Cross-Cutting: Update /delphi-compose

### Task 14: Add evidence step and new capabilities to composition builder

**Files:**
- Modify: `commands/delphi-compose.md:73-83` (Step 3 — add evidence question)
- Modify: `commands/delphi-compose.md:89-145` (Step 4 — add new capabilities to panel proposal)
- Modify: `commands/delphi-compose.md:211-242` (Step 6 — update YAML schema)

- [ ] **Step 1: Add evidence question to Step 3**

In `commands/delphi-compose.md`, after the existing Step 3 grounding material section (around line 83), add:

```markdown
### Evidence submission

Use `AskUserQuestion` to ask:

> Do you have a directory of source documents (PDFs, court filings, reports) that delegates should be able to verify claims against? If so, provide the path. Otherwise, type "none".

If the user provides a path:
- Verify the path exists using Glob
- Note it as the evidence field for the YAML output
- Explain: "Evidence files will be converted to searchable text and made available to all delegates. An evidence index with conversion provenance will be generated."

If "none", omit the evidence field from the YAML.
```

- [ ] **Step 2: Add new capabilities to Step 4 panel proposal**

In `commands/delphi-compose.md`, update the risk-to-delegate heuristic (around line 100). Add to the capabilities that can be assigned:

```markdown
**New capabilities (assign based on panel needs):**
- `research_authority` — Pre-deliberation research via Scout. Assign to domain specialists who need to verify legal precedent, technical standards, or regulatory requirements. Produces a shared appendix.
- `verify_sources` — Mid-deliberation factual verification via Scout + Read. Assign to auditor/reviewer roles responsible for evidence integrity. Records a verification log.

These capabilities are independent of `challenge_all` and `veto_invariant_violations`. A delegate can have multiple capabilities (e.g., a law specialist with both `challenge_all` and `research_authority`).
```

- [ ] **Step 3: Update YAML schema in Step 6**

In `commands/delphi-compose.md`, update the YAML schema (around line 211). Add after `tone:`:

```yaml
evidence: {path from Step 3, or omit if none}
```

- [ ] **Step 4: Commit**

```bash
git add commands/delphi-compose.md
git commit -m "feat: add evidence submission and new capabilities to /delphi-compose

Composition builder now asks about evidence directories, offers
research_authority and verify_sources capabilities in panel design,
and includes evidence field in generated YAML."
```

---

## Final: Update documentation

### Task 15: Update CLAUDE.md and README with new features

**Files:**
- Modify: `CLAUDE.md` (implementation status)
- Modify: `README.md` (feature docs)

- [ ] **Step 1: Update CLAUDE.md implementation status**

In `CLAUDE.md`, update the `## Implementation Status` section to add:

```markdown
- **Evidence pipeline**: evidence submission via `--evidence` flag or YAML `evidence:` field, PDF conversion (pdftotext + Tesseract), evidence index with provenance, SHA-256 hashing
- **Capabilities**: `research_authority` (pre-deliberation case law appendix with verified absences, recovery window on concession), `verify_sources` (mid-deliberation auditor verification with four-category coverage map)
- **Chair evidence access**: Chair reads evidence directory, case law appendix, and verification log during proposition framing and decision writing
```

- [ ] **Step 2: Update README with new features**

In `README.md`, add a new section after "## Tones" (around line 256) describing:

- Evidence submission (the `--evidence` flag and YAML field)
- The two new capabilities (research_authority and verify_sources)
- The verification coverage map
- Brief example of a composition YAML with evidence and new capabilities

- [ ] **Step 3: Update CLAUDE.md plugin architecture section**

Add to the `## Plugin Architecture` bullet list:

```markdown
- Evidence pipeline: conversion is engine setup (preprocessing), not a deliberation phase
- Capabilities: `frame_propositions` (Chair), `challenge_all` (adversarial), `veto_invariant_violations` (domain), `research_authority` (pre-deliberation + recovery), `verify_sources` (mid-deliberation)
- Verified absences are findings with provenance, never silently omitted
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document evidence pipeline, new capabilities, and verification coverage"
```

---

## Verification

### Task 16: End-to-end dry-run verification

- [ ] **Step 1: Create a test composition with all new features**

Create a temporary test composition that exercises:
- `evidence:` field pointing to a test directory
- A delegate with `research_authority` + `challenge_all`
- A delegate with `verify_sources` + `veto_invariant_violations`
- Two `challenge_all` delegates (the multi-challenger scenario that triggered this entire workstream)

- [ ] **Step 2: Run a dry-run to verify argument parsing**

```bash
# From user's project directory
/delphi --dry-run --config test-composition.yml --evidence ./test-evidence/
```

Verify the dry-run output shows:
- Evidence directory recognized
- All capabilities listed correctly for each delegate
- No parsing errors

- [ ] **Step 3: Run a full deliberation to verify the routing fix**

Execute the composition without `--dry-run`. Monitor for:
- Both adversarial delegates challenge each other (not just non-adversarial delegates)
- All challenged delegates produce response files (completeness check passes)
- Synthesis correctly identifies any contested points
- Evidence index is generated with provenance
- If research_authority delegate exists, case law appendix is produced

- [ ] **Step 4: Verify the docket output**

Check the docket directory contains:
- `evidence/INDEX.md` with file provenance
- `appendix/case-law.md` (if research_authority delegate exists)
- `verification-log.md` (if verify_sources delegate exists)
- `docket.json` with evidence, appendix, and verification metadata
- Response files for ALL challenged delegates (including adversarial delegates challenged by other adversarial delegates)

- [ ] **Step 5: Clean up test files**

Remove the temporary test composition and evidence directory.
