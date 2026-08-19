import { describe, test, expect, beforeEach } from "@jest/globals"
import { ColorFormat } from "@supernovaio/export-utils"
import { ExporterConfiguration, FileStructure, ThemeExportStyle } from "../config"
import {
  tokenGroups,
  colorTokens,
  tokensWithLeafShadow,
  tokensWithAliasShadow,
} from "./fixtures/tokens"

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
  rootIndirectionForColors: true,
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
  findReplace: {},
  fileStructure: FileStructure.SingleFile,
  generateEmptyConfigTypeFiles: false,
  generateTypographyClasses: false,
  generateComponentClasses: false,
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
const { styleOutputFile, generateStyleFiles } =
  require("../src/files/tailwind-file") as typeof import("../src/files/tailwind-file")

const generate = (tokens = colorTokens, themePath = "", theme?: any): string => {
  const file = styleOutputFile(tokens, tokenGroups, themePath, theme)
  return file ? file.content : ""
}

/** Everything between `:root {` and its closing brace. */
const rootBlock = (css: string): string => {
  const start = css.indexOf(":root {")
  if (start === -1) return ""
  return css.slice(start, css.indexOf("\n}", start))
}

/** Everything inside the `@theme`/`@theme inline` block. */
const themeBlock = (css: string): string => {
  const match = css.match(/@theme[^{]*\{/)
  if (!match) return ""
  const start = css.indexOf(match[0])
  return css.slice(start)
}

describe("root indirection — the :root alias block", () => {
  beforeEach(() => setConfig({}))

  test("leaf color tokens get a :root alias carrying the raw value", () => {
    const css = generate()
    expect(rootBlock(css)).toMatch(/--ds-color-palette-brand-500:\s*oklch\(/)
    expect(rootBlock(css)).toMatch(/--ds-color-palette-white:\s*oklch\(/)
  })

  test("alias/semantic tokens do NOT get a :root entry — they chain via var()", () => {
    const css = generate()
    expect(rootBlock(css)).not.toMatch(/action-primary-bg/)
    expect(themeBlock(css)).toMatch(/--color-action-primary-bg:\s*var\(--color-palette-brand-500\)/)
  })

  test("the theme token points at its alias, never at itself", () => {
    const css = generate()
    expect(themeBlock(css)).toMatch(/--color-palette-brand-500:\s*var\(--ds-color-palette-brand-500\)/)
    // The self-reference this design exists to avoid: --color-x: var(--color-x)
    expect(css).not.toMatch(/--color-palette-brand-500:\s*var\(--color-palette-brand-500\)/)
  })

  test("every :root alias has exactly one matching theme token, and vice versa (drift guard)", () => {
    const css = generate(tokensWithLeafShadow)
    const aliases = [...rootBlock(css).matchAll(/--ds-([a-z0-9-]+):/g)].map((m) => m[1]).sort()
    const pointers = [...themeBlock(css).matchAll(/--([a-z0-9-]+):\s*var\(--ds-([a-z0-9-]+)\)/g)]
    // Each pointer must target its own name — that is what makes the pairing 1:1
    pointers.forEach(([, tokenName, aliasName]) => expect(aliasName).toBe(tokenName))
    expect(pointers.map((m) => m[2]).sort()).toEqual(aliases)
  })

  test("the :root block precedes @theme, and @import stays the first rule", () => {
    const css = generate()
    expect(css.indexOf('@import "tailwindcss"')).toBe(0)
    expect(css.indexOf(":root {")).toBeLessThan(css.search(/@theme/))
  })

  test("the alias prefix is configurable", () => {
    setConfig({ rootIndirectionPrefix: "acme" })
    const css = generate()
    expect(rootBlock(css)).toMatch(/--acme-color-palette-brand-500:/)
    expect(themeBlock(css)).toMatch(/var\(--acme-color-palette-brand-500\)/)
  })

  test("an empty prefix falls back to the default rather than recreating a self-reference", () => {
    setConfig({ rootIndirectionPrefix: "  " })
    const css = generate()
    expect(css).not.toMatch(/--color-palette-brand-500:\s*var\(--color-palette-brand-500\)/)
    expect(rootBlock(css)).toMatch(/--ds-color-palette-brand-500:/)
  })
})

describe("root indirection — when it must not apply", () => {
  beforeEach(() => setConfig({}))

  test("flag off → no :root block, output unchanged", () => {
    setConfig({ rootIndirectionForColors: false })
    const css = generate()
    expect(css).not.toMatch(/:root \{/)
    expect(themeBlock(css)).toMatch(/--color-palette-brand-500:\s*oklch\(/)
  })

  test("useReferences off → skipped, and says so instead of silently doing nothing", () => {
    setConfig({ useReferences: false })
    const css = generate()
    expect(css).not.toMatch(/:root \{/)
    expect(css).toMatch(/skipped — requires "Use token references"/)
  })

  test("a non-@theme selector is left alone", () => {
    setConfig({ cssSelector: ":root" })
    const css = generate()
    // Only the selector's own block — no separate alias block bolted on
    expect(css).not.toMatch(/--ds-color-/)
  })

  test("theme files get no alias block (the base file owns it)", () => {
    const css = generate(colorTokens, "dark", { id: "dark" } as any)
    expect(css).not.toMatch(/:root \{/)
    expect(css).toMatch(/\.theme-dark \{/)
  })
})

describe("root indirection — OKLCH channel variables for custom-opacity colors", () => {
  beforeEach(() => setConfig({}))

  test("a shadow tinting a LEAF color derives channels from the alias at runtime", () => {
    const css = generate(tokensWithLeafShadow)
    expect(css).toMatch(/--oklch-color-palette-brand-500:\s*from var\(--ds-color-palette-brand-500\) l c h/)
    // and it is consumed as relative color syntax
    expect(css).toMatch(/oklch\(var\(--oklch-color-palette-brand-500\)\s*\/\s*[\d.]+\)/)
  })

  test("a shadow tinting an ALIAS color keeps a baked value — the alias has no :root entry", () => {
    const css = generate(tokensWithAliasShadow)
    expect(css).toMatch(/--oklch-color-action-primary-bg:/)
    // Must NOT point at a --ds- alias that was never emitted
    expect(css).not.toMatch(/--oklch-color-action-primary-bg:\s*from var\(/)
  })

  test("non-OKLCH color formats never emit relative color syntax (rgba has no l c h form)", () => {
    setConfig({ colorFormat: ColorFormat.rgba })
    const css = generate(tokensWithLeafShadow)
    expect(css).not.toMatch(/from var\(/)
  })

  test("flag off → channel variables bake their value, as before", () => {
    setConfig({ rootIndirectionForColors: false })
    const css = generate(tokensWithLeafShadow)
    expect(css).toMatch(/--oklch-color-palette-brand-500:/)
    expect(css).not.toMatch(/from var\(/)
  })
})

describe("root indirection — separateByType file structure", () => {
  beforeEach(() => setConfig({ fileStructure: FileStructure.SeparateByType }))

  test("the color file still gets its alias block (not a silent no-op)", () => {
    const files = generateStyleFiles(colorTokens, tokenGroups)
    const colorFile = files.find((f) => f.content.includes("--color-palette-brand-500"))
    expect(colorFile).toBeDefined()
    expect(colorFile!.content).toMatch(/:root \{/)
    expect(colorFile!.content).toMatch(/--ds-color-palette-brand-500:/)
    expect(colorFile!.content).toMatch(/--color-palette-brand-500:\s*var\(--ds-color-palette-brand-500\)/)
  })
})

describe("root indirection — descriptions", () => {
  test("the description sits on the alias only, not duplicated onto the pointer", () => {
    setConfig({ showDescriptions: true })
    const css = generate()
    const occurrences = css.split("Brand blue primitive — step 500.").length - 1
    expect(occurrences).toBe(1)
    expect(rootBlock(css)).toMatch(/Brand blue primitive/)
  })
})
