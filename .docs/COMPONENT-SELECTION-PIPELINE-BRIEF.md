# Component Selection Pipeline Brief

For developers working with the Harmonia interaction design pipeline. This document explains why design system consistency requires disciplined component and variant selection — not just clean code — and how every step from pattern selection through build enforces that discipline.

---

## The real problem

Design system drift is not primarily an override problem. It's a **selection problem**. The causes of drift, ranked by frequency and impact:

1. **Wrong component selection** — using `<div>` instead of `<Card>`, a custom layout instead of `<Descriptions>`, a hand-built list instead of `<List>`. Highest impact, most common.  
2. **Wrong variant/type selection** — using a default `<Button>` where a `type="text"` button was appropriate, using a full `<Card>` where `size="small"` or `type="inner"` was needed.  
3. **CSS that duplicates component props** — writing `margin-bottom: 24px` instead of using `<Space size="large">`.  
4. **Incorrect composition** — unnecessary wrapper divs, fighting the layout system.  
5. **Hardcoded values instead of tokens** — `color: #1677ff` instead of the design token.  
6. **Inline style overrides** — the `style` prop. Most visible, but not the most common.

Most enforcement discussions focus on \#5 and \#6. The highest-impact violations are \#1 and \#2. **If you select the wrong component or the wrong variant, no amount of clean token usage will produce a consistent application.** You'll have clean code that looks different on every screen.

---

## The pipeline flow

After the UX pattern is selected (Step 4 in the interaction design checklist), four steps turn that pattern into clean, consistent code. Each step narrows the decision space so that by the time you build, there should be zero ambiguity.

UX Pattern Selected

       │

       ▼

┌─────────────────────────────┐

│  COMPONENT MAPPING (Step 5\) │  ← Query Ant Design MCP

│  Select the right component │     for each element in

│  Select the right type      │     the pattern

│  Select the right props     │

│  Document sub-components    │

└─────────────┬───────────────┘

              │

              ▼

┌─────────────────────────────┐

│  ACCESSIBILITY (Step 6\)     │  ← Validate selections

│  WCAG 2.2 compliance        │     against accessibility

│  Keyboard navigation        │     requirements; adjust

│  ARIA specification         │     component choices if

│  Screen reader narrative    │     needed

└─────────────┬───────────────┘

              │

              ▼

┌─────────────────────────────┐

│  BUILD (Step 7\)             │  ← Implement exactly what

│  Use the selected component │     was specified. No

│  Use the selected type      │     overrides, no improvisation,

│  Use design tokens only     │     no "making it look right"

│  Work WITH the component    │     by fighting the system

└─────────────┬───────────────┘

              │

              ▼

┌─────────────────────────────┐

│  SECTION REVIEW (Step 8\)    │  ← 5-agent review verifies

│  Lint \+ format              │     component spec match,

│  Type safety                │     design system compliance,

│  Component structure audit  │     consistency with other

│  API contract generation    │     sections, and code quality

│  Diff review                │

└─────────────────────────────┘

---

## Component mapping: how to select the right component and variant

This is the critical step. The inputs are:

- **The UX pattern** — what interaction is happening (e.g., "summary card with inline actions," "data entry dialog," "filterable list")  
- **The data fields** — what attributes from the domain model appear in this section  
- **The representation artifacts** — CDL treatment, CTA placement, state transitions from upstream pipeline work  
- **The methodology grounding** — what OOUX, DDD, and Content Strategy say about this context

The process for each element in the pattern:

### 1\. Identify the need

What role does this element play? Is it displaying structured data? Collecting input? Triggering an action? Containing other elements? Showing status?

### 2\. Query Ant Design MCP for candidate components

Use the MCP server (`@jzone-mcp/antd-components-mcp`) to look up components that serve this role. Read the **"When to use"** guidance — not just the component name.

### 3\. Select the right type/variant

This is where most drift originates. Ant Design components have types, sizes, and configuration variants. You must select the one that fits the context, not default to the base configuration.

**Example — Button:**

| Type | When to use |
| :---- | :---- |
| `type="primary"` | Primary action on the page. One per section maximum. |
| `type="default"` | Secondary actions. The standard choice. |
| `type="dashed"` | Add/create actions, often in empty states. |
| `type="text"` | Inline actions within content areas, toolbar actions. Low visual weight. |
| `type="link"` | Navigation-like actions within text. Looks like a link, behaves like a button. |

Plus properties: `danger` (destructive actions), `ghost` (on colored backgrounds), `icon` (icon-only buttons), `size` (must match adjacent components), `loading` (async operations).

**The decision is not "use a Button."** The decision is "use a `type="text"` Button with `size="small"` because this is an inline action inside a Card header, and the primary action is elsewhere."

