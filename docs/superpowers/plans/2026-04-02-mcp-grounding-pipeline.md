# MCP Grounding Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Delphi engine the ability to pre-fetch MCP component documentation and inject it as grounding text into delegate dispatch prompts, so delegates get authoritative API references without needing MCP tool access.

**Architecture:** Two-phase grounding. Phase A (Step 0.2c in SKILL.md) parses imports from code under review, calls MCP tools for detected components, assembles a grounding document. Phase B (Steps 1.3-1.4 in code-review.md) reads the Cartographer's replacement proposals after it runs, fetches MCP data for any recommended components not in the initial prefetch, and appends to the grounding document before the Advocate dispatches. A new `[MCP GROUNDING BLOCK]` shorthand — parallel to the existing `[TONE BLOCK]` — marks injection points in all dispatch templates.

**Tech Stack:** Markdown skill/protocol files (no runtime code). All changes are to the Delphi plugin's instruction files at `D:\Projects\delphi\`.

---

### Task 1: Add MCP loading and injection pattern to SKILL.md

**Files:**
- Modify: `skills/delphi/SKILL.md`

This task adds three things to the engine core: MCP field parsing in Step 0.1, the Phase A prefetch as new Step 0.2c, and the `[MCP GROUNDING BLOCK]` injection pattern definition (parallel to the existing tone injection pattern).

- [ ] **Step 1: Add MCP parsing to Step 0.1**

In `skills/delphi/SKILL.md`, after the existing mode determination bullets in Step 0.1 (after line 51), add a new paragraph:

```markdown
### Step 0.1b: Parse MCP configuration

If a composition YAML was provided, check for an `mcp:` field. If present, extract:
- `mcp.required` — boolean. If `true`, the engine must successfully load and call at least one MCP tool during Step 0.2c or halt.
- `mcp.server` — string. The MCP server name prefix used to resolve tool names (e.g., `antd` resolves `antd_info` to `mcp__antd__antd_info`).
- `mcp.tools` — list of tool short names available from this server.

If no `mcp:` field is present, skip MCP grounding entirely — no prefetch, no injection, no `[MCP GROUNDING BLOCK]` in dispatch prompts.
```

- [ ] **Step 2: Add Step 0.2c (MCP prefetch) after evidence preprocessing**

After the existing Step 0.2b section (evidence preprocessing, ending around line 134), add:

```markdown
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
```

- [ ] **Step 3: Add MCP grounding injection pattern**

After the existing "Tone injection pattern" section (after line 176), add a parallel section:

```markdown
## MCP grounding injection pattern

When MCP grounding was assembled in Step 0.2c, inject this block into every dispatch prompt (all phases, all protocols). When no MCP grounding exists (no `mcp:` field in composition, or server unavailable with `required: false`), omit entirely — do not include empty headers.

```
## Component Library Reference
{contents of {docket-path}/mcp-grounding.md}
```

All dispatch templates use the shorthand **[MCP GROUNDING BLOCK]** to indicate where this block goes. Place it after `[TONE BLOCK]` in every dispatch template.
```

- [ ] **Step 4: Update protocol routing paragraph**

In the "Protocol routing" section (around line 181), update the introductory text to include MCP:

Change:
```
After completing Phase 0 (initialization, docket creation, evidence preprocessing, proposition, tone loading), read the appropriate protocol file and follow it from its first phase:
```

To:
```
After completing Phase 0 (initialization, docket creation, evidence preprocessing, MCP grounding prefetch, proposition, tone loading), read the appropriate protocol file and follow it from its first phase:
```

- [ ] **Step 5: Verify and commit**

Read the full SKILL.md to verify the new sections are correctly placed: Step 0.1b after Step 0.1, Step 0.2c after Step 0.2b, MCP injection pattern after tone injection pattern. Verify no existing content was disrupted.

```bash
git add skills/delphi/SKILL.md
git commit -m "feat(delphi): add MCP grounding prefetch to engine core (Step 0.2c)

Adds MCP field parsing, Phase A deterministic prefetch, and
[MCP GROUNDING BLOCK] injection pattern parallel to [TONE BLOCK]."
```

---

### Task 2: Add Phase B verification fetch and [MCP GROUNDING BLOCK] to code-review protocol

**Files:**
- Modify: `skills/delphi/protocols/code-review.md`

This is the highest-impact file. It gets Phase B (Steps 1.3-1.4) and `[MCP GROUNDING BLOCK]` added to all 6 dispatch templates.

- [ ] **Step 1: Add Steps 1.3-1.4 after Cartographer dispatch**

After Step 1.2 ("Dispatch cartographer subagent", around line 231), before "Review Phase 2: Advocate position", insert:

