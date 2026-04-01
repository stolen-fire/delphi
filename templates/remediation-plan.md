# Remediation Plan

**Generated from review of:** {file paths or "git diff"}
**Docket:** {docket-name}
**Date:** {ISO 8601 timestamp}

---

## Lint findings

{If lint ran:}

| # | File | Line | Rule | Severity | Message |
|---|------|------|------|----------|---------|
| {N} | {filename} | {line} | {rule} | {error|warning} | {message} |

Total: {N} errors, {M} warnings

{If no lint: omit this section entirely}

## Critical (must fix)

Items from contested points (Advocate couldn't defend), conceded challenges, lint errors, or Enforcer failures.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {what's wrong — traced to specific delegate and challenge}
- **Action:** {exactly what to change — specific enough for CC to execute without interpretation}
- **Rationale:** {why — linked to synthesis point ID or compliance finding}
- **Source:** {Critic challenge | Maintainer challenge | Cartographer challenge | Enforcer failure | Lint error | Contested — no defense}

## Component replacements (Cartographer)

{If Cartographer ran and found replacements:}

### {N}. Replace {hand-rolled code} with {library component}
- **File:** `{path}`
- **Lines:** {range}
- **Eliminates:** {count} violations — {list}
- **Action:** {specific replacement — component name, props mapping, import changes}
- **Migration:** {state wiring changes, sub-component usage, prop mapping details}
- **Advocate response:** {CONCEDE | DEFEND | DISSENT}
- **Source:** Cartographer — {component replacement | variant correction | sub-component opportunity}

{If no Cartographer findings: omit this section entirely}

## Recommended (should fix)

Items from dissent (Advocate accepted but disagreed), lint warnings, or severity-assessed concessions.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {description}
- **Action:** {what to change}
- **Rationale:** {why}
- **Source:** {delegate and phase}

## Optional (consider)

Items successfully defended but flagged for awareness — weak citations or Maintainer concerns the Advocate defended with self-referential evidence.

### {N}. {Finding title}
- **File:** `{path}`
- **Lines:** {range}
- **Finding:** {description}
- **Action:** {suggested change}
- **Rationale:** {why this is optional rather than required}
- **Source:** {delegate and phase}
