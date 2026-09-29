import { describe, test, expect, beforeEach } from "@jest/globals"
import { ColorFormat } from "@supernovaio/export-utils"
import { SpaceToken, Token, TokenGroup, TokenType, Unit } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration, FileStructure, ThemeExportStyle } from "../config"

/**
 * Figma component variables such as avatar-stack/gap (-6), badge/count/offset-x (-6) and
 * menu/offset-y (-8) are negative by design. The exporter must emit the sign unchanged —
 * a 0px in the generated CSS means the value was already 0 when it reached the exporter.
 */

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
const { styleOutputFile } =
  require("../src/files/tailwind-file") as typeof import("../src/files/tailwind-file")

const tokenGroups: Array<TokenGroup> = [
  {
    id: `group-${TokenType.space}`,
    name: TokenType.space,
    isRoot: true,
    path: [],
    parentGroupId: null,
    tokenType: TokenType.space,
    childrenIds: [],
    tokenIds: [],
  } as unknown as TokenGroup,
]

const makeSpace = (id: string, name: string, measure: number, referencedTokenId: string | null = null): SpaceToken =>
  ({
    id,
    idInVersion: id,
    name,
    description: "",
    tokenType: TokenType.space,
    parentGroupId: `group-${TokenType.space}`,
    value: { measure, unit: Unit.pixels, referencedTokenId },
    origin: null,
    properties: [],
    propertyValues: {},
    tokenPath: [],
  } as unknown as SpaceToken)

const avatarStackGap = makeSpace("sp-avatar-stack-gap", "avatar-stack-gap", -6)
const menuOffsetY = makeSpace("sp-menu-offset-y", "menu-offset-y", -8)
const badgeDotOffsetX = makeSpace("sp-badge-dot-offset-x", "badge-dot-offset-x", -2.5)
const zeroSpace = makeSpace("sp-space-0", "space-0", 0)
const aliasToNegative = makeSpace("sp-alias", "stack-overlap", 0, "sp-avatar-stack-gap")

const generate = (tokens: Array<Token>): string => {
  const file = styleOutputFile(tokens, tokenGroups, "", undefined)
  return file ? file.content : ""
}

describe("negative dimension tokens keep their sign", () => {
  beforeEach(() => setConfig({}))

  test("negative px values are emitted as negative px", () => {
    const css = generate([avatarStackGap, menuOffsetY])
    expect(css).toMatch(/avatar-stack-gap:\s*-6px;/)
    expect(css).toMatch(/menu-offset-y:\s*-8px;/)
  })

  test("fractional negatives survive rounding", () => {
    const css = generate([badgeDotOffsetX])
    expect(css).toMatch(/badge-dot-offset-x:\s*-2\.5px;/)
  })

  test("forceRemUnit converts negatives without dropping the sign", () => {
    setConfig({ forceRemUnit: true, remBase: 16 })
    const css = generate([avatarStackGap])
    expect(css).toMatch(/avatar-stack-gap:\s*-0\.375rem;/)
  })

  test("zero stays zero and is not confused with a clamped negative", () => {
    const css = generate([zeroSpace, avatarStackGap])
    expect(css).toMatch(/space-0:\s*0px;/)
    expect(css).not.toMatch(/avatar-stack-gap:\s*0px;/)
  })

  test("an alias to a negative token references it instead of inlining 0", () => {
    const css = generate([avatarStackGap, aliasToNegative])
    expect(css).toMatch(/stack-overlap:\s*var\(--[a-z-]*avatar-stack-gap\);/)
  })
})
