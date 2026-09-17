import { Token, TokenGroup } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { applyFindReplace, tokenVariableName } from "./token"

/**
 * Component-level @layer components emission.
 *
 * Maps token variable names like `--color-alert-success-bg` and `--spacing-alert-padding-x`
 * to CSS classes like `.alert-success { background-color: var(--color-alert-success-bg) }`
 * inside `@layer components { ... }`.
 *
 * Detection is driven by a token's own DOMAIN PATH — its ancestor group names plus its own name
 * (`token.tokenPath` + `token.name`), the same raw material `tokenVariableName` itself builds a
 * name from, but read here BEFORE any prefix or naming-scheme formatting is applied. For each
 * configured component name (e.g. "alert"), we require it to be the FIRST segment(s) of that
 * domain path — e.g. domain path `["alert", "success", "bg"]` matches component `alert` (tail
 * `success-bg`), but `["job-tree", "badge", "bg"]` (a "badge" sub-group nested under an unrelated
 * "job-tree" group) does not match component `badge` — its first segment is `job-tree`, not
 * `badge`. The tail after the component segment is then parsed into `<variant>-<property>-<state>`
 * using the mapping tables below.
 *
 * Matching on the pre-prefix domain path (rather than the final flattened variable name) is
 * deliberate: the flattened name's own prefix varies by token type and by config — `color`,
 * `font-weight` (two segments), or an entirely different scheme when `useColorUtilityPrefixes` is
 * on (`bg-color-`, `text-color-`, …). Anchoring against a *guessed* prefix length broke every
 * color-derived class the moment `useColorUtilityPrefixes` was enabled (color tokens never even
 * reached their component's segment, since the guessed anchor pointed at the wrong offset).
 * Reading the domain path directly sidesteps prefix formatting entirely, so it holds regardless of
 * which naming scheme produced the final variable name.
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

/** Trailing variant keywords treated as Tailwind-breakpoint-style size variants (e.g. `size-md`, `radio-lg`). */
const SIZE_VARIANT_KEYWORDS = new Set(["sm", "md", "lg"])

/**
 * A variant is a "size" variant (eligible for @utility promotion) when its last
 * path segment is exactly `sm`, `md`, or `lg` — regardless of component or the
 * rest of the variant path (e.g. "size-md", "radio-lg" both qualify).
 */
function isSizeVariant(variant: string): boolean {
  if (!variant) return false
  const lastSegment = variant.slice(variant.lastIndexOf("-") + 1)
  return SIZE_VARIANT_KEYWORDS.has(lastSegment)
}

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
 * A token's domain path — its ancestor group names plus its own name — split into lowercase
 * word segments, BEFORE any type prefix is applied. This is the same raw material
 * `tokenVariableName` itself starts from (`token.tokenPath` + `token.name`; see
 * `generateDebugInfo`'s identical `[...tokenPath, token.name]` construction in `token.ts`), read
 * here directly so component matching never has to know or guess how the final variable name's
 * prefix was built.
 *
 * `findReplace` IS applied here, though — unlike the prefix, it can rename the domain itself.
 * E.g. this design system's own `"-table-": "-lula-table-"` rule means the "Table" Figma group's
 * tokens are meant to be matched as component `lula-table` (the configured name), not `table` —
 * skipping this step would silently stop matching that component's real tokens the moment this
 * fix landed. Applying it to the domain-only string is safe regardless of `findReplaceTiming`:
 * every OTHER configured pattern here (`--z-`, `--duration-`, `--text-body-`, …) is anchored to a
 * type prefix, which never appears in this domain-only string in the first place, so those are a
 * no-op here rather than a source of drift.
 *
 * Adjacent duplicate segments are collapsed BEFORE find-replace runs — a Figma group nested
 * under a same-named parent (e.g. a "Table" root containing its own "Table" sub-group for the
 * literal `<table>` element, distinct from its Head/Row/Cell siblings) produces a raw domain like
 * `["table", "table", "gap"]`. `NamingHelper.codeSafeVariableName`'s own `removeDuplicateFragments`
 * (on by default, applied to the real variable name) already collapses that pair — verified
 * empirically: the real token name is `spacing-lula-table-gap` (one "table"), never
 * `spacing-lula-table-table-gap`. Without doing the same collapse here, domain matching sees the
 * extra segment the real name already silently drops and emits a selector like
 * `.lula-table-table` that doesn't correspond to anything a consumer would ever write.
 */
function tokenDomainSegments(token: Token): string[] {
  const path = ((token as { tokenPath?: string[] }).tokenPath || []) as string[]
  const rawSegments = [...path, token.name]
    .flatMap((fragment) => String(fragment).split(/[\s_-]+/))
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment.length > 0)
    .filter((segment, index, all) => index === 0 || segment !== all[index - 1])

  const replaced = applyFindReplace(rawSegments.join("-"), exportConfiguration.findReplace)
  return replaced
    .split("-")
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment.length > 0)
}

