DESIGN-SYSTEM-ENFORCEMENT-RESEARCH-REPORT.md
Page
/1

# Design System Enforcement for AI-Assisted Development

> Research report on preventing AI coding agents from overriding design system components. Covers tooling validation, industry practices, and a recommended implementation stack.
>
> Prepared 2026-03-31. Context: Next.js + Ant Design v6 projects, Claude Code as the primary AI agent.

---

## Table of contents

1. [The problem](#the-problem)
2. [What the industry does](#what-the-industry-does)
3. [Key research findings](#key-research-findings)
4. [Gap analysis: what linting catches and what it doesn't](#gap-analysis)
5. [The recommended stack](#the-recommended-stack)
6. [Why not switch design systems?](#why-not-switch-design-systems)
7. [Implementation details](#implementation-details)
8. [Sources](#sources)

---

## The problem

AI coding agents (Claude Code, Cursor, Copilot) generate code based on training data containing millions of examples of developers overriding design system defaults. When asked to build a Card component, the agent doesn't just use `<Card>` — it adds `style={{ margin: 0, padding: '12px', borderRadius: '8px' }}` on top of it. These overrides were never requested. They come from training data patterns.

Advisory rules ("NEVER add inline styles") work approximately 80% of the time and degrade as instruction count rises. Research confirms a ceiling of roughly 150 instructions before compliance drops uniformly. Long standards documents (700+ lines) can actually hurt performance — the agent starts ignoring instructions as the context becomes bloated.

The fix is deterministic enforcement: tooling that prevents overrides, not instructions asking nicely.

### The real causes of design system drift (ranked by frequency)

This is important because the original analysis focused heavily on inline styles (#4), but the research shows the problem is broader:

1. **Wrong component selection** — AI uses `<div>` instead of `<Card>`, `<button>` instead of `<Button>`, custom implementations instead of library components. This is the most common and highest-impact violation.
2. **CSS that duplicates component props** — Writing `margin-bottom: 24px` in CSS instead of using `<Space size="large">`, or `display: flex; justify-content: space-between` instead of `<Flex justify="space-between">`.
3. **Incorrect composition** — Unnecessary wrapper divs, redundant nesting, layout that fights the design system's grid/layout components.
4. **Hardcoded values instead of tokens** — `color: #1677ff` instead of the design token, `border-radius: 8px` instead of the token. Real, but lower frequency in a well-configured project using ConfigProvider.
5. **Inline style overrides** — The `style` prop on components. The most visible violation, but not actually the most common.

---

## What the industry does

We researched how five major design system teams enforce compliance programmatically. The pattern is consistent: every team builds their own enforcement tooling on top of their design system.

### Atlassian (Atlassian Design System)

**Tool:** `@atlaskit/eslint-plugin-design-system` — 50+ custom ESLint rules.

Key rules include `ensure-design-token-usage` (flags hardcoded colors/spacing and suggests the correct token), `no-unsafe-design-token-usage`, `no-deprecated-design-token-usage`, `no-margin`, `no-html-button`, `no-html-anchor`, `prefer-primitives`, `use-tokens-typography`. Has autofix for token migrations.

This is the gold standard — the most comprehensive ESLint-based design system enforcement plugin in the ecosystem. No Stylelint.

### Shopify (Polaris)

**Tools:** `@shopify/eslint-plugin` (ESLint) + `@shopify/stylelint-polaris` (40+ Stylelint rules).

ESLint bans direct DOM elements when a Polaris component exists. Stylelint enforces token usage for borders, colors, motion, shadows, z-index, media queries, spacing, typography. Their philosophy: "If the component API is right, the CSS is right."

### GitHub (Primer)

**Tools:** ESLint + `@primer/stylelint-config`.

ESLint handles component usage rules. Stylelint enforces their utility-class-first approach — `primer/colors`, `primer/spacing`, `primer/typography`, `primer/borders`, `primer/box-shadow`, `primer/no-override`. GitHub is the exception that uses Stylelint heavily, because Primer has a large CSS-native surface area that is itself the design system.

### IBM (Carbon)

**Tool:** `stylelint-plugin-carbon-tokens` — 5 Stylelint rules.

Rules: `carbon/layout-use`, `carbon/motion-duration-use`, `carbon/motion-easing-use`, `carbon/theme-use`, `carbon/type-use`. Focused and narrow. Has autofix in v2+. This is the closest model to what a small team should build — 5 rules, not 50.

### Factory.ai (AI-specific philosophy)

**Tool:** `@factory/eslint-plugin` — 25+ custom ESLint rules (published as reference implementation, not maintained).

**Philosophy:** "Lint green = done." Encode standards as lint rules, run the same rules inside the agent toolchain and in CI. Humans define standards, linters enforce them, AI agents self-correct against them. This is the most relevant philosophy for AI-assisted development.

### The pattern

4 out of 5 teams use **ESLint as the primary enforcement layer**. Only GitHub uses Stylelint as a major enforcement tool, and that's because Primer's architecture is CSS-native. Teams working with component-based design systems (Polaris, Atlassian, Ant Design Pro) found that ESLint + component API boundaries were sufficient.

**No Ant Design-specific enforcement tooling exists.** This is a real gap in the ecosystem. Every major design system team built their own.

---

## Key research findings

### Finding 1: `react/forbid-component-props` works, with caveats

The ESLint rule `react/forbid-component-props` from eslint-plugin-react (40M+ weekly npm downloads, actively maintained) supports `disallowedFor` (restricting a prop ban to specific component names) and custom error messages. This is the right tool for banning the `style` prop on Ant Design components.

**Limitation:** The rule operates on JSX tag names, not import bindings. `import { Card as MyCard } from 'antd'` would not be caught unless `MyCard` is also in the disallowed list. Workaround: use `disallowedForPatterns` for glob matching.

### Finding 2: `eslint-plugin-no-inline-styles` is not recommended

3 GitHub stars, last updated 2022, depends on deprecated `lodash.get`, zero configurability (all-or-nothing ban), and a documented bypass in its own README (string literal style values pass through). `react/forbid-component-props` already covers this use case with far more granularity.

### Finding 3: Claude Code PostToolUse hooks work, but differently than described

The hook JSON format `{"decision": "block", "reason": "..."}` is correct and is the only way to feed linter output back to Claude. Without it, Claude silently ignores all linter output.

However, the original analysis contained three implementation errors:

- **`TOOL_INPUT_FILE_PATH` does not exist** as an environment variable. Hook input is delivered as JSON on stdin. The correct approach: `FILE_PATH=$(jq -r '.tool_input.file_path' < /dev/stdin)`.
- **PostToolUse cannot actually block the write** — the tool has already executed. `"decision": "block"` shows the reason to Claude as feedback prompting corrective action, but it cannot undo the edit. It's feedback, not a gate.
- **The matcher `Write|Edit` misses** `MultiEdit` (batch edits), `NotebookEdit` (Jupyter), Bash-based file writes, and MCP tool edits.

Real-world gotchas from GitHub issues: hooks sometimes don't execute despite correct configuration, formatters can have changes silently overwritten by Claude's buffer flush, and exit code behavior is inconsistent with documentation.

### Finding 4: Wrapper components (`Omit<Props, 'style'>`) are impractical

No production repos were found using this pattern for design system enforcement. Carbon Design System (the closest example) uses ESLint rules, not TypeScript wrappers.

For Ant Design specifically: several component families break when wrapped because parents read `children[n].props` directly (Table.Column, Menu.SubMenu, Collapse.Panel, Tabs.TabPane, Select.Option, Descriptions.Item). Static methods are lost (Modal.confirm(), message.info()). 60+ components with sub-components would require 100+ wrapper files with ongoing maintenance burden for every antd minor release.

TypeScript module augmentation cannot remove props (it can only add or narrow). This is a dead end.

### Finding 5: Stylelint has production-grade token enforcement

`stylelint-declaration-strict-value` (143 stars, actively maintained, last published 2026-02-24) forces CSS variables for specified properties. This is the "require var() instead of hardcoded values" rule that replaces the need for a custom token-checking script.

Built-in Stylelint rules cover the rest: `declaration-no-important` (ban !important), `selector-disallowed-list` with regex (ban `.ant-*` selector overrides), `selector-class-pattern` (ban suspicious class prefixes like `custom-`, `hack-`, `fix-`), `color-no-hex` (ban hardcoded colors).

All of these were verified to work with CSS Modules, Next.js, and the flat config format.

### Finding 6: The `@anthropic-ai/mcp-antd-components` package doesn't exist

The original analysis referenced a non-existent npm package. Anthropic does not publish an Ant Design MCP server.

The correct package is `@jzone-mcp/antd-components-mcp` (235 stars, actively maintained, last updated 2026-03-30). Version 2.0.x explicitly targets Ant Design v6 with pre-processed data from v6.3.3. Provides component listing, props/API docs, code examples, and changelogs.

### Finding 7: The false positive problem is real and documented

Research from multiple teams documents a "linter trust curve": above ~15-20% false positive rate, developers and AI agents start reflexively adding disable comments, which is worse than no linting at all.

Layout properties (`display`, `flex`, `gap`, `padding`, `margin`, `width`, `max-width`) are legitimate CSS that Ant Design's component API doesn't fully cover. Flagging these creates exactly the false positive cascade that kills trust.

The documented backfire pattern: aggressive rules trigger on legitimate code, developers add `/* stylelint-disable */` at the file level, that disable suppresses ALL rules including ones that catch real violations, net result is worse enforcement than having no Stylelint at all.

**Implication:** Stylelint rules must be narrow. Ban hardcoded colors and `.ant-*` selectors (near-zero false positives). Do NOT ban layout properties.

### Finding 8: `eslint_d` (ESLint daemon) dramatically improves hook performance

Cold `npx eslint` runs take 500-800ms. `eslint_d` (maintained, v15.0.0, supports ESLint 4-10) runs in ~100ms by keeping a background daemon process alive. This makes the PostToolUse feedback loop nearly imperceptible.

Stylelint with `--cache` brings repeat runs to ~200ms. A Stylelint daemon exists but is less mature.

### Finding 9: An Angular-based custom checker validated the approach

A standalone AST-based checker for Angular + ng-zorro-antd (Ant Design for Angular) independently arrived at the same enforcement categories: token compliance, raw color detection, `!important` bans, `.ant-*` selector override detection, suspicious class name flagging.

The checker uses htmlparser2 for HTML parsing and postcss for CSS parsing — the same engine Stylelint uses natively. Every rule in the checker maps directly to an existing Stylelint rule or `stylelint-declaration-strict-value`. The value-level checking (are you using tokens, not hardcoded colors?) is something `react/forbid-component-props` alone doesn't cover, confirming that Stylelint has a role — just a narrow one.

---

## Gap analysis

Given ESLint banning the `style` prop on components and Stylelint handling CSS files, here is what can and cannot be caught:

### What the stack catches

| Violation | Tool | Reliability |
|---|---|---|
| `style` prop on Ant Design components | ESLint `react/forbid-component-props` | Deterministic |
| Raw HTML elements with Ant Design equivalents | ESLint `no-restricted-syntax` | Deterministic |
| Hardcoded colors in CSS files | Stylelint `color-no-hex` or `declaration-strict-value` | Deterministic |
| `!important` in CSS files | Stylelint `declaration-no-important` | Deterministic |
| `.ant-*` selector overrides in CSS | Stylelint `selector-disallowed-list` | Deterministic |
| Suspicious class names (`custom-`, `hack-`) | Stylelint `selector-class-pattern` | Deterministic |
| Internal antd import paths | ESLint `no-restricted-imports` | Deterministic |

### What the stack does NOT catch

| Violation | Why it's hard | Mitigation |
|---|---|---|
| Wrong component selection (div instead of Card) | Requires knowing every Ant Design component and its use cases | MCP server for component reference + advisory rules |
| Incorrect composition (unnecessary wrappers) | Structural/architectural — not detectable by property-level linting | Code review |
| CSS that duplicates a component prop | Requires knowing every component's prop API | MCP server + advisory rules |
| `style` on HTML elements (`<div style={...}>`) | `forbid-component-props` only covers listed components | Consider banning `style` on ALL components (remove `disallowedFor`) |
| CSS custom property overrides inline | `style={{ '--ant-color-primary': '#ff0000' }}` | Invisible to static analysis |
| Dynamic styles via template literals | Opaque to static analysis | Code review |
| Inline `<style>` tags in JSX | Rare but possible | Code review |

---

## The recommended stack

Eight rules across two linters, a feedback hook, a commit gate, and a component reference server.

### Layer 1: ESLint (component-level enforcement)

Five rules targeting JSX/TSX files:

| Rule | What it catches |
|---|---|
| `react/forbid-component-props` — ban `style` | Inline style overrides on Ant Design components |
| `react/forbid-component-props` — ban `className` on Ant Design v6 components | Forces use of `styles`/`classNames` prop (the v6 API) |
| `no-restricted-syntax` — ban raw HTML equivalents | `<button>`, `<input>`, `<table>`, `<select>` when Ant Design components exist |
| `no-restricted-imports` — ban internal antd paths | Prevents `import ... from 'antd/es/button/style'` |
| Advisory: component API hierarchy in CLAUDE.md | Prop > sub-component > token > inline (only if justified) |

### Layer 2: Stylelint (CSS value enforcement)

Three rules targeting `.css` and `.module.css` files:

| Rule | What it catches |
|---|---|
| `declaration-no-important` | `!important` overrides |
| `selector-disallowed-list` with `/\.ant-/` | Direct overrides of Ant Design internal selectors |
| `color-no-hex` or `stylelint-declaration-strict-value` | Hardcoded color values instead of design tokens |

Do NOT add rules for layout properties (display, flex, gap, padding, margin, width). These have near-100% false positive rates in component-library projects and will cause linter trust erosion.

### Layer 3: PostToolUse hook (AI feedback loop)

Runs ESLint (via `eslint_d` for speed) on `.ts`/`.tsx` files and Stylelint (with `--cache`) on `.css` files after every file edit. Outputs `{"decision": "block", "reason": "..."}` so Claude sees the violations and self-corrects.

This is feedback, not a gate. The file is already written — the hook tells Claude to fix it.

### Layer 4: Pre-commit hook (deterministic gate)

Husky + lint-staged running both ESLint and Stylelint on staged files before commit. This is the actual enforcement boundary — nothing with lint errors gets committed.

### Layer 5: Ant Design MCP server (prevention via better generation)

`@jzone-mcp/antd-components-mcp` gives Claude real-time access to the actual Ant Design v6 component API — all props, variants, "when to use" guidance, code examples. This addresses the #1 cause of drift (wrong component selection) by making the right information available at generation time. Prevention is better than detection.

### What this achieves

- Correct component selection (MCP server provides the reference)
- Components used as intended (ESLint bans style/className overrides)
- Theme token compliance (Stylelint catches hardcoded values in CSS)
- No `.ant-*` selector hacking (Stylelint catches it deterministically)
- Consistency at scale (one token change updates every component)
- Fast feedback loop for AI agents (~100-300ms per edit)
- Deterministic commit gate (nothing bad gets committed)

---

## Why not switch design systems?

Switching to a design system with existing enforcement tooling (Carbon, Polaris, Primer) would not solve this problem for three reasons:

1. **Enforcement tooling doesn't come with the design system.** Atlassian's 50-rule plugin enforces *their* design system for *their* codebase. Shopify's plugin enforces *their* conventions. If you switched to Carbon, you'd get `stylelint-plugin-carbon-tokens` (5 narrow rules), but you'd still need to build ESLint rules for component selection, composition patterns, and project-specific conventions.

2. **Enforcement is inherently project-specific.** The rules encode "use *this* component, not *that* HTML element" and "use *this* token, not *that* hardcoded value" for your specific component list, your token names, your codebase conventions. Those rules don't transfer between teams even within the same design system.

3. **What we're building is smaller than what they built.** Atlassian has 50+ custom rules. We need 8. The difference is they're enforcing across hundreds of engineers and thousands of files. We're enforcing against AI agents on focused projects with a small team. The surface area is fundamentally different. IBM Carbon's enforcement is 5 Stylelint rules — we're in that range.

Ant Design v6's ConfigProvider + design token system is architecturally sound. The gap isn't the design system — it's the enforcement configuration around it, and that's what this stack provides.

---

## Implementation details

### ESLint configuration (eslint.config.mjs)

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";

const ANT_DESIGN_COMPONENTS = [
  'Button', 'Card', 'Input', 'Typography', 'Space', 'Flex',
  'Table', 'List', 'Descriptions', 'Tag', 'Badge', 'Alert',
  'Menu', 'Tabs', 'Modal', 'Drawer', 'Form', 'Select',
  'DatePicker', 'Checkbox', 'Radio', 'Switch', 'Slider',
  'Progress', 'Spin', 'Skeleton', 'Avatar', 'Image',
  'Collapse', 'Popover', 'Tooltip', 'Divider', 'Layout',
  'Row', 'Col', 'Breadcrumb', 'Dropdown', 'Pagination',
  'Steps', 'Transfer', 'TreeSelect', 'Upload', 'Rate',
  'TimePicker', 'AutoComplete', 'Cascader', 'ColorPicker',
  'InputNumber', 'Mentions', 'Segmented', 'ConfigProvider',
  'FloatButton', 'Watermark', 'App', 'Result', 'Empty',
  'Statistic', 'Timeline', 'Tree', 'Anchor', 'Tour',
  'QRCode', 'Splitter'
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    plugins: { react: reactPlugin },
    rules: {
      // Ban style prop on all Ant Design components
      'react/forbid-component-props': ['error', {
        forbid: [
          {
            propName: 'style',
            disallowedFor: ANT_DESIGN_COMPONENTS,
            message: 'Do not use inline styles on Ant Design components. Use component props, sub-components, or ConfigProvider design tokens.'
          }
        ]
      }],

      // Ban direct imports from antd internal paths
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['antd/es/*', 'antd/lib/*'],
          message: 'Import from "antd" directly, not internal paths.'
        }]
      }]
    }
  }
]);

export default eslintConfig;
```

### Stylelint configuration (stylelint.config.mjs)

```javascript
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value"],
  rules: {
    // Ban !important
    "declaration-no-important": true,

    // Ban .ant-* selector overrides
    "selector-disallowed-list": ["/\\.ant-/"],

    // Ban hardcoded colors — require CSS variables
    "color-no-hex": true,

    // Ban suspicious class prefixes
    "selector-class-pattern": [
      "^(?!custom-|hack-|fix-|override-|my-)[a-zA-Z][a-zA-Z0-9-]*$",
      { "message": "Avoid ad hoc class names. Use design system conventions." }
    ],

    // Require variables for color properties (optional, stricter alternative to color-no-hex)
    // "scale-unlimited/declaration-strict-value": [
    //   ["/color$/", "background-color", "border-color", "font-size", "font-family"],
    //   {
    //     "ignoreValues": { "": ["inherit", "initial", "unset", "currentColor", "transparent", "none"] },
    //     "ignoreVariables": true
    //   }
    // ]
  }
};
```

### PostToolUse hook script (.claude/hooks/lint-check.sh)

```bash
#!/bin/bash
# Reads file path from stdin JSON, runs the appropriate linter,
# outputs block decision if violations found.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"
ERRORS=""

case "$EXT" in
  ts|tsx|js|jsx)
    # Use eslint_d for speed (~100ms vs ~500ms cold start)
    if command -v eslint_d &> /dev/null; then
      ERRORS=$(eslint_d "$FILE_PATH" --format compact 2>/dev/null)
    else
      ERRORS=$(npx eslint "$FILE_PATH" --format compact 2>/dev/null)
    fi
    ;;
  css)
    ERRORS=$(npx stylelint "$FILE_PATH" --cache --formatter compact 2>/dev/null)
    ;;
