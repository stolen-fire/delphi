# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code plugin for structured multi-agent deliberation with adversarial review. Pure Markdown/YAML — no build, test, or lint steps. Intended for public distribution via `/plugin install`.

## Implementation Status

- **Lightweight mode** (2 delegates, sequential): fully implemented and working
- **Standard mode** (3-5 delegates, parallel dispatch): fully implemented and working — engine at `skills/delphi/SKILL.md` line 27 delegates to the standard protocol reference at `skills/standard-deliberation/SKILL.md`

## Plugin Architecture

- `$CLAUDE_PLUGIN_ROOT` resolves all internal file references (templates, skill cross-refs)
- Synthesis (Phase 4) is engine logic, NOT a subagent — the engine parses action markers mechanically
- Action markers: `[ACTION: DEFEND]`, `[ACTION: CONCEDE]`, `[ACTION: DISSENT]`, `[ACTION: VETO]`, `[CITE: filename, section]` — case-insensitive, whitespace-flexible
- Templates use `{placeholder}` substitution
- Compositions (YAML) define delegate rosters, rules, and output config
- Grounding files referenced in compositions are relative to the USER's project, not the plugin
- Docket output (`.deliberation/dockets/`) is intended to be committed by users as deliberation records

## Conventions

- Commits: conventional format (`feat: Phase N — description`)
- Branch: `main` (remote: `stolen-fire/delphi`)
- Agent frontmatter: `model: inherit`, explicit `tools` list, `color` field
- Skill/command frontmatter: `name`, `description` required
