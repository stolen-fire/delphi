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

## Skill structure

This skill uses progressive disclosure. The engine core (this file) handles initialization and mode routing. Protocol-specific logic lives in separate files read on demand.

### Protocol files (read ONE per invocation)

- `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/lightweight.md` — 2-delegate sequential protocol
- `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/standard.md` — 3-5 delegate parallel protocol with Chair
- `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/code-review.md` — sequential code review with lint, Cartographer, Enforcer
- `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/forensic-verification.md` — triple-verifier consensus protocol

### Reference files (read as needed by protocol files)

- `references/categorization-rules.md` — ACTION marker parsing table (used during synthesis)
- `references/docket-schema.md` — JSON schema for docket.json (used during finalization)
- `references/response-instructions.md` — shared response template (used during response dispatch)
- `references/synthesis-rules.md` — core synthesis engine logic (used during synthesis)
- `references/standard-rules.md` — standard protocol rules: veto, anti-anchoring, research authority
- `references/code-review-rules.md` — code review rules: delegate contracts, lint, remediation priorities

---

## Phase 0: Initialization

When invoked, you receive either:
- An **inline question** (lightweight mode, no YAML)
- A **composition YAML path** + **input artifact paths** (configured mode)

### Step 0.1: Determine mode

- If you received an inline question with no `--config`: use the **hardcoded lightweight composition** defined in `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/lightweight.md` (see "Default composition" section). If a `--tone` flag was provided, load the tone file using the tone loading rules below. Read and follow the **Lightweight Protocol** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/lightweight.md`.
- If you received a `mode: code-review` signal (invoked from `/delphi-review`): if a `--tone` flag was provided, load the tone file. Read and follow the **Code Review Protocol** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/code-review.md`.
- If you received a `mode: forensic-verification` signal (invoked from `/delphi-audit`): read and follow the **Forensic Verification Protocol** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/forensic-verification.md`.
- If you received a `mode: assist` signal (invoked from `/delphi-assist`): if a `--tone` flag was provided, load the tone file. Read and follow the **Assist Protocol** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/assist.md`.
- If you received a `--config` path: read the YAML file, extract `mode:` field
  - If a `--tone` flag was provided, it overrides any `tone` field in the composition YAML
  - If `mode: lightweight` (or 2 delegates): load tone if set, read and follow the **Lightweight Protocol**
  - If `mode: code-review`: load tone if set, read and follow the **Code Review Protocol**
  - If `mode: standard` (or 3+ delegates): load tone if set, read and follow the **Standard Protocol** at `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/standard.md`

### Step 0.1b: Parse MCP configuration

If a composition YAML was provided, check for an `mcp:` field. If present, extract:
- `mcp.required` — boolean. If `true`, the engine must successfully load and call at least one MCP tool during Step 0.2c or halt.
- `mcp.server` — string. The MCP server name prefix used to resolve tool names (e.g., `antd` resolves `antd_info` to `mcp__antd__antd_info`).
- `mcp.tools` — list of tool short names available from this server.

If no `mcp:` field is present, skip MCP grounding entirely — no prefetch, no injection, no `[MCP GROUNDING BLOCK]` in dispatch prompts.

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

### Step 0.2c: MCP grounding prefetch

Skip this step if no `mcp:` field was parsed in Step 0.1b.

**1. Load MCP tools.** Use ToolSearch to load the deferred MCP tools declared in the composition. Resolve each tool name using the server prefix: `mcp__{server}__{tool_name}` (e.g., `antd_info` → `mcp__antd__antd_info`). Load all tools in a single ToolSearch call: `select:mcp__{server}__{tool1},mcp__{server}__{tool2},...`

If ToolSearch fails to resolve any tools:
- If `mcp.required` is `true`: halt with `"MCP server '{server}' is required but unavailable. Cannot proceed."`
- If `mcp.required` is `false`: output `  MCP: server '{server}' unavailable, proceeding without grounding` and skip the rest of this step.

**2. Extract components from code under review.** Read each file in the review target paths (for code-review mode: `review_target.paths`; for other modes: input artifact files). Extract component names from import statements. For JavaScript/TypeScript, parse named imports: `import { Button, Card, Table } from '{library}'`. Deduplicate the list.

