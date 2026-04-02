---
description: Adversarial code review with remediation plan output
allowed-tools: Agent, Read, Write, Bash, Glob, Grep
argument-hint: '<files|glob> [--diff [ref]] [--conventions path] [--config path.yml] [--tone name] [--skip-lint] [--upstream-report path]'
---

# /delphi-review

Run an adversarial code review on source files or a git diff.

## Parse arguments

Examine `$ARGUMENTS` to determine the invocation mode:

**File review (default):**
If `$ARGUMENTS` contains file paths or glob patterns (anything not prefixed with `--`):
- Resolve each path/glob using the Glob tool
- If a glob matches zero files, warn and skip it
- Collect all resolved file paths as the review target
- If `$ARGUMENTS` also contains `--conventions`, extract the path — this activates the Enforcer delegate
- If `$ARGUMENTS` also contains `--config`, extract the path — this overrides the default delegate roster with a composition YAML
- If `$ARGUMENTS` also contains `--tone`, extract the tone name
- If `$ARGUMENTS` also contains `--skip-lint`, set `skip_lint = true` — this disables the lint pre-phase entirely (for use when an upstream pipeline has already run linting)
- If `$ARGUMENTS` also contains `--upstream-report`, extract the path — this is a report from an upstream agent (e.g., component-structure) to inject as additional context for the Cartographer and Advocate

**Diff review:**
If `$ARGUMENTS` contains `--diff`:
- If a git ref follows `--diff` (e.g., `--diff HEAD~3`), run `git diff {ref}` to capture the diff
- If no ref follows, run `git diff --staged` to capture staged changes
- If the diff is empty, warn and exit: "No changes found. Stage changes with `git add` or provide a ref."
- The review artifact is: the raw diff output + full content of each changed file (read via Read tool)
- Other flags (`--conventions`, `--config`, `--tone`, `--skip-lint`, `--upstream-report`) work the same as file review

**No arguments:**
If `$ARGUMENTS` is empty, display usage help:

```
/delphi-review — Adversarial code review

Usage:
  /delphi-review src/Foo.tsx                               Single file review
  /delphi-review src/components/*.tsx                      Glob review
  /delphi-review --diff                                    Review staged changes
  /delphi-review --diff HEAD~3                             Review diff against ref
  /delphi-review --conventions RULES.md src/*.tsx           With convention enforcement
  /delphi-review --config review.yml src/*.tsx              Custom composition
  /delphi-review --tone snarky src/Foo.tsx                  With tone
  /delphi-review --skip-lint src/*.tsx                     Skip lint pre-phase
  /delphi-review --upstream-report report.md src/*.tsx     Inject upstream agent report

Docket output: .deliberation/dockets/{timestamp}-review-{slug}/
Remediation plan: .deliberation/dockets/.../remediation/plan.md
```

## Assemble review context

Read all target files (or diff output + changed files) and assemble into a single review artifact:

For file review, structure as:

````
## Code under review

### File: {relative path}
```{language}
{file contents}
```

### File: {next relative path}
...
````

For diff mode, also include:

````
## Diff
```diff
{raw git diff output}
```
````

If `--conventions` was provided, read the conventions file and store its contents for delegate dispatch.

## Execute

Read and follow the deliberation engine skill at `@${CLAUDE_PLUGIN_ROOT}/skills/delphi/SKILL.md`.

Pass to the engine:
- **mode:** `code-review`
- **review_artifact:** the assembled code/diff content
- **review_files:** list of resolved file paths (for docket snapshot)
- **review_type:** `files` or `diff`
- **diff_ref:** the git ref if `--diff` was used (or `staged`)
- **conventions:** the conventions file path and contents (or null)
- **composition:** the parsed YAML (or null — engine uses hardcoded defaults)
- **tone:** the tone name (or null)
- **skip_lint:** true if `--skip-lint` was provided or if composition YAML sets `skip_lint: true` (CLI flag overrides YAML)
- **upstream_report:** file path and contents from `--upstream-report` (or null)

The engine skill handles everything from here — docket creation, code snapshot, delegate dispatch, synthesis, remediation plan, and output.
