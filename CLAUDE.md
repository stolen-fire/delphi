# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code plugin for structured multi-agent deliberation with adversarial review. Pure Markdown/YAML — no build, test, or lint steps. Intended for public distribution via `/plugin install`.

## Implementation Status

- **Lightweight mode** (2 delegates, sequential): fully implemented and working
- **Standard mode** (3-5 delegates, parallel dispatch): fully implemented and working — engine at `skills/delphi/SKILL.md` line 27 delegates to the standard protocol reference at `skills/standard-deliberation/SKILL.md`
- **Code review mode** (3+1 delegates, sequential): fully implemented — `/delphi-review` command, Advocate/Critic/Maintainer delegates, conditional Enforcer, remediation plan output
- **Tone system**: 5 built-in tones (snarky, diplomatic, adversarial, socratic, parliamentary), user-extensible via `.claude/delphi/tones/`
- **Observatory** (`/delphi-observe`): browser-based viewer for deliberation dockets — issue-threaded layout with AI commentary, supports live and post-hoc modes via visualizer MCP
- **Evidence pipeline**: evidence submission via `--evidence` flag or YAML `evidence:` field, PDF conversion (pdftotext + Tesseract), evidence index with provenance, SHA-256 hashing
- **Capabilities**: `research_authority` (pre-deliberation case law appendix with verified absences, recovery window on concession), `verify_sources` (mid-deliberation auditor verification with four-category coverage map)
- **Chair evidence access**: Chair reads evidence directory, case law appendix, and verification log during proposition framing and decision writing

## Plugin Architecture

- `$CLAUDE_PLUGIN_ROOT` resolves all internal file references (templates, skill cross-refs)
- Synthesis (Phase 4) is engine logic, NOT a subagent — the engine parses action markers mechanically
- Action markers: `[ACTION: DEFEND]`, `[ACTION: CONCEDE]`, `[ACTION: DISSENT]`, `[ACTION: VETO]`, `[CITE: filename, section]` — case-insensitive, whitespace-flexible
- Templates use `{placeholder}` substitution
- Compositions (YAML) define delegate rosters, rules, and output config
- Grounding files referenced in compositions are relative to the USER's project, not the plugin
- Docket output (`.deliberation/dockets/`) is intended to be committed by users as deliberation records
- Evidence pipeline: conversion is engine setup (preprocessing), not a deliberation phase
- Capabilities: `frame_propositions` (Chair), `challenge_all` (adversarial), `veto_invariant_violations` (domain), `research_authority` (pre-deliberation + recovery), `verify_sources` (mid-deliberation)
- Verified absences are findings with provenance, never silently omitted
- Agent `role_type` taxonomy: `participant` (position+response), `challenger` (challenge output), `auditor` (independent report), `facilitator` (procedural only)
- Code review delegates: advocate (participant, green), critic (challenger, red, reused), maintainer (challenger, yellow), enforcer (auditor, magenta, conditional)
- Remediation plan: engine-generated actionable output from synthesis + compliance findings, prioritized as critical/recommended/optional

## Conventions

- Commits: conventional format (`feat: Phase N — description`)
- Branch: `main` (remote: `stolen-fire/delphi`)
- Agent frontmatter: `model: inherit`, explicit `tools` list, `color` field
- Skill/command frontmatter: `name`, `description` required
- Agent frontmatter: `role_type` required (participant, challenger, auditor, facilitator)
