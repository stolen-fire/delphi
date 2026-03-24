---
description: Structured multi-agent deliberation with adversarial review
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '"question" | --config path.yml --input file.md [--dry-run]'
---

# /deliberate

Run a structured adversarial deliberation on a question or artifact.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation mode:

**Mode 1 — Inline lightweight (no YAML):**
If `$ARGUMENTS` is a quoted string or plain text without `--config`:
- The text IS the question to deliberate
- Use the hardcoded lightweight composition (2 delegates: proposer + critic)
- No input artifacts unless `--input` is also provided

**Mode 2 — YAML composition:**
If `$ARGUMENTS` contains `--config`:
- Extract the path after `--config` — this is the composition YAML file
- If `$ARGUMENTS` also contains `--input`, extract all paths after `--input` — these are input artifact files
- Read the YAML to determine the mode (lightweight or standard)

**Mode 3 — Dry run:**
If `$ARGUMENTS` contains `--dry-run`:
- Parse as Mode 1 or Mode 2, but do NOT execute the deliberation
- Instead, display: the parsed proposition, the delegate roster (roles + capabilities), the rules, and the docket name that would be created
- Then stop

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:
```
/deliberate — Structured multi-agent deliberation

Usage:
  /deliberate "Should we use event sourcing or CRUD?"     Quick 2-delegate review
  /deliberate --config comp.yml --input api.md            Custom composition
  /deliberate --config comp.yml --input a.md b.md c.md    Multiple artifacts
  /deliberate --dry-run --config comp.yml                 Preview without executing

Docket output: .deliberation/dockets/{timestamp}-{name}/
```

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/deliberate/SKILL.md`.

Pass to the engine:
- **question:** the inline text or "deliberate on the provided input artifacts"
- **composition:** the parsed YAML (or null for inline — engine uses hardcoded defaults)
- **input_artifacts:** list of file paths from `--input` (or empty)
- **dry_run:** true/false

The engine skill handles everything from here — docket creation, subagent dispatch, synthesis, and output.