/**
 * Finds the portion of a token's domain path after `<componentName>`, but ONLY when
 * `componentName` is the run of segments at the very START of that domain path — e.g. for
 * `componentName = "badge"`, domain path `["badge", "neutral", "bg"]` matches (tail
 * `neutral-bg`) but `["job-tree", "badge", "bg"]` does not (its first segment is `job-tree`, part
 * of the unrelated `job-tree` group, not `badge`).
 *
 * Returns null if the component does not occupy that leading run of segments.
 */
function extractTail(domainSegments: string[], componentName: string): string | null {
  const comp = componentName.toLowerCase()
  const compSegments = comp.split("-")

  if (domainSegments.length < compSegments.length) return null
  if (domainSegments.slice(0, compSegments.length).join("-") !== comp) return null
  return domainSegments.slice(compSegments.length).join("-")
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
  // Size-variant (sm/md/lg) selectors promoted to @utility so they work with Tailwind variants (md:, hover:, etc.)
  const utilityMap = new Map<string, string[]>()
  // Track declaration order so we can dedupe by property, keeping the first occurrence per selector.
  const seenPropsBySelector = new Map<string, Set<string>>()

  // Pre-compute variable names and domain-path segments once per token.
  const resolvedNames = tokens.map((t) => ({
    token: t,
    varName: tokenVariableName(t, tokenGroups),
    domainSegments: tokenDomainSegments(t),
  }))

  for (const componentName of components) {
    for (const { token, varName, domainSegments } of resolvedNames) {
      const tail = extractTail(domainSegments, componentName)
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

      // Size variants (sm/md/lg) go to @utility so they compose with Tailwind variants; states never promote.
      const promoteToUtility =
        exportConfiguration.useTailwindUtilityAPI && parsed.state === "" && isSizeVariant(parsed.variant)
      const targetMap = promoteToUtility ? utilityMap : classMap

      let decls = targetMap.get(selector)
      if (!decls) {
        decls = []
        targetMap.set(selector, decls)
      }
      decls.push(declaration)
    }
  }

  if (classMap.size === 0 && utilityMap.size === 0) return ""

  const indent = "  "
  let output = ""

  // Size-variant classes promoted to @utility, one top-level block per class.
  if (utilityMap.size > 0) {
    const sortedUtilitySelectors = Array.from(utilityMap.keys()).sort(compareSelectors)
    for (const selector of sortedUtilitySelectors) {
      const decls = utilityMap.get(selector)!
      const utilityName = selector.slice(1) // strip leading '.'
      output += `\n@utility ${utilityName} {\n`
      for (const decl of decls) {
        output += `${indent}${decl}\n`
      }
      output += "}\n"
    }
  }

  if (classMap.size > 0) {
    // Stable ordering: base selector first within each component, then variants alpha, then pseudo states after default.
    const sortedSelectors = Array.from(classMap.keys()).sort(compareSelectors)

    output += "\n@layer components {\n"
    for (const selector of sortedSelectors) {
      const decls = classMap.get(selector)!
      output += `${indent}${selector} {\n`
      for (const decl of decls) {
        output += `${indent}  ${decl}\n`
      }
      output += `${indent}}\n`
    }
    output += "}\n"
  }

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