**3. Call MCP tools for detected components.** For each detected component, call the MCP tools that provide component-level information. The engine decides which tools to call based on what's available:

- If `{server}_info` is available: call `{server}_info(component, detail=true)` for each component
- If `{server}_semantic` is available: call `{server}_semantic(component)` for each component
- If `{server}_token` is available: call `{server}_token()` once for global tokens, and `{server}_token(component)` for components that commonly need theme overrides

**4. Assemble grounding document.** Combine all MCP results into a single markdown document organized by component:

```
## MCP Component Reference

### {ComponentName}
**When to use:** {from info tool}
**Props:** {from info tool}
**Semantic keys (v6 styles/classNames):** {from semantic tool, if available}

[repeat for each component]

## Global Design Tokens
{from token tool, if available}

## Component Tokens: {ComponentName}
{from token(component) tool, if available}
```

Write this document to `{docket-path}/mcp-grounding.md`.

**5. Output progress.** `  MCP: {N} components grounded from {server} ({component list})`

### Step 0.3: Write proposition

- **Lightweight inline:** Write the user's question directly to `proposition.md` in the docket directory. Frame it as a decidable question — if the user's input is vague, sharpen it into a specific proposition.
- **YAML with input artifacts:** Read each input artifact file. Write `proposition.md` with the question and a summary of the input artifacts.

Store the full docket path in a variable — every subsequent file write uses this base path.

---

## Dispatch safety rule

After EVERY subagent dispatch: wait for completion, then verify the expected output file exists at its target path. If the file is missing, check the subagent's response text and write it to the correct path. Do not proceed to the next phase until all expected files from the current phase are confirmed.

## Tone loading

Determine the active tone: if a `--tone` flag was provided, use it (CLI overrides YAML). Otherwise, use the composition YAML's `tone` field if present.

If an active tone is set:

1. Read the tone slug (e.g., `snarky`)
2. Attempt to read `.claude/delphi/tones/{tone}.md` — if found, use it
3. Otherwise, attempt to read `${CLAUDE_PLUGIN_ROOT}/tones/{tone}.md` — if found, use it
4. If neither exists: output a warning (`Warning: tone '{tone}' not found, proceeding without tone`) and set tone content to empty — do not fail the deliberation
5. If found: extract the `## Voice directive` section content and the `## Examples` section content from the file body — these are the tone injection payloads used in all subsequent dispatch phases

If no tone is set (no `--tone` flag and no `tone` field in YAML), skip tone loading entirely. No tone will be injected into dispatch prompts.

## Tone injection pattern

When a tone is loaded, inject this block into every dispatch prompt (all phases, all protocols). When no tone is loaded, omit entirely — do not include empty headers.

```
## Tone
{tone voice directive content}

### Tone examples
{tone examples content}
```

All dispatch templates use the shorthand **[TONE BLOCK]** to indicate where this block goes.

## MCP grounding injection pattern

When MCP grounding was assembled in Step 0.2c, inject this block into every dispatch prompt (all phases, all protocols). When no MCP grounding exists (no `mcp:` field in composition, or server unavailable with `required: false`), omit entirely — do not include empty headers.

```
## Component Library Reference
{contents of {docket-path}/mcp-grounding.md}
```

All dispatch templates use the shorthand **[MCP GROUNDING BLOCK]** to indicate where this block goes. Place it after `[TONE BLOCK]` in every dispatch template.

---

## Protocol routing

After completing Phase 0 (initialization, docket creation, evidence preprocessing, MCP grounding prefetch, proposition, tone loading), read the appropriate protocol file and follow it from its first phase:

| Mode | Protocol file |
|------|--------------|
| `lightweight` | `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/lightweight.md` |
| `standard` | `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/standard.md` |
| `code-review` | `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/code-review.md` |
| `forensic-verification` | `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/forensic-verification.md` |
| `assist` | `${CLAUDE_PLUGIN_ROOT}/skills/delphi/protocols/assist.md` |

The protocol file contains all phase-by-phase dispatch instructions, templates, synthesis logic, and docket finalization for that mode. It will reference shared files in `references/` as needed — read those when the protocol instructs you to.
