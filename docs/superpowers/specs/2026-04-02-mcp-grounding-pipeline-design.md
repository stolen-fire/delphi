# MCP Grounding Pipeline Design

**Date:** 2026-04-02
**Context:** Delphi plugin code review protocol
**Problem:** Compositions can declare `mcp: required: true` with MCP tools, but the engine has no mechanism to load, call, or route MCP data to delegate subagents. Delegates have `[Read, Write]` tool lists and cannot access deferred MCP tools.

---

## The problem

The Delphi code-review protocol dispatches delegates as subagents. MCP tools (antd_info, antd_semantic, antd_token, etc.) are deferred tools that require ToolSearch to load their schemas before they're callable. Subagents start fresh — tools available in the engine's context don't propagate.

The antd-design-review composition specifies `mcp: required: true` with 7 tools and includes verification protocols in every delegate's prompt. But delegates can't call the tools, so they fall back to training knowledge and report "MCP unavailable." The engine proceeds anyway.

This defeats the MCP verification protocol and weakens the Cartographer's ability to ground component selection recommendations in authoritative API documentation — precisely the gap identified in the Steinle Component Selection Pipeline Brief.

## Design principle: furniture, not doors

Delegates need *knowledge* from MCP, not *access* to MCP. The engine pre-fetches component reference material and embeds it as grounding text in dispatch prompts. Delegates arrive at work and find the reference manuals open on the desk. They never need to open a door to another room.

This keeps agents framework-agnostic (no ToolSearch in tool lists), makes token budgets predictable (engine controls fetch volume), and matches how experts work (reviewers receive specs beforehand, not mid-review).

## Architecture: two-phase MCP grounding

### Phase A — Deterministic prefetch (preprocessing, before any delegate dispatch)

The engine parses imports from the code under review, calls MCP tools for every detected component, and assembles a grounding document. Happens at new Step 0.2c in SKILL.md.

### Phase B — Verification fetch (engine logic, between Cartographer and Advocate)

After the Cartographer runs, the engine reads its replacement proposals, identifies components the Cartographer recommends that weren't in the initial prefetch (components the code *should* use but doesn't import), fetches MCP data for those, and appends to the grounding document. The Cartographer flags what it *thinks*. The engine fetches what it *needs to prove*.

---

## Composition YAML schema

```yaml
mcp:
  required: true        # true = halt if MCP unavailable; false/omitted = optional
  server: antd          # MCP server name prefix for tool resolution
  tools:                # Available MCP tools (engine decides which to call)
    - antd_info
    - antd_semantic
    - antd_token
    - antd_doc
    - antd_demo
    - antd_list
    - antd_changelog
```

Three fields:
- **`required`** — `true`: engine must successfully call at least one MCP tool during Phase A or halt. `false`/omitted: warn and proceed without grounding.
- **`server`** — MCP server name prefix. Engine resolves tool names (e.g., `antd_info` -> `mcp__antd__antd_info`).
- **`tools`** — Which MCP tools are available. Engine decides which to call based on what it discovers in the code.

The composition doesn't declare *which components* to fetch (that's the engine's job) or *which delegates* get the grounding (everyone gets it).

---

## Phase A: Deterministic prefetch — Step 0.2c

Added to SKILL.md after Step 0.2b (evidence preprocessing), before Step 0.3 (proposition).

### Step 0.2c-1: Extract components from code under review

The engine reads each file in `review_target.paths` and extracts component names from import statements. For antd: parse `import { Button, Card, Table } from 'antd'` and `import { ArrowUpOutlined } from '@ant-design/icons'`.

Output: deduplicated list of component names.

Implementation option: a preprocessing script via `!`command`` syntax in the proposition template for the import extraction step. E.g., `!`${CLAUDE_SKILL_DIR}/scripts/prefetch-mcp.sh ${TARGET_FILES}``

### Step 0.2c-2: Call MCP tools for each detected component

The engine (main conversation context, not a subagent) uses ToolSearch to load the deferred MCP tools declared in the composition, then calls them directly. This works because the engine has ToolSearch access — the entire point of this design is that delegates do not need it.

- `antd_info(component, detail=true)` for each component — props, types, whenToUse
- `antd_semantic(component)` for each component — v6 styles/classNames keys
- `antd_token()` once — global design tokens
- `antd_token(component)` for components that commonly need ConfigProvider overrides (Layout, Table, Modal, Typography, etc.)

### Step 0.2c-3: Assemble grounding document

Results are assembled into a single markdown document:

```markdown
## MCP Component Reference

### Button
**When to use:** {from antd_info}
**Props:** {from antd_info}
**Semantic keys (v6 styles/classNames):** {from antd_semantic}

### Card
...

### Global Design Tokens
{from antd_token()}

### Component Tokens: Layout
{from antd_token(Layout)}
```