```markdown
### Step 1.3: MCP verification fetch (engine logic)

Skip this step if no MCP grounding exists (no `mcp:` field in composition or MCP unavailable).

Read `{docket-path}/challenges/round-1-cartographer.md`. Extract every component name that appears in:
- Component replacements: the "Library equivalent" field
- Variant corrections: the "Should be" field
- Sub-component opportunities: the "Should be" field

### Step 1.4: Diff against Phase A grounding

Compare the Cartographer's recommended components against the components already covered in `{docket-path}/mcp-grounding.md`.

**No gaps:** Output `  MCP grounding: complete (no verification gaps)` and proceed.

**Gaps exist:** For each component the Cartographer recommends that is NOT in the grounding document, call the same MCP tools used in Phase A (Step 0.2c). Append the results to `{docket-path}/mcp-grounding.md` under a new section:

```
## Verification fetch — Cartographer recommendations

### {ComponentName}
**When to use:** {from info tool}
**Props:** {from info tool}
**Semantic keys:** {from semantic tool, if available}
```

Output: `  MCP grounding: {N} components added from Cartographer recommendations ({list})`

This is one follow-up fetch, not a loop. The Advocate and subsequent delegates receive the updated grounding. The Cartographer itself does not — it already ran.
```

- [ ] **Step 2: Add [MCP GROUNDING BLOCK] to Cartographer dispatch template**

In the Cartographer dispatch prompt (around line 195), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 3: Add [MCP GROUNDING BLOCK] to Advocate position dispatch template**

In the Advocate dispatch prompt (around line 257), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 4: Add [MCP GROUNDING BLOCK] to Critic dispatch template**

In the Critic dispatch prompt (around line 318), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 5: Add [MCP GROUNDING BLOCK] to Maintainer dispatch template**

In the Maintainer dispatch prompt (around line 381), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 6: Add [MCP GROUNDING BLOCK] to Enforcer dispatch template**

In the Enforcer dispatch prompt (around line 450), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 7: Add [MCP GROUNDING BLOCK] to Advocate response dispatch template**

In the Advocate response dispatch prompt (around line 517), add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]`:

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 8: Verify and commit**

Read the full code-review.md. Verify: Steps 1.3-1.4 are between Step 1.2 and Review Phase 2. All 6 dispatch templates have `[MCP GROUNDING BLOCK]` after `[TONE BLOCK]`. No existing content disrupted.

```bash
git add skills/delphi/protocols/code-review.md
git commit -m "feat(delphi): add Phase B verification fetch and MCP grounding to code-review protocol

Adds Steps 1.3-1.4 for Cartographer recommendation verification.
Adds [MCP GROUNDING BLOCK] to all 6 dispatch templates."
```

---

### Task 3: Add [MCP GROUNDING BLOCK] to remaining protocols

**Files:**
- Modify: `skills/delphi/protocols/standard.md`
- Modify: `skills/delphi/protocols/lightweight.md`
- Modify: `skills/delphi/protocols/forensic-verification.md`

These protocols get Phase A grounding only (no Phase B — they don't have a Cartographer). The change is mechanical: add `[MCP GROUNDING BLOCK]` after every `[TONE BLOCK]`.

- [ ] **Step 1: Add to standard.md**

In `skills/delphi/protocols/standard.md`, add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]` at each of the 6 locations (lines 82, 124, 216, 269, 399, 551):

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 2: Add to lightweight.md**

In `skills/delphi/protocols/lightweight.md`, add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]` at each of the 3 locations (lines 62, 106, 152):

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 3: Add to forensic-verification.md**

In `skills/delphi/protocols/forensic-verification.md`, add `[MCP GROUNDING BLOCK]` on the line after `[TONE BLOCK]` at the 1 location (line 157):

```
[TONE BLOCK]

[MCP GROUNDING BLOCK]
```

- [ ] **Step 4: Verify and commit**

Grep all protocol files for `[TONE BLOCK]` and `[MCP GROUNDING BLOCK]` to confirm counts match: 16 of each across 4 files.

```bash
git add skills/delphi/protocols/standard.md skills/delphi/protocols/lightweight.md skills/delphi/protocols/forensic-verification.md
git commit -m "feat(delphi): add [MCP GROUNDING BLOCK] to standard, lightweight, and forensic-verification protocols"
```

---

### Task 4: Document MCP grounding rules in code-review-rules.md

**Files:**
- Modify: `skills/delphi/references/code-review-rules.md`

- [ ] **Step 1: Add MCP grounding rules section**

At the end of `skills/delphi/references/code-review-rules.md` (after the "Composition override" section), add:

```markdown
## MCP grounding rules

### Phase A: Deterministic prefetch

The engine parses the composition YAML `mcp:` field during initialization. If present, it loads MCP tools via ToolSearch, extracts component names from the code under review's import statements, and calls MCP tools for each detected component. Results are assembled into `{docket-path}/mcp-grounding.md` and injected into all dispatch prompts via `[MCP GROUNDING BLOCK]`.

