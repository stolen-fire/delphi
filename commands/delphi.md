---
description: Structured multi-agent deliberation with adversarial review
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '"question" [--tone name] | --config path.yml --input file.md [--tone name] [--dry-run]'
---

# /delphi

Run a structured adversarial deliberation on a question or artifact.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation mode:

**Mode 1 — Inline lightweight (no YAML):**
If `$ARGUMENTS` is a quoted string or plain text without `--config`:
- The text IS the question to deliberate
- Use the hardcoded lightweight composition (2 delegates: proposer + critic)
- No input artifacts unless `--input` is also provided
- If `$ARGUMENTS` contains `--tone`, extract the tone name — this is passed to the engine for tone loading

**Mode 2 — YAML composition:**
If `$ARGUMENTS` contains `--config`:
- Extract the path after `--config` — this is the composition YAML file
- If `$ARGUMENTS` also contains `--input`, extract all paths after `--input` — these are input artifact files
- If `$ARGUMENTS` also contains `--tone`, extract the tone name — this overrides any `tone` field in the composition YAML
- Read the YAML to determine the mode (lightweight or standard)

**Mode 3 — Dry run:**
If `$ARGUMENTS` contains `--dry-run`:
- Parse as Mode 1 or Mode 2, but do NOT execute the deliberation
- Instead, display: the parsed proposition, the delegate roster (roles + capabilities), the rules, and the docket name that would be created
- Then stop

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:
```
/delphi — Structured multi-agent deliberation

Usage:
  /delphi "Should we use event sourcing or CRUD?"     Quick 2-delegate review
  /delphi --tone snarky "Should we use a monorepo?"   Quick review with tone
  /delphi --config comp.yml --input api.md            Custom composition
  /delphi --config comp.yml --input a.md b.md c.md    Multiple artifacts
  /delphi --config comp.yml --tone parliamentary      Override composition tone
  /delphi --dry-run --config comp.yml                 Preview without executing

Docket output: .deliberation/dockets/{timestamp}-{name}/
```

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **question:** the inline text or "deliberate on the provided input artifacts"
- **composition:** the parsed YAML (or null for inline — engine uses hardcoded defaults)
- **input_artifacts:** list of file paths from `--input` (or empty)
- **tone:** the tone name from `--tone` flag (or null — engine checks YAML `tone` field as fallback)
- **dry_run:** true/false

The engine skill handles everything from here — docket creation, subagent dispatch, synthesis, and output.