**Example — Card:**

| Variant | When to use |
| :---- | :---- |
| Default Card | Standalone content container with clear boundaries |
| `size="small"` | Compact contexts, dashboards, sidebar items |
| `type="inner"` | Card nested inside another Card |
| Card with `Card.Meta` | Content with avatar/title/description pattern |
| Card with `tabList` | Content with switchable views |
| `bordered={false}` | Card on a colored background or within another container |
| Card with `actions` | Card with footer action buttons |
| Card with `cover` | Card with a hero image |
| Card with `extra` | Card with a header-right action link or button |
| `hoverable` | Clickable card (entire card is a CTA) |
| `loading` | Card in loading state with skeleton |

**The decision is not "use a Card."** The decision is "use a `size="small"` Card with `Card.Meta` for the title/description and `extra` for the edit action, because this is a compact summary inside a dashboard grid."

**Example — Modal:**

| Variant | When to use |
| :---- | :---- |
| Basic Modal | Standard dialog with OK/Cancel |
| Modal with `confirmLoading` | Dialog with async submit action |
| Modal with custom `footer` | Dialog needing non-standard button arrangement |
| `Modal.confirm()` | Confirmation before destructive action |
| `Modal.info()` / `.success()` / `.warning()` / `.error()` | Informational feedback dialogs |
| Modal with `destroyOnClose` | Form dialogs that must reset state |
| Modal with `width` | Wide-content dialogs (tables, complex forms) |

### 4\. Document sub-components and composition

Ant Design components have sub-components that are part of the API. These are not optional extras — they are the correct way to compose content within a component.

- `Card.Meta` — title \+ description \+ avatar layout  
- `Card.Grid` — grid layout within a card  
- `List.Item.Meta` — avatar \+ title \+ description in list items  
- `Form.Item` — label \+ input \+ validation in forms  
- `Descriptions.Item` — label-value pairs  
- `Table.Column` / `Table.ColumnGroup` — table structure  
- `Typography.Title` / `.Text` / `.Paragraph` — text hierarchy  
- `Tabs.TabPane` — tab content panels  
- `Steps.Step` — wizard steps

**If a sub-component exists for your use case, use it.** Do not recreate what `Card.Meta` does with a custom `<div>` layout inside a Card.

### 5\. Document the full specification

Every component selected gets documented with: component name, type/variant, key props, sub-components used, design tokens consumed, state handling (empty, loading, error, populated), and OOUX mapping (which domain object/attribute/CTA this represents).

---

## Accessibility validation: what happens when a selection doesn't pass

After component mapping, accessibility validation checks everything against WCAG 2.2. If an Ant Design component's built-in accessibility is insufficient:

1. **First: check if a different variant or configuration solves it.** Often the issue is that the wrong type was selected, not that the component is inaccessible.  
2. **Second: add ARIA attributes that Ant Design supports.** Most components accept `aria-*` props.  
3. **Third: if a structural change is needed, document it as a spec amendment** and discuss the cleanest approach that stays within the design system.

Accessibility adjustments should never involve custom components or overrides. If Ant Design genuinely cannot meet an accessibility requirement through its API, that's a gap to discuss and solve at the standards level — not to hack around in one section.

---

## Build rules: work with the component, not against it

When you build, the component specification from Step 5 tells you exactly what to implement. The rules:

### Use the selected component exactly as specified

If the spec says `Card` with `size="small"` and `Card.Meta`, build that. Do not substitute. Do not "improve" on the spec during build.

### Never override the component's visual output

The component looks how it looks with the selected type and props. If that doesn't match a preconceived design, **the answer is to go back and select a different type/variant** — not to override the current one with inline styles, custom CSS, or hardcoded values.

A Card with custom padding, custom border-radius, custom shadows, and overridden internal spacing is no longer an Ant Design Card. It's a `<div>` with extra steps. It will not be consistent with other Cards in the application because those Cards will also have their own custom overrides.

### Use the Component API Hierarchy

For every styling decision, in strict order:

1. **Component prop** — does a prop do this? (`size="small"`, `type="inner"`, `bordered={false}`)  
2. **Sub-component** — does a composition API handle this? (`Card.Meta`, `List.Item.Meta`)  
3. **Design token** — does a token control this? (via `useToken()` or ConfigProvider)  
4. **Inline style** — only if none of the above work, and **documented in the spec with justification**

### No hardcoded values

Every color, spacing value, font size, border radius, and shadow must come from design tokens. If a token doesn't exist for what you need, that's a gap to address in the theme configuration — not a reason to hardcode.

// WRONG

\<div style={{ marginBottom: 24, color: '\#1677ff', borderRadius: 8 }}\>

// RIGHT

const { token } \= theme.useToken();

