---
description: MCP-grounded component selection validation for draft specifications
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '<component-spec> [--conventions path] [--config path.yml] [--tone name]'
---

# /delphi-assist

Evaluate a draft component specification against the live component library. Runs the Cartographer in recommendation mode — no adversarial review, no remediation. Use during component mapping (Step 5) to ground selections in MCP evidence before the build starts.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation:

**Component spec (required):**
The first non-flag argument is the path to the draft component specification file (e.g., `patterns/member-summary-components.md`).

- If the path does not exist, error: "Component spec not found at {path}."
- Read the file — this is the specification the Cartographer will evaluate.

**Optional flags:**
- `--conventions path` — design system standards file for context
- `--config path.yml` — composition YAML override (must have `mode: assist` or be overridden)
- `--tone name` — voice/style override

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:

```
/delphi-assist — Component selection validation

Usage:
  /delphi-assist patterns/member-summary-components.md
  /delphi-assist patterns/dashboard-components.md --conventions STANDARDS.md
  /delphi-assist patterns/table-components.md --tone diplomatic

Runs the Cartographer in recommendation mode against the draft component
specification. Verifies each selection against the live Ant Design MCP
server. No adversarial review — recommendations only.

Docket output: .deliberation/dockets/{timestamp}-assist-{slug}/
```

## Assemble assist context

Read the component specification file and assemble into a review artifact:

````
## Component specification to evaluate

### File: {relative path}
```markdown
{file contents}
```
````

If `--conventions` was provided, read the conventions file and store its contents for dispatch.

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **mode:** `assist`
- **review_artifact:** the assembled component specification content
- **input_artifacts:** list containing the component spec path
- **conventions:** the conventions file path and contents (or null)
- **composition:** the parsed YAML (or null — engine uses hardcoded defaults for assist mode)
- **tone:** the tone name (or null)

The engine skill handles everything from here — docket creation, MCP grounding, Cartographer dispatch, and output.