**Required gate:** If `mcp.required` is `true` and the MCP server is unavailable, the engine halts. If `false` or omitted, the engine warns and proceeds without grounding.

**Token budget:** Bounded by what the code imports. The engine does not fetch the full component catalog — only components detected in import statements.

### Phase B: Verification fetch (code-review mode only)

After the Cartographer dispatches, the engine reads the Cartographer's replacement proposals and identifies components recommended that were not in the Phase A prefetch. These are components the code *should* use but doesn't import — the Cartographer's highest-value findings.

The engine fetches MCP data for these components and appends to `mcp-grounding.md`. This is a verification pipeline: the Cartographer asserts from training knowledge, the engine fetches authoritative documentation so the Advocate can evaluate the claim against real specs.

**Bounded scope:** One follow-up fetch, not a loop. If the Advocate discovers further components during response, those are flagged as "unverified claim" in synthesis rather than triggering another fetch.

### Delegate contract

Delegates never call MCP tools. They receive grounding as text in their dispatch prompts. Agent tool lists remain `[Read, Write]`. The engine owns all MCP interaction. This keeps agents framework-agnostic — the same Cartographer works for antd, Blazor, Material UI, or any library the composition configures.
```

- [ ] **Step 2: Commit**

```bash
git add skills/delphi/references/code-review-rules.md
git commit -m "docs(delphi): add MCP grounding rules to code-review reference"
```

---

### Task 5: Add mcp_grounding field to docket.json schema

**Files:**
- Modify: `skills/delphi/references/docket-schema.md`

- [ ] **Step 1: Add mcp_grounding field to code review docket schema**

In `skills/delphi/references/docket-schema.md`, in the "Code review docket.json schema" section (after the `"lint"` block, around line 123), add:

```json
  "mcp_grounding": {
    "server": "{MCP server name}",
    "required": "{true | false}",
    "available": "{true | false}",
    "phase_a_components": ["{list of components grounded from imports}"],
    "phase_b_components": ["{list of components added from Cartographer recommendations}"],
    "tools_called": ["{list of MCP tool names actually invoked}"]
  },
```

- [ ] **Step 2: Add omission rule**

After the existing omission rules at the bottom of the code review schema section, add:

```markdown
Omit the `mcp_grounding` block if no `mcp:` field was present in the composition YAML. If MCP was configured but unavailable (`available: false`), include the block to record that the grounding was attempted but failed.
```

- [ ] **Step 3: Add mcp_grounding field to standard/lightweight docket schema**

In the standard/lightweight schema section (the first schema block), add the same `mcp_grounding` field after the `"evidence"` block (around line 26), but without the `phase_b_components` field (no Cartographer in those modes):

```json
  "mcp_grounding": {
    "server": "{MCP server name}",
    "required": "{true | false}",
    "available": "{true | false}",
    "components": ["{list of components grounded from imports}"],
    "tools_called": ["{list of MCP tool names actually invoked}"]
  },
```

- [ ] **Step 4: Commit**

```bash
git add skills/delphi/references/docket-schema.md
git commit -m "docs(delphi): add mcp_grounding field to docket.json schemas"
```

---

### Task 6: Smoke test with antd-design-review composition

**Files:**
- No files modified — this is a verification task using the Playground project.

- [ ] **Step 1: Run a code review with MCP grounding**

From `D:\Projects\Playground`, invoke:

```
/delphi-review src/components/Dashboard.tsx --config compositions/antd-design-review.yml --conventions .docs/antd-v6-conventions.md
```

- [ ] **Step 2: Verify Phase A executed**

Check that the docket contains `mcp-grounding.md`:
```bash
cat .deliberation/dockets/{latest-docket}/mcp-grounding.md | head -30
```

Expected: Component reference sections for components imported in Dashboard.tsx (Button, Card, Table, Space, Tag, Modal, Form, Select, ConfigProvider, DatePicker, Typography, Progress, Flex, Row, Col, Layout, Statistic, Skeleton).

- [ ] **Step 3: Verify Phase B executed (if Cartographer found gaps)**

Check docket.json for `mcp_grounding.phase_b_components`:
```bash
cat .deliberation/dockets/{latest-docket}/docket.json | grep -A 5 mcp_grounding
```

Expected: If the Cartographer recommended components not imported in the code, they appear in `phase_b_components`.

- [ ] **Step 4: Verify delegates received grounding**

Read any delegate's dispatch prompt (visible in the Advocate position or challenge files) and confirm it references component API details that could only come from MCP, not training knowledge — specific prop names, semantic key maps, token values.

- [ ] **Step 5: Verify required gate works**

Temporarily rename the antd MCP server config to make it unavailable. Run the same review command. Expected: engine halts with `"MCP server 'antd' is required but unavailable. Cannot proceed."`

Restore the config after testing.

- [ ] **Step 6: Commit test results**

No code to commit — this is a manual verification. Record pass/fail in the docket or a test log.
