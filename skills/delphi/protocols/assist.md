# Assist Protocol

Use this protocol when mode is assist (invoked from `/delphi-assist` command). Single-delegate dispatch — Cartographer in recommendation mode only. No adversarial cycle.

## Purpose

The assist protocol runs the Cartographer as a selection validator during component mapping (Step 5 of an interaction design pipeline). It evaluates draft component specifications against the live component library via MCP and produces recommendations — not findings, not challenges.

This is **prevention** (helping the mapper select the right component before build) rather than **detection** (catching the wrong component after build). The full adversarial review at Step 8 handles detection.

## Shared references

- **Docket schema**: `${CLAUDE_PLUGIN_ROOT}/skills/delphi/references/docket-schema.md` — read during Phase 3 (docket finalization), use the standard/lightweight schema with `mode: "assist"`

---

## Phase 0: Initialization

Reuse the engine's Phase 0 from `SKILL.md`:
- Step 0.1: Determine mode → `assist`
- Step 0.2: Create docket directory with structure:
  ```
  .deliberation/dockets/{docket-name}/
    recommendations/
  ```
- Step 0.2c: MCP grounding prefetch (if `mcp:` field present — CRITICAL for assist mode, this is the whole point)
- Step 0.3: Write proposition — frame as: "Evaluate the following component specification against the Ant Design component library. For each component selection, assess whether it is the best fit for the described context."
- Step 0.6: Tone loading (if provided)

---

## Phase 1: Cartographer recommendation dispatch

Output progress: `Assist: {slug}`
Output progress: `  Cartographer evaluation...`

### Step 1.1: Assemble dispatch package

Read the Recommendation Map template from `${CLAUDE_PLUGIN_ROOT}/templates/recommendation-map.md`.

Assemble the Cartographer's dispatch prompt:

```
You are the Cartographer in ASSIST mode. You are helping a component mapper
evaluate their draft specification — not reviewing built code.

Your question is different from code review:
- In code review, you ask: "What is this code trying to do, and does the
  library already do that?"
- In assist mode, you ask: "Is this specification selecting the best
  component and variant for the described context?"

{if composition provides custom cartographer prompt:}
{composition cartographer prompt}
{/if}

[TONE BLOCK]

[MCP GROUNDING BLOCK]

## Component specification to evaluate
{contents of proposition.md — contains the draft component spec}

{if grounding file provided:}
## Component library reference
{contents of grounding file}
{/if}

{if conventions provided:}
## Conventions
{contents of conventions file}
{/if}

## Your task
Read the component specification. For each primary component selection:

1. Query the MCP server to verify the component exists and has the
   claimed props, variants, and sub-components.
2. Evaluate whether the selected variant/type is the best fit for the
   described context (CDL treatment, data fields, adjacent components,
   interaction pattern).
3. Check whether a different component or variant would be a better fit.
4. Verify sub-component/composition API usage against the actual API.

For components where the spec is correct: confirm it with evidence.
For components where you recommend a change: explain why with MCP evidence.

## Output format
Follow this template exactly:
{contents of Recommendation Map template}

## CRITICAL: Write your output to this exact file path
Write your complete recommendation report to: {docket-path}/recommendations/cartographer.md

Do not write to any other path. Do not output anything else.
```

### Step 1.2: Dispatch cartographer subagent

Dispatch a subagent with the assembled prompt. Use the `deliberation-cartographer` agent definition.

Output progress: `  Cartographer evaluation... done`

---

## Phase 2: Present results

**No adversarial cycle.** No Advocate, no Critic, no Maintainer, no synthesis. The Cartographer's recommendations are the output.

### Step 2.1: Read recommendations

Read `{docket-path}/recommendations/cartographer.md`.

### Step 2.2: Write docket.json

Write `{docket-path}/docket.json`:

```json
{
  "id": "{docket-name}",
  "created": "{ISO 8601 timestamp}",
  "mode": "assist",
  "tone": "{tone name, or omit if none}",
  "input_artifacts": ["{component spec path}"],
  "delegates": [
    {
      "role": "cartographer",
      "prompt_register": "component library cartographer in recommendation mode",
      "grounding": "{grounding path or null}",
      "capabilities": []
    }
  ],
  "recommendations": {
    "components_evaluated": "{N}",
    "confirmed": "{count where spec matches recommendation}",
    "differs": "{count where recommendation differs from spec}",
    "confidence_high": "{count}",
    "confidence_medium": "{count}",
    "confidence_low": "{count}"
  }
}
```

### Step 2.3: Present to user

Output the contents of `recommendations/cartographer.md` directly. The user (or the invoking skill) decides whether to accept the recommendations.

Output progress: `  Docket: .deliberation/dockets/{docket-name}/`
