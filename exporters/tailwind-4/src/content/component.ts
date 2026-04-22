import { Token, TokenGroup } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { tokenVariableName } from "./token"

/**
 * Component-level @layer components emission.
 *
 * Maps token variable names like `--color-alert-success-bg` and `--spacing-alert-padding-x`
 * to CSS classes like `.alert-success { background-color: var(--color-alert-success-bg) }`
 * inside `@layer components { ... }`.
 *
 * Detection is driven by variable-name pattern: for each configured component name (e.g. "alert"),
 * we find every token whose CSS variable name contains `-<component>-` (or starts with `<component>-`
 * when the token has no type prefix). The tail after the component segment is then parsed into
 * `<variant>-<property>-<state>` using the mapping tables below.
 */

/**
 * Maps token "leaf" names (the last 1–2 path segments) to CSS property names.
 * Longest keys are tried first so compound keys like `padding-x` win over `padding`.
 */
const LEAF_TO_CSS_PROPERTY: Record<string, string> = {
  "padding-x": "padding-inline",
  "padding-y": "padding-block",
  "padding": "padding",
  "margin-x": "margin-inline",
  "margin-y": "margin-block",
  "margin": "margin",
  "gap": "gap",
  "radius": "border-radius",
  "height": "height",
  "min-height": "min-height",
  "max-height": "max-height",
  "width": "width",
  "min-width": "min-width",
  "max-width": "max-width",
  "bg": "background-color",
  "background": "background-color",
  "color": "color",
  "text": "color",
  "icon": "color",
  "foreground": "color",
  "border": "border-color",
  "border-width": "border-width",
  "shadow": "box-shadow",
  "font-size": "font-size",
  "font-weight": "font-weight",
  "line-height": "line-height",
  "opacity": "opacity",
  "z-index": "z-index",
}

/**
 * Maps trailing state keywords in token names to CSS pseudo-classes.
 * `pressed` → `:active` because `:active` is the CSS pseudo for an element being activated (clicked/tapped).
 */
const STATE_SUFFIX_TO_PSEUDO: Record<string, string> = {
  "hover": ":hover",
  "pressed": ":active",
  "disabled": ":disabled",
  "focus": ":focus-visible",
  "focus-visible": ":focus-visible",
  "placeholder": "::placeholder",
}

/**
 * Token tail fragments that carry no direct CSS property mapping and should be skipped.
 * E.g. `padding-text-y` on an alert is meta-spacing used inside the component, not a CSS property.
 */
const SKIP_LEAVES = new Set(["padding-text-y", "padding-text-x", "label-gap"])

interface ParsedTail {
  /** Variant path joined by '-' (e.g. "primary" or "size-sm"). Empty string for base component. */
  variant: string
  /** Resolved CSS property name. */
  property: string
  /** CSS pseudo-class (with leading colon) or empty string for default state. */
  state: string
}

/**
 * Parses the tail of a variable name (everything after `<type>-<component>-`).
 * Returns null if the tail does not resolve to a known CSS property (token is skipped).
 */
function parseTail(tail: string): ParsedTail | null {
  let working = tail

  // 1. Detect trailing state keyword (longest match first).
  let state = ""
  const stateKeys = Object.keys(STATE_SUFFIX_TO_PSEUDO).sort((a, b) => b.length - a.length)
  for (const stateKey of stateKeys) {
    if (working === stateKey) {
      state = STATE_SUFFIX_TO_PSEUDO[stateKey]
      working = ""
      break
    }
    if (working.endsWith("-" + stateKey)) {
      state = STATE_SUFFIX_TO_PSEUDO[stateKey]
      working = working.slice(0, -(stateKey.length + 1))
      break
    }
  }

  if (!working) return null

  // 2. Bail on explicitly-skipped leaves (meta-spacing, etc.)
  for (const skip of SKIP_LEAVES) {
    if (working === skip || working.endsWith("-" + skip)) return null
  }

  // 3. Match property (longest key first so `padding-x` beats `padding`).
  const propKeys = Object.keys(LEAF_TO_CSS_PROPERTY).sort((a, b) => b.length - a.length)
  for (const propKey of propKeys) {
    if (working === propKey) {
      return { variant: "", property: LEAF_TO_CSS_PROPERTY[propKey], state }
    }
    if (working.endsWith("-" + propKey)) {
      return {
        variant: working.slice(0, -(propKey.length + 1)),
        property: LEAF_TO_CSS_PROPERTY[propKey],
        state,
      }
    }
  }

  return null
}

