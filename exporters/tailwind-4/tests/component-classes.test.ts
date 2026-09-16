import { describe, test, expect } from "@jest/globals"
import { ColorFormat } from "@supernovaio/export-utils"
import { ColorTokenValue, Token, TokenGroup, TokenType, Unit } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration, FileStructure, FindReplaceTiming, ThemeExportStyle } from "../config"

const baseConfig = {
  showGeneratedFileDisclaimer: false,
  disclaimer: "",
  generateEmptyFiles: false,
  showDescriptions: false,
  useReferences: true,
  colorFormat: ColorFormat.smartOklch,
  colorPrecision: 3,
  indent: 2,
  tokenPrefixes: {} as any,
  styleFileNames: {} as any,
  baseStyleFilePath: "./base",
  cssSelector: "@theme",
  themeSelector: ".theme-{theme}",
  rootIndirectionForColors: false,
  rootIndirectionPrefix: "ds",
  exportThemesAs: ThemeExportStyle.SeparateFiles,
  exportOnlyThemedTokens: false,
  exportBaseValues: true,
  forceRemUnit: false,
  remBase: 16,
  customizeStyleFileNames: false,
  globalPrefix: "",
  useColorUtilityPrefixes: false,
  colorUtilityPrefixes: {} as any,
  findReplaceTiming: FindReplaceTiming.BeforePrefix,
  findReplace: {},
  fileStructure: FileStructure.SingleFile,
  generateEmptyConfigTypeFiles: false,
  generateTypographyClasses: false,
  generateComponentClasses: true,
  componentGroupsToGenerate: "alert,button,badge,field,switch,tooltip",
  useTailwindUtilityAPI: false,
  debug: false,
} as unknown as ExporterConfiguration

const mockConfig = { ...baseConfig }

jest.mock("../src/index", () => ({
  get exportConfiguration() {
    return mockConfig
  },
}))

const setConfig = (overrides: Partial<ExporterConfiguration>) => {
  Object.keys(mockConfig).forEach((key) => delete (mockConfig as any)[key])
  Object.assign(mockConfig, baseConfig, overrides)
}

// Import AFTER mock setup
const { generateComponentClasses } =
  require("../src/content/component") as typeof import("../src/content/component")

const colorGroup: TokenGroup = {
  id: "group-color",
  name: TokenType.color,
  isRoot: true,
  path: [],
  parentGroupId: null,
  tokenType: TokenType.color,
  childrenIds: [],
  tokenIds: [],
} as unknown as TokenGroup

const tokenGroups: Array<TokenGroup> = [colorGroup]

const rawColor = (r: number, g: number, b: number): ColorTokenValue => ({
  color: { r, g, b, referencedTokenId: null },
  opacity: { measure: 1, unit: Unit.raw, referencedTokenId: null },
  referencedTokenId: null,
})

/**
 * A color token whose flattened `name` already IS the full post-prefix path (mirrors how the
 * real token set's `--color-job-tree-badge-bg` etc. resolve — see `tests/fixtures/tokens.ts`'s
 * `action-primary-bg` precedent: with an empty-path parent group, `tokenVariableName` becomes
 * exactly `<prefix>-<name>`).
 */
const colorToken = (name: string): Token =>
  ({
    id: `c-${name}`,
    idInVersion: `c-${name}`,
    name,
    description: "",
    tokenType: TokenType.color,
    parentGroupId: "group-color",
    value: rawColor(0, 0, 0),
    origin: null,
    properties: [],
    propertyValues: {},
  } as unknown as Token)

/**
 * A color token with a REAL nested `tokenPath` (ancestor group names) rather than a
 * pre-flattened `name` — the shape `useColorUtilityPrefixes` actually reads from
 * (`[...tokenPath, name].join('/')`) to decide the utility prefix, and the shape that broke
 * under the old prefix-length-guessing anchor: the guessed anchor pointed at the wrong offset
 * once a color token's variable name stopped starting with the plain `color-` prefix.
 */
const nestedColorToken = (id: string, tokenPath: string[], name: string): Token =>
  ({
    id,
    idInVersion: id,
    name,
    description: "",
    tokenType: TokenType.color,
    tokenPath,
    parentGroupId: "group-color",
    value: rawColor(0, 0, 0),
    origin: null,
    properties: [],
    propertyValues: {},
  } as unknown as Token)

