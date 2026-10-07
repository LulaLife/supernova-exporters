import { describe, test, expect } from "@jest/globals"
import { ColorFormat } from "@supernovaio/export-utils"
import { Token, TokenGroup, TokenType, Unit } from "@supernovaio/sdk-exporters"
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
  tokenPrefixes: { [TokenType.typography]: "text" } as any,
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
  generateTypographyClasses: true,
  generateComponentClasses: false,
  componentGroupsToGenerate: "",
  useTailwindUtilityAPI: false,
  debug: false,
} as unknown as ExporterConfiguration

const mockConfig = { ...baseConfig }

jest.mock("../src/index", () => ({
  get exportConfiguration() {
    return mockConfig
  },
}))

// Import AFTER mock setup
const { generateTypographyClass } =
  require("../src/content/typography") as typeof import("../src/content/typography")

const typographyGroup: TokenGroup = {
  id: "group-typography",
  name: TokenType.typography,
  isRoot: true,
  path: [],
  parentGroupId: null,
  tokenType: TokenType.typography,
  childrenIds: [],
  tokenIds: [],
} as unknown as TokenGroup

const tokenGroups: Array<TokenGroup> = [typographyGroup]

/** A typography token shaped like the real `Desktop/Heading/sm-base` style. */
const typographyToken = (tokenPath: string[], name: string): Token =>
  ({
    id: `t-${name}`,
    idInVersion: `t-${name}`,
    name,
    description: "",
    tokenType: TokenType.typography,
    tokenPath,
    parentGroupId: "group-typography",
    value: {
      fontFamily: null,
      lineHeight: { measure: 24, unit: Unit.pixels, referencedTokenId: null },
      paragraphSpacing: { measure: 0, unit: Unit.pixels, referencedTokenId: null },
      referencedTokenId: null,
    },
    origin: null,
    properties: [],
    propertyValues: {},
  } as unknown as Token)

const token = typographyToken(["desktop", "heading"], "sm-base")

describe("typography classes", () => {
  test("default: a plain class rule for @layer components (unchanged behaviour)", () => {
    const css = generateTypographyClass(token, tokenGroups)!
    expect(css).toMatch(/^  \.desktop-heading-sm-base \{\n/)
    expect(css).toMatch(/\n    font-size: var\(--[a-z-]+\);\n/)
    expect(css).toMatch(/\n    line-height: var\(--[a-z-]+--line-height\);\n/)
    expect(css).toMatch(/\n  \}\n$/)
    expect(css).not.toContain("@utility")
  })

  test("asUtility: a top-level @utility block with the same name and declarations", () => {
    const plain = generateTypographyClass(token, tokenGroups)!
    const utility = generateTypographyClass(token, tokenGroups, true)!
    expect(utility).toMatch(/^@utility desktop-heading-sm-base \{\n/)
    expect(utility).toMatch(/\n\}\n$/)
    expect(utility).not.toMatch(/^\s*\./m)

    // Same declarations, only the wrapper and indentation differ — so existing consumers of the
    // class keep identical styles.
    const declarations = (css: string) =>
      css.split("\n").map((l) => l.trim()).filter((l) => l.endsWith(";"))
    expect(declarations(utility)).toEqual(declarations(plain))
    expect(declarations(utility).length).toBeGreaterThan(0)
  })

  test("non-typography tokens are still skipped in either mode", () => {
    const notTypography = { ...token, tokenType: TokenType.color } as unknown as Token
    expect(generateTypographyClass(notTypography, tokenGroups, true)).toBeNull()
    expect(generateTypographyClass(notTypography, tokenGroups)).toBeNull()
  })
})
