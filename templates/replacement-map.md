# Cartographer Report

**Code reviewed:** {file paths}
**Library knowledge:** {grounding file path | MCP server | training knowledge}
**Lint findings available:** {yes — N errors, M warnings | no}

## Component replacements

### {N}. {Component/function name} -> {Library component}
- **Code:** [CITE: filename, lines]
- **What it does:** {one-sentence functional description of what the hand-rolled code does}
- **Library equivalent:** {component name and library}
- **Violations eliminated:** {count} — {list of lint finding numbers or violation IDs this replaces}
- **Coverage:** {full | partial} — does the library component cover 100% of the functionality?
- **Migration notes:** {what changes — props mapping, state wiring, import changes}

[Repeat for each replacement. If none found, write "No component replacements identified."]

## Variant corrections

### {N}. {Component} at [CITE: file, line] — wrong variant for context
- **Current:** {what's used and how}
- **Should be:** {correct variant/type with specific props}
- **Context signal:** {why — parent container, adjacent components, interaction pattern}
- **Reference:** {component "When to use" guidance, if available from grounding/MCP}

[Repeat for each correction. If none found, write "No variant corrections identified."]

## Sub-component opportunities

### {N}. {Component} at [CITE: file, line] — manual structure has a sub-component
- **Current:** {what's built by hand}
- **Should be:** {sub-component API with props}
- **Eliminates:** {count} violations — {which ones}

[Repeat for each opportunity. If none found, write "No sub-component opportunities identified."]

## Challenges to: advocate

[For EACH proposal above (replacements, variant corrections, sub-component opportunities), frame as an adversarial challenge under this header. The engine routes these to the Advocate for DEFEND/CONCEDE/DISSENT response.]

### {Proposal title}
{Functional description} reimplements what {library component} provides out of the box. This eliminates {N} violations and {M} lines of custom code. Defend the hand-rolled implementation or concede the replacement.