Written to `{docket-path}/mcp-grounding.md` for docket reproducibility.

### The `required: true` gate

If ToolSearch fails to resolve any MCP tools and `required` is `true`, the engine halts:
`"MCP server '{server}' is required but unavailable. Cannot proceed."`

If `required` is `false`, warn and proceed without grounding.

### Token budget

Bounded by what the code imports. `antd_info(detail=true)` is called only for components actually detected — not the full `antd_list()` catalog.

---

## Phase B: Verification fetch — new Steps 1.3-1.4 in code-review protocol

Inserted between Cartographer dispatch (Step 1.2) and Advocate dispatch (Step 2.1).

### Step 1.3: Extract Cartographer recommendations

The engine reads `{docket-path}/challenges/round-1-cartographer.md` and extracts every component name from:
- Component replacements: the "Library equivalent" field
- Variant corrections: the "Should be" field
- Sub-component opportunities: the "Should be" field

### Step 1.4: Diff against Phase A grounding

Compare recommended components against components already in `mcp-grounding.md`.

**No gaps:** Proceed. Output: `  MCP grounding: complete (no verification gaps)`

**Gaps exist:** Call the same MCP tools for missing components, append results to `mcp-grounding.md`. Output: `  MCP grounding: {N} components added from Cartographer recommendations ({list})`

### Routing

- The Advocate is the primary consumer — needs full reference to evaluate DEFEND/CONCEDE for each Cartographer challenge.
- All delegates get `[MCP GROUNDING BLOCK]` (injected into every dispatch, same as `[TONE BLOCK]`).
- The Cartographer itself does NOT get Phase B grounding (it already ran). Its recommendations were made from training knowledge + Phase A grounding. Phase B proves or disproves those recommendations via the Advocate's evaluation.

### Bounded scope

One follow-up fetch, not a loop. Cartographer recommends; engine verifies once. If the Advocate discovers further components during response, those don't trigger another fetch — they become "unverified claim" findings in synthesis.

---

## Injection pattern: [MCP GROUNDING BLOCK]

Follows the same convention as `[TONE BLOCK]`:

- When MCP grounding exists, inject the full contents of `mcp-grounding.md` under a `## Component Library Reference` header in every dispatch prompt.
- When no MCP grounding exists (no `mcp:` field in composition, or `required: false` and unavailable), omit entirely — do not include empty headers.
- All dispatch templates use the shorthand **[MCP GROUNDING BLOCK]** to indicate where this block goes.

---

## Files to modify

| File | Change |
|------|--------|
| `skills/delphi/SKILL.md` | Add Step 0.2c (MCP prefetch). Add `[MCP GROUNDING BLOCK]` injection pattern section (parallel to tone injection). Add MCP field parsing in Step 0.1. |
| `skills/delphi/protocols/code-review.md` | Add Steps 1.3-1.4 (verification fetch). Add `[MCP GROUNDING BLOCK]` to all 6 dispatch prompt templates. |
| `skills/delphi/protocols/standard.md` | Add `[MCP GROUNDING BLOCK]` to all dispatch prompt templates. |
| `skills/delphi/protocols/lightweight.md` | Add `[MCP GROUNDING BLOCK]` to all dispatch prompt templates. |
| `skills/delphi/protocols/forensic-verification.md` | Add `[MCP GROUNDING BLOCK]` to verifier dispatch templates. |
| `skills/delphi/references/code-review-rules.md` | Document MCP grounding rules: Phase A/B behavior, verification fetch contract, `required` gate. |
| `skills/delphi/references/docket-schema.md` | Add `mcp_grounding` field to docket.json schema (files fetched, components covered, gaps filled). |

## Files NOT modified

| File | Why |
|------|-----|
| Agent definitions (`agents/*.md`) | Tool lists stay `[Read, Write]`. Agents remain framework-agnostic. MCP knowledge arrives as grounding text, not tool access. |
| Composition YAML schema | `mcp:` field already exists in `antd-design-review.yml`. Just needs engine-side parsing. |

---

## What this does NOT solve

- **Variant depth at analysis time.** The Cartographer still relies on training knowledge + grounding to judge variants. If `antd_info(Button, detail=true)` doesn't include "When to use" guidance for `type="text"` vs `type="link"`, the Cartographer can't distinguish them. Grounding quality depends on MCP tool output quality.
- **Unexpected components outside the Cartographer's knowledge.** If the Cartographer doesn't know a component exists, it can't recommend it, and Phase B can't verify it. This is a model capability limit, not an architecture limit.
- **Non-code-review protocols.** Phase B (verification fetch) is specific to code-review mode. Standard and lightweight modes get Phase A grounding only. This is sufficient — those modes don't have a Cartographer.
