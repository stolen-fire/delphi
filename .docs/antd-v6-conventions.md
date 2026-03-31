# Ant Design v6 Code Conventions

Conventions for Ant Design v6 + Next.js projects. Used as grounding material for code review delegates.

Source: Design System Enforcement Research Report (2026-03-31)

---

## 1. Component Selection Rules

Use Ant Design components instead of raw HTML elements. This is the highest-impact convention — wrong component selection is the most frequent and most costly violation.

| Instead of | Use | Why |
|---|---|---|
| `<div>` for content containers | `<Card>`, `<Space>`, `<Flex>` | Design system provides consistent spacing, elevation, padding |
| `<button>` | `<Button>` | Consistent sizing, loading states, icon support, accessibility |
| `<input>` | `<Input>`, `<InputNumber>`, `<AutoComplete>` | Validation integration, size variants, addon support |
| `<select>` | `<Select>` | Search, multi-select, tag mode, option grouping |
| `<table>` | `<Table>` | Sorting, filtering, pagination, column configuration |
| `<a>` for navigation | `<Typography.Link>` or Next.js `<Link>` | Consistent typography, proper routing |
| `<h1>`-`<h6>` | `<Typography.Title level={N}>` | Consistent heading scale, responsive sizing |
| `<p>` | `<Typography.Paragraph>` | Consistent body text, ellipsis, copyable |
| `<ul>`/`<ol>` | `<List>` | Consistent list presentation, pagination, loading |
| `<img>` | `<Image>` | Preview, fallback, lazy loading, placeholder |
| Custom modal/dialog | `<Modal>` | Focus trap, keyboard handling, consistent behavior |
| Custom drawer | `<Drawer>` | Consistent slide-in, close on escape, overlay |
| Custom tabs | `<Tabs>` | Consistent tab behavior, keyboard navigation |
| Custom collapse/accordion | `<Collapse>` | Consistent expand/collapse, accessibility |
| Custom tooltip | `<Tooltip>` | Consistent positioning, delay, trigger behavior |
| Custom popover | `<Popover>` | Consistent positioning with rich content |
| Custom dropdown | `<Dropdown>` | Consistent menu positioning, trigger modes |
| Custom breadcrumb | `<Breadcrumb>` | Consistent separator, routing integration |
| Custom steps/wizard | `<Steps>` | Consistent step indicators, status, clickable |
| Custom tags/chips | `<Tag>` | Consistent sizing, closable, color presets |
| Custom badge | `<Badge>` | Consistent dot/count, overflow, status |
| Custom alert/banner | `<Alert>` | Consistent severity levels, closable, actions |
| Custom progress bar | `<Progress>` | Consistent bar/circle/line, animation |
| Custom avatar | `<Avatar>` | Consistent sizing, fallback, group support |
| Custom divider | `<Divider>` | Consistent horizontal/vertical, text in divider |
| Custom skeleton loader | `<Skeleton>` | Consistent placeholder shapes, animation |
| Custom spinner | `<Spin>` | Consistent loading indicator, tip text |
| Custom empty state | `<Empty>` | Consistent empty illustrations, description |
| Custom result page | `<Result>` | Consistent success/error/info/warning pages |

**Exception:** Using raw HTML is acceptable for truly custom content that has no Ant Design equivalent (e.g., `<canvas>`, `<video>`, `<svg>` graphics, third-party widget containers).

---

## 2. Component Prop API Hierarchy

When you need to customize a component's appearance or behavior, use the highest-priority API available. Do not skip levels.

1. **Component props** (highest priority) — Use the component's own API. `<Button type="primary" size="large">` not `style={{ backgroundColor: 'blue' }}`.
2. **Sub-components** — Use compound component patterns. `<Card.Meta>` not a custom div inside Card.
3. **`styles` / `classNames` props** (Ant Design v6 API) — For styling individual internal parts. `<Modal styles={{ body: { padding: 0 } }}>` not `.ant-modal-body { padding: 0 }`.
4. **ConfigProvider design tokens** — For theme-wide changes. Modify tokens, not individual components.
5. **Inline styles** (lowest priority, only if justified) — Only when no higher-level API covers the need. Document why.

**Violation:** Using a lower-priority API when a higher-priority one exists.

---

## 3. Layout and Spacing

Use Ant Design's layout components for structure. Do not replicate their behavior in CSS.

