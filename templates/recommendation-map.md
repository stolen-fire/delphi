# Cartographer Recommendations

**Context evaluated:** {component specification path or description}
**Library knowledge:** {MCP server | grounding file | training knowledge}
**Mode:** assist (recommendation only — no adversarial cycle)

## Component recommendations

### {N}. {Element name} — {recommended component}
- **Context:** {what this element does in the section, from the component spec or orientation}
- **Recommended:** `{Component}` with `{variant/type}` and `{key props}`
- **Confidence:** {high | medium | low}
- **Fits because:** {evidence from MCP — "When to Use" match, props match data shape, sub-components match composition needs}
- **Alternatives considered:** {other components evaluated and why they're less suitable}
- **Verified via:** {MCP tools called — e.g., antd_info(Card, detail=true), antd_semantic(Card)}

[Repeat for each primary component in the specification.]

## Variant recommendations

### {N}. {Component} — variant assessment
- **Spec says:** `{current variant/type in the component specification}`
- **Recommended:** `{same or different variant/type}`
- **Confidence:** {high | medium | low}
- **Rationale:** {why this variant fits the context — container type, data density, adjacent components, CDL treatment}
- **Verified via:** {MCP tools called}

[Repeat for each component where the Cartographer has a variant opinion. If the spec's variant is correct, say so: "Spec selection confirmed — {variant} is appropriate for {context reason}."]

## Sub-component recommendations

### {N}. {Component} — composition assessment
- **Spec says:** `{current composition API in the specification}`
- **Recommended:** `{same or different sub-components/composition}`
- **Confidence:** {high | medium | low}
- **Rationale:** {why this composition pattern fits the data shape}
- **Verified via:** {MCP tools called}

[Repeat for each component with composition API. If the spec's composition is correct, confirm it.]

## Summary

| Element | Spec component | Recommended | Match? | Confidence |
|---------|---------------|-------------|--------|------------|
| {name} | {spec choice} | {recommendation} | {Yes/No — variant differs/component differs} | {high/medium/low} |

**Overall assessment:** {N} of {M} component selections confirmed. {K} recommendations differ from the specification.