// Then use token.marginLG, token.colorPrimary, token.borderRadiusLG

### No `.ant-*` selector overrides

Never target Ant Design's internal CSS classes. These are implementation details that change between versions. If the component doesn't look right, the answer is a different variant, a design token override via ConfigProvider, or a discussion about the gap — never a CSS hack.

---

## Concrete walkthrough

**Scenario:** The UX pattern specifies a section with a summary card. The card has a title, a subtitle, and an "Edit" action in the upper right. Clicking "Edit" opens a dialog with a form containing three fields and a save button.

### Component mapping decisions

**The card:**

- Query MCP → `Card` component  
- Needs title \+ subtitle → use `Card` with `title` prop and `Card.Meta` for subtitle content? Or just `title` \+ `extra`?  
- Read the Card docs via MCP: `title` accepts ReactNode for the card header, `extra` accepts ReactNode for upper-right content  
- Decision: `Card` with `title="Summary"` and `extra={<Button type="text" size="small">Edit</Button>}`  
- The subtitle goes in the card body using `Typography.Text` with `type="secondary"`

**The edit button:**

- This is a secondary inline action within a card header → `type="text"`, not `type="primary"` or `type="default"`  
- It's in a compact context → `size="small"`  
- It's non-destructive → no `danger` prop

**The dialog:**

- Query MCP → `Modal` component  
- Contains a form → needs `destroyOnClose` (form state must reset on close)  
- Has a save action → `confirmLoading` for async submit feedback  
- Standard OK/Cancel footer is fine → basic Modal, no custom footer needed  
- Decision: `Modal` with `title="Edit Summary"`, `destroyOnClose`, `confirmLoading={saving}`, `onOk={handleSave}`

**The form inside the dialog:**

- Query MCP → `Form` component  
- Three fields → `Form` with `Form.Item` for each field (label, validation, layout handled by the component)  
- `layout="vertical"` for stacked labels (appropriate for a modal form)  
- Each input uses the Ant Design input component for its data type (`Input`, `Select`, `DatePicker`, etc.)

**The save button:**

- The Modal provides OK/Cancel buttons by default — **do not add a separate Button inside the Modal body**  
- Configure via `okText="Save"` and `okButtonProps` if needed  
- This is the Modal's built-in behavior. Work with it.

### What this produces

Every component is Ant Design. Every variant was selected for the context. Every sub-component is used as intended. The form layout comes from the Form component, not custom CSS. The button placement comes from the Modal component, not manual positioning. There are zero overrides, zero hardcoded values, and zero custom CSS.

If this pattern appears in another section of the application, the same components with the same types will be selected, producing visual consistency automatically — because we're working with the design system, not fighting it.

---

## The enforcement stack (reference)

Deterministic tooling backs up these principles. Full details in the Design System Enforcement Research Report and Developer Guide.

| Layer | Tool | What it catches |
| :---- | :---- | :---- |
| ESLint | `react/forbid-component-props` | `style` prop on Ant Design components |
| ESLint | `no-restricted-syntax` | Raw HTML elements (`<button>`, `<input>`, `<table>`) |
| ESLint | `no-restricted-imports` | Internal `antd/es/*` imports |
| Stylelint | `declaration-no-important` | `!important` overrides |
| Stylelint | `selector-disallowed-list` | `.ant-*` selector targeting |
| Stylelint | `color-no-hex` | Hardcoded color values |
| PostToolUse hook | ESLint \+ Stylelint | Real-time feedback after every file edit |
| Pre-commit | Husky \+ lint-staged | Deterministic gate — nothing with violations gets committed |
| MCP server | `@jzone-mcp/antd-components-mcp` | Prevention — right component selection at generation time |

**What linting cannot catch:** wrong component selection beyond HTML bans, wrong variant/type selection, incorrect composition, CSS duplicating component props. These are addressed by the pipeline process (Steps 5-8) and code review — not automation.

---

## Summary

Design system consistency is not achieved by banning overrides after the fact. It's achieved by making the right selections before you write a single line of code:

1. **Right pattern** → determined by UX pattern selection (Step 4\)  
2. **Right component** → determined by querying Ant Design MCP and matching to the pattern's needs (Step 5\)  
3. **Right type/variant** → determined by the context, data fields, and interaction requirements (Step 5\)  
4. **Right sub-components** → determined by the component's composition API (Step 5\)  
5. **Validated for accessibility** → confirmed by WCAG validation (Step 6\)  
6. **Built clean** → implemented exactly as specified, no overrides, no hardcoded values (Step 7\)  
7. **Reviewed for compliance** → verified by 5-agent review pipeline (Step 8\)

If every section follows this pipeline, the application will be consistent — not because we enforced consistency after the fact, but because we made the right decisions at every step.  