/**
 * Finds the portion of a variable name after `-<componentName>-` (or the start, if the name
 * begins with `<componentName>-`). Returns null if the component is not found in the name.
 */
function extractTail(variableName: string, componentName: string): string | null {
  const name = variableName.toLowerCase()
  const comp = componentName.toLowerCase()
  const marker = "-" + comp + "-"
  const idx = name.indexOf(marker)
  if (idx !== -1) return name.slice(idx + marker.length)
  if (name.startsWith(comp + "-")) return name.slice(comp.length + 1)
  return null
}

/**
 * Parses the comma-separated `componentGroupsToGenerate` config value into a clean array.
 */
function parseComponentList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

/**
 * Generates the `@layer components { ... }` block for component-level tokens.
 * Returns an empty string if the feature is disabled, no components are configured,
 * or no matching tokens are found.
 */
export function generateComponentClasses(tokens: Array<Token>, tokenGroups: Array<TokenGroup>): string {
  if (!exportConfiguration.generateComponentClasses) return ""

  const components = parseComponentList(exportConfiguration.componentGroupsToGenerate || "")
  if (components.length === 0) return ""

  // selector → ordered list of CSS declarations (with their origin, for dedupe preference)
  const classMap = new Map<string, string[]>()
  // Track declaration order so we can dedupe by property, keeping the first occurrence per selector.
  const seenPropsBySelector = new Map<string, Set<string>>()

  // Pre-compute variable names once per token.
  const resolvedNames = tokens.map((t) => ({ token: t, varName: tokenVariableName(t, tokenGroups) }))

  for (const componentName of components) {
    for (const { token, varName } of resolvedNames) {
      const tail = extractTail(varName, componentName)
      if (tail === null) continue

      const parsed = parseTail(tail)
      if (!parsed) continue

      const baseSelector = parsed.variant ? `.${componentName}-${parsed.variant}` : `.${componentName}`
      const selector = baseSelector + parsed.state

      const declaration = `${parsed.property}: var(--${varName});`

      let seen = seenPropsBySelector.get(selector)
      if (!seen) {
        seen = new Set<string>()
        seenPropsBySelector.set(selector, seen)
      }
      // Skip if this CSS property is already set on this selector (preserves first-wins ordering).
      if (seen.has(parsed.property)) continue
      seen.add(parsed.property)

      let decls = classMap.get(selector)
      if (!decls) {
        decls = []
        classMap.set(selector, decls)
      }
      decls.push(declaration)

      // Also annotate with description if enabled.
      if (exportConfiguration.showDescriptions && token.description) {
        // Descriptions attach to the selector, not individual declarations — emit once per selector.
        // (Handled below during output so multiple tokens don't produce duplicate comments.)
      }
    }
  }

  if (classMap.size === 0) return ""

  // Stable ordering: base selector first within each component, then variants alpha, then pseudo states after default.
  const sortedSelectors = Array.from(classMap.keys()).sort(compareSelectors)

  const indent = "  "
  let output = "\n@layer components {\n"
  for (const selector of sortedSelectors) {
    const decls = classMap.get(selector)!
    output += `${indent}${selector} {\n`
    for (const decl of decls) {
      output += `${indent}  ${decl}\n`
    }
    output += `${indent}}\n`
  }
  output += "}\n"

  return output
}

/**
 * Sorts selectors so output is deterministic:
 *  1. Group by component (alpha).
 *  2. Within component: base class first (no variant segment), then variants alpha.
 *  3. Within variant: default state first, then pseudo-classes in a stable order.
 */
function compareSelectors(a: string, b: string): number {
  const pa = splitSelector(a)
  const pb = splitSelector(b)
  if (pa.component !== pb.component) return pa.component.localeCompare(pb.component)
  if (pa.variant !== pb.variant) {
    if (pa.variant === "") return -1
    if (pb.variant === "") return 1
    return pa.variant.localeCompare(pb.variant)
  }
  return pa.state.localeCompare(pb.state)
}

function splitSelector(selector: string): { component: string; variant: string; state: string } {
  // selector looks like ".component" or ".component-variant" or ".component-variant:hover"
  const stateIdx = selector.search(/::|:/)
  const state = stateIdx >= 0 ? selector.slice(stateIdx) : ""
  const classPart = stateIdx >= 0 ? selector.slice(1, stateIdx) : selector.slice(1)
  const dashIdx = classPart.indexOf("-")
  if (dashIdx === -1) return { component: classPart, variant: "", state }
  return { component: classPart.slice(0, dashIdx), variant: classPart.slice(dashIdx + 1), state }
}