describe("component classes — the six shipped components still generate correctly", () => {
  test("alert: variant + property parse as before", () => {
    const css = generateComponentClasses([colorToken("alert-success-bg")], tokenGroups)
    expect(css).toMatch(/\.alert-success \{\s*background-color: var\(--color-alert-success-bg\);\s*\}/)
  })

  test("button: variant + property parse as before", () => {
    const css = generateComponentClasses([colorToken("button-primary-bg")], tokenGroups)
    expect(css).toMatch(/\.button-primary \{\s*background-color: var\(--color-button-primary-bg\);\s*\}/)
  })

  test("badge: variant + property parse as before", () => {
    const css = generateComponentClasses([colorToken("badge-neutral-bg")], tokenGroups)
    expect(css).toMatch(/\.badge-neutral \{\s*background-color: var\(--color-badge-neutral-bg\);\s*\}/)
  })

  test("field: base (no-variant) selector parses as before", () => {
    const css = generateComponentClasses([colorToken("field-border")], tokenGroups)
    expect(css).toMatch(/\.field \{\s*border-color: var\(--color-field-border\);\s*\}/)
  })

  test("switch: variant + property parse as before", () => {
    const css = generateComponentClasses([colorToken("switch-thumb-bg")], tokenGroups)
    expect(css).toMatch(/\.switch-thumb \{\s*background-color: var\(--color-switch-thumb-bg\);\s*\}/)
  })

  test("tooltip: base (no-variant) selector parses as before", () => {
    const css = generateComponentClasses([colorToken("tooltip-bg")], tokenGroups)
    expect(css).toMatch(/\.tooltip \{\s*background-color: var\(--color-tooltip-bg\);\s*\}/)
  })
})

describe("component classes — namespace anchoring (PR #353 job-tree/badge regression)", () => {
  const jobTreeBadgeTokens = [
    colorToken("job-tree-badge-bg"),
    colorToken("job-tree-badge-border"),
    colorToken("job-tree-badge-text"),
  ]

  test("an unrelated deeper-nested group sharing a configured component's name is NOT absorbed into it", () => {
    const css = generateComponentClasses(jobTreeBadgeTokens, tokenGroups)
    // The bare `.badge` base selector must stay untouched by Job Tree's own "badge" sub-group.
    expect(css).not.toMatch(/--color-job-tree-badge-bg/)
    expect(css).not.toMatch(/--color-job-tree-badge-border/)
    expect(css).not.toMatch(/--color-job-tree-badge-text/)
    expect(css).not.toMatch(/\.badge \{[^}]*job-tree/)
  })

  test("job-tree/badge/request does not create .badge-request either — 'badge' still isn't the leading segment", () => {
    // The real PR #353 output actually shipped this exact bogus rule:
    //   .badge-request { background-color: var(--color-job-tree-badge-request-bg); color: var(--color-job-tree-badge-request-text); }
    // Its domain path is ["job", "tree", "badge", "request", "bg"] — "badge" is still the THIRD
    // segment, not the first, so the anchored "badge" component must not claim it at all, no
    // matter how deep "badge" sits or what suffix follows it.
    const css = generateComponentClasses(
      [colorToken("job-tree-badge-request-bg"), colorToken("job-tree-badge-request-text")],
      tokenGroups
    )
    expect(css).not.toMatch(/\.badge-request/)
    expect(css).not.toMatch(/--color-job-tree-badge-request-bg/)
    expect(css).not.toMatch(/--color-job-tree-badge-request-text/)
  })

  test("a real badge token in the same run is still emitted under .badge-neutral, unaffected by the near-miss", () => {
    const css = generateComponentClasses([...jobTreeBadgeTokens, colorToken("badge-neutral-bg")], tokenGroups)
    expect(css).toMatch(/\.badge-neutral \{\s*background-color: var\(--color-badge-neutral-bg\);\s*\}/)
  })

  test("registering 'job-tree' as its own component group correctly scopes it to .job-tree-badge, not .badge", () => {
    setConfig({ componentGroupsToGenerate: "alert,button,badge,field,switch,tooltip,job-tree" })
    const css = generateComponentClasses(jobTreeBadgeTokens, tokenGroups)
    expect(css).toMatch(/\.job-tree-badge \{/)
    expect(css).toMatch(/background-color: var\(--color-job-tree-badge-bg\);/)
    expect(css).toMatch(/border-color: var\(--color-job-tree-badge-border\);/)
    expect(css).toMatch(/color: var\(--color-job-tree-badge-text\);/)
    // Still must not leak into the unrelated, separately-configured "badge" component.
    expect(css).not.toMatch(/\.badge \{[^}]*job-tree/)
  })
})

describe("component classes — useColorUtilityPrefixes (real-world regression: button/badge/etc. vanished entirely)", () => {
  const utilityPrefixConfig = {
    useColorUtilityPrefixes: true,
    colorUtilityPrefixes: {
      bg: "background,bg",
      text: "foreground,text",
      border: "border",
      shadow: "shadow",
      ring: "ring",
      outline: "outline",
      stroke: "stroke",
      fill: "fill",
    },
  }

  test("a component's background color still resolves when useColorUtilityPrefixes renames it to bg-color-*", () => {
    setConfig(utilityPrefixConfig)
    const css = generateComponentClasses(
      [nestedColorToken("c-button-primary-bg", ["Button", "Primary"], "bg")],
      tokenGroups
    )
    // The old prefix-length-guessing anchor assumed every color token's variable name starts
    // with the plain `color-` prefix (1 segment) — under useColorUtilityPrefixes it doesn't
    // (it becomes `bg-color-...`), so the guessed anchor pointed at the wrong segment and this
    // selector silently stopped being generated at all.
    expect(css).toMatch(/\.button-primary \{\s*background-color: var\(--[a-z0-9-]+\);\s*\}/)
  })

  test("badge, alert and field variants all still resolve under useColorUtilityPrefixes, not just button", () => {
    setConfig({ ...utilityPrefixConfig, componentGroupsToGenerate: "alert,button,badge,field,switch,tooltip" })
    const css = generateComponentClasses(
      [
        nestedColorToken("c-badge-neutral-bg", ["Badge", "Neutral"], "bg"),
        nestedColorToken("c-alert-success-bg", ["Alert", "Success"], "bg"),
        nestedColorToken("c-field-border", ["Field"], "border"),
      ],
      tokenGroups
    )
    expect(css).toMatch(/\.badge-neutral \{\s*background-color: var\(--[a-z0-9-]+\);\s*\}/)
    expect(css).toMatch(/\.alert-success \{\s*background-color: var\(--[a-z0-9-]+\);\s*\}/)
    expect(css).toMatch(/\.field \{\s*border-color: var\(--[a-z0-9-]+\);\s*\}/)
  })

  test("job-tree/badge anchoring still holds under useColorUtilityPrefixes too", () => {
    setConfig(utilityPrefixConfig)
    const css = generateComponentClasses(
      [nestedColorToken("c-job-tree-badge-bg", ["Job Tree", "Badge"], "bg")],
      tokenGroups
    )
    expect(css).not.toMatch(/\.badge \{[^}]*\}/)
  })
})

