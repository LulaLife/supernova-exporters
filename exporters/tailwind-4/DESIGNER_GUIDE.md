# Figma → Component Layer: Designer Guide

Our Tailwind exporter automatically turns component tokens from Figma into ready-to-use CSS classes (e.g. `.alert`, `.button-primary`, `.badge-danger`) inside `@layer components`. For this to work, token names in Figma need to follow a predictable pattern.

## 1. Naming pattern

```
<component>/<variant?>/<property>/<state?>
```

- **component** — the component name (must be one of our registered ones, see list below)
- **variant** *(optional)* — visual variant like `primary`, `success`, `sm`
- **property** — what CSS property this token drives (see supported list)
- **state** *(optional)* — interaction state

### Examples

| Figma token path | Generated CSS |
| --- | --- |
| `alert/padding-x` | `.alert { padding-inline: … }` |
| `alert/success/bg` | `.alert-success { background-color: … }` |
| `alert/success/border` | `.alert-success { border-color: … }` |
| `button/primary/bg` | `.button-primary { background-color: … }` |
| `button/primary/bg/hover` | `.button-primary:hover { background-color: … }` |
| `field/placeholder/color` | `.field::placeholder { color: … }` |

## 2. Supported property names

Use these exact words as the last (or second-to-last) segment:

- **Spacing:** `padding`, `padding-x`, `padding-y`, `margin`, `margin-x`, `margin-y`, `gap`
- **Size:** `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`
- **Color:** `bg` / `background`, `color` / `text` / `icon` / `foreground`, `border`
- **Border / shape:** `radius`, `border-width`, `shadow`
- **Typography:** `font-size`, `font-weight`, `line-height`
- **Other:** `opacity`, `z-index`

Tokens whose last segment isn't in this list will be **silently skipped** — they'll still appear as CSS variables, but they won't become a `.component` class.

## 3. Supported states

Add as the last segment:

| Suffix | Becomes |
| --- | --- |
| `hover` | `:hover` |
| `pressed` | `:active` |
| `disabled` | `:disabled` |
| `focus` / `focus-visible` | `:focus-visible` |
| `placeholder` | `::placeholder` |

## 4. Registered components today

`alert`, `button`, `badge`, `field`, `switch`, `tooltip`

**Adding a new component** (e.g. `chip`, `modal`, `card`): ping the engineering team. We need to add the name to one config field — takes a minute — and it'll start flowing through on the next export.

## 5. Things to avoid

- Don't invent property names (e.g. `alert/success/fill` won't work — use `bg`).
- Don't put states in the middle of the name (`button/hover/primary/bg` ❌ — put state last: `button/primary/bg/hover` ✅).
- Token names are matched case-insensitively, but stick to kebab-case for consistency.