esac

if [ -n "$ERRORS" ] && echo "$ERRORS" | grep -q "problem"; then
  jq -n --arg reason "$ERRORS" '{"decision": "block", "reason": $reason}'
fi

exit 0
```

### Hook configuration (.claude/settings.json)

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "command": ".claude/hooks/lint-check.sh"
    }]
  }
}
```

### Pre-commit setup

```json
// package.json additions
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix"],
    "*.{css,module.css}": ["stylelint --fix"]
  }
}
```

```bash
# Setup
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

### MCP server installation

```bash
claude mcp add antd-components -- npx @jzone-mcp/antd-components-mcp
```

---

## Sources

### Academic / research

- Jaroslawicz et al. (2025): LLM instruction compliance decreases uniformly as instruction count rises, with a ceiling of ~150 instructions
- ETH Zurich (2026): LLM-generated rules can hurt model performance
- Factory.ai: "Using Linters to Direct Agents" — philosophy of encoding standards as lint rules for AI agent direction

### Design system team enforcement

- Atlassian: `@atlaskit/eslint-plugin-design-system` — 50+ ESLint rules for design token enforcement
- Shopify: `@shopify/eslint-plugin` + `@shopify/stylelint-polaris` — ESLint + Stylelint enforcement for Polaris
- GitHub: `@primer/stylelint-config` — Stylelint enforcement for Primer design system
- IBM: `stylelint-plugin-carbon-tokens` — 5 focused Stylelint rules for Carbon tokens
- Salesforce: `@salesforce-ux/slds-linter` — ESLint-based enforcement for SLDS 2

### Tools validated

- `eslint-plugin-react` v7.37.5 — `react/forbid-component-props` with `disallowedFor` confirmed working (jsx-eslint/eslint-plugin-react, 40M+ weekly npm downloads)
- `stylelint-declaration-strict-value` v1.11.1 — Forces CSS variables for specified properties (143 stars, last published 2026-02-24)
- `eslint_d` v15.0.0 — ESLint daemon, ~100ms per run vs ~500ms cold start (mantoni/eslint_d.js)
- `@jzone-mcp/antd-components-mcp` v2.0.8 — Ant Design v6 MCP server (235 stars, last updated 2026-03-30)
- `stylelint-config-css-modules` v4.6.0 — CSS Modules compatibility for Stylelint

### Tools evaluated and rejected

- `eslint-plugin-no-inline-styles` — Unmaintained (2022), 3 stars, documented bypass, deprecated dependency
- `@anthropic-ai/mcp-antd-components` — Does not exist (fabricated in prior analysis)
- `hannesj/mcp-antd-components` — Unmaintained (2025-03-18, never updated), targets antd v5 only
- Wrapper components with `Omit<Props, 'style'>` — No production precedent, breaks 6+ Ant Design component families, impractical maintenance burden
- Melta-UI — Prompt-engineering approach (natural-language anti-patterns for AI to read), not programmatic enforcement
- GPTLint — LLM-based linting, too slow and non-deterministic for this use case

### Claude Code hooks

- Official hooks documentation: code.claude.com/docs/en/hooks, code.claude.com/docs/en/hooks-guide
- Eric Boehs (2026-03-17): PostToolUse hooks with JSON block format — boehs.com/blog/2026/03/17/claude-code-lint-hooks/
- GitHub issue #9567: Confirmation that `TOOL_INPUT_FILE_PATH` and similar env vars do not exist
- GitHub issue #10011: PostToolUse hooks that modify files can have changes silently overwritten
- disler/claude-code-hooks-mastery: Reference implementation for Python quality gate hooks
- johnlindquist/claude-hooks: TypeScript framework for strongly-typed hook payloads (339 stars)

### Angular checker (independent validation)

- Standalone AST-based checker for Angular + ng-zorro-antd using htmlparser2 + postcss. Every rule maps to an existing Stylelint rule or `stylelint-declaration-strict-value`, confirming that value-level checking is achievable with off-the-shelf tools. The checker independently validated the enforcement categories (token compliance, raw color detection, !important bans, .ant-* selector override detection).

Displaying DESIGN-SYSTEM-ENFORCEMENT-RESEARCH-REPORT.md.