describe("component classes — real production config (from the live Supernova pipeline settings)", () => {
  // Exact values read from the pipeline's own "Edit pipeline - Configuration" screen.
  const PRODUCTION_COMPONENT_GROUPS =
    "button,alert,badge,tag,field,switch,tooltip,chip,modal,spinner,datepicker,tab,radio,checkbox," +
    "avatar,lula-table,activity-log,navigation,notification,stepper,segmented-control,card,tabs,chat," +
    "navbar,menu,empty-state,toast,breadcrumb,rating,divider,skeleton,file-upload,job-tree"

  const PRODUCTION_FIND_REPLACE = {
    "--z-": "--z-index-",
    "-table-": "-lula-table-",
    "--duration-": "--transition-duration-",
    "--text-code": "--typography-code",
    "--text-body-": "--typography-body-",
    "--text-label-": "--typography-label-",
    "--font-family-": "--font-",
    "--text-button-": "--typography-button-",
    "--text-caption": "--typography-caption",
    "--border-width-": "--border-",
    "--text-display-": "--typography-display-",
    "--text-heading-": "--typography-heading-",
    "@theme inline {": "@theme {",
    "--text-font-size-": "--text-",
    "--font-weight-font-weight-": "--font-weight-",
  }

  const productionConfig = {
    useColorUtilityPrefixes: false, // toggle read "unchecked" on the live pipeline
    rootIndirectionForColors: true, // toggle read "checked"
    useTailwindUtilityAPI: true, // toggle read "checked"
    findReplaceTiming: FindReplaceTiming.AfterPrefix, // combobox read "After prefix is added"
    findReplace: PRODUCTION_FIND_REPLACE,
    componentGroupsToGenerate: PRODUCTION_COMPONENT_GROUPS,
  }

  test("'Table' domain tokens still match the configured 'lula-table' component via the find/replace branding rule", () => {
    setConfig(productionConfig)
    const css = generateComponentClasses(
      [colorToken("table-row-bg")], // domain path ["table", "row", "bg"] pre-find-replace
      tokenGroups
    )
    // Without applying find/replace to the domain, "table" != "lula-table" and this silently
    // stops matching — exactly the kind of regression a config-mismatched local test would miss.
    // The var() reference is renamed the same way (tokenVariableName applies the same rule to
    // the flattened name), so both the selector and the declaration read "lula-table".
    expect(css).toMatch(/\.lula-table-row \{\s*background-color: var\(--color-lula-table-row-bg\);\s*\}/)
    expect(css).not.toMatch(/\.table\b/)
  })

  test("job-tree/badge is fully clean under the exact real production config, 'job-tree' included in the list", () => {
    setConfig(productionConfig)
    const css = generateComponentClasses(
      [
        colorToken("job-tree-badge-bg"),
        colorToken("job-tree-badge-border"),
        colorToken("job-tree-badge-text"),
        colorToken("job-tree-badge-request-bg"),
        colorToken("job-tree-badge-request-text"),
      ],
      tokenGroups
    )
    // Now that "job-tree" is itself configured, its own tokens get their own correctly-scoped
    // classes — and the pre-existing "badge" component stays completely untouched by them.
    expect(css).toMatch(/\.job-tree-badge \{/)
    expect(css).toMatch(/\.job-tree-badge-request \{/)
    expect(css).not.toMatch(/\.badge \{[^}]*\}/)
    expect(css).not.toMatch(/\.badge-request/)
  })
})