| Instead of | Use |
|---|---|
| `display: flex` | `<Flex>` component |
| `display: flex; justify-content: space-between` | `<Flex justify="space-between">` |
| `display: flex; align-items: center` | `<Flex align="center">` |
| `gap: 8px` / `gap: 16px` between items | `<Space>` or `<Space size="middle">` |
| `margin-bottom: 24px` between sections | `<Space direction="vertical" size="large">` |
| CSS Grid for page layout | `<Layout>`, `<Layout.Header>`, `<Layout.Content>`, `<Layout.Sider>` |
| `display: grid; grid-template-columns` | `<Row>` + `<Col span={N}>` |

**Exception:** Complex, unique layouts that genuinely require CSS Grid or custom flex configurations (e.g., dashboard tile layouts, masonry grids) are acceptable. The rule applies to standard page structures, not creative layouts.

---

## 4. Design Token Usage

Use ConfigProvider design tokens instead of hardcoded values.

| Violation | Correct |
|---|---|
| `color: #1677ff` | Use token: `colorPrimary` via ConfigProvider |
| `color: #ff4d4f` | Use token: `colorError` |
| `color: #52c41a` | Use token: `colorSuccess` |
| `color: #faad14` | Use token: `colorWarning` |
| `border-radius: 8px` | Use token: `borderRadius` |
| `font-size: 14px` | Use token: `fontSize` |
| `font-size: 20px` | Use token: `fontSizeHeading3` |
| `padding: 24px` | Use token: `paddingLG` |
| `margin: 16px` | Use token: `marginMD` |

**Rule:** If a value corresponds to a design token, use the token. Hardcoded values create drift when the theme changes.

---

## 5. Forbidden Patterns

These patterns are always violations:

### 5a. Inline `style` prop on Ant Design components
```tsx
// VIOLATION
<Card style={{ margin: 0, padding: '12px', borderRadius: '8px' }}>

// CORRECT — use component API or ConfigProvider tokens
<Card>
```

### 5b. `className` prop on Ant Design v6 components
```tsx
// VIOLATION — className is v5 pattern
<Modal className="custom-modal">

// CORRECT — use v6 styles/classNames API
<Modal styles={{ body: { padding: 0 } }} classNames={{ body: 'custom-body' }}>
```

### 5c. Overriding `.ant-*` selectors in CSS
```css
/* VIOLATION */
.ant-card-body { padding: 0; }
.ant-modal-header { background: white; }

/* CORRECT — use styles/classNames prop on the component */
```

### 5d. `!important` in CSS
```css
/* VIOLATION */
.my-component { color: red !important; }

/* CORRECT — fix specificity at the source, don't force override */
```

### 5e. Internal antd import paths
```tsx
// VIOLATION
import Button from 'antd/es/button';
import 'antd/es/button/style';

// CORRECT
import { Button } from 'antd';
```

### 5f. CSS custom property overrides on antd components
```tsx
// VIOLATION — bypasses the token system
<Button style={{ '--ant-color-primary': '#ff0000' }}>

// CORRECT — use ConfigProvider theme
<ConfigProvider theme={{ token: { colorPrimary: '#ff0000' } }}>
```

---

## 6. Composition Patterns

### 6a. No unnecessary wrapper divs
```tsx
// VIOLATION
<div className="card-wrapper">
  <Card>
    <div className="card-content">
      ...
    </div>
  </Card>
</div>

// CORRECT — Card handles its own spacing and containment
<Card>
  ...
</Card>
```

### 6b. Use compound components
```tsx
// VIOLATION — manual structure inside Card
<Card>
  <div className="card-title">Title</div>
  <div className="card-description">Description</div>
  <img src="avatar.png" className="card-avatar" />
</Card>

// CORRECT
<Card>
  <Card.Meta title="Title" description="Description" avatar={<Avatar src="avatar.png" />} />
</Card>
```

### 6c. Use Form.Item for form layout
```tsx
// VIOLATION — manual label + input structure
<div className="form-row">
  <label>Name</label>
  <Input />
  <span className="error">Required</span>
</div>

// CORRECT
<Form.Item label="Name" rules={[{ required: true }]}>
  <Input />
</Form.Item>
```

---

## 7. What This Does NOT Cover

These are out of scope for this conventions document:

- Business logic correctness
- Performance optimization beyond component selection
- Accessibility beyond what Ant Design components provide
- Test coverage
- State management patterns
- API/data fetching patterns
- Next.js-specific patterns (routing, SSR, API routes)

This document covers **design system compliance** only.
