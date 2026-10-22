import { describe, test, expect } from "@jest/globals"
import { ColorFormat } from "@supernovaio/export-utils"
import { Token } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration, FileStructure, ThemeExportStyle } from "../config"
import { tokenGroups, tokensWithLeafShadow, makeColor, rawColor } from "./fixtures/tokens"

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

// Import AFTER mock setup
const { styleOutputFile } =
  require("../src/files/tailwind-file") as typeof import("../src/files/tailwind-file")

/** Two extra steps so the numeric ordering (50 < 100 < 500) is exercised */
const paletteBrand50 = makeColor("c-palette-brand-50", "palette-brand-50", rawColor(239, 246, 255))
const paletteBrand100 = makeColor("c-palette-brand-100", "palette-brand-100", rawColor(219, 234, 254))
const tokens: Array<Token> = [...tokensWithLeafShadow, paletteBrand100, paletteBrand50]

const generate = (input: Array<Token>): string => styleOutputFile(input, tokenGroups)?.content ?? ""

/** Deterministic permutations: reversed, plus rotations of the reversed list */
const permutations = (list: Array<Token>): Array<Array<Token>> => {
  const reversed = [...list].reverse()
  return [reversed, ...list.map((_, i) => [...reversed.slice(i), ...reversed.slice(0, i)])]
}

describe("token output order", () => {
  test("output is identical regardless of the order the API returns tokens in", () => {
    const expected = generate(tokens)
    expect(expected).not.toBe("")
    for (const shuffled of permutations(tokens)) {
      expect(generate(shuffled)).toBe(expected)
    }
  })

  test("tokens are ordered by name, with numeric steps in numeric order", () => {
    const css = generate([...tokens].reverse())
    const order = ["palette-brand-50:", "palette-brand-100:", "palette-brand-500:", "palette-white:"]
    const positions = order.map((name) => css.indexOf(`--color-${name}`))
    positions.forEach((position) => expect(position).toBeGreaterThan(-1))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  test("token-type sections are ordered by type, not by first appearance", () => {
    const shadowFirst = [...tokens].sort((a) => (a.tokenType === "Shadow" ? -1 : 1))
    const css = generate(shadowFirst)
    expect(css.indexOf("/* Color */")).toBeLessThan(css.indexOf("/* Shadow */"))
  })

  test("the input array is not mutated", () => {
    const input = [...tokens].reverse()
    const ids = input.map((token) => token.id)
    generate(input)
    expect(input.map((token) => token.id)).toEqual(ids)
  })
})
