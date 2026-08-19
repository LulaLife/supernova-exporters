import { StringCase, ColorFormat } from "@supernovaio/export-utils"
import { TokenType } from "@supernovaio/sdk-exporters"

/**
 * Main configuration of the exporter - type interface. Default values for it can be set through `config.json` and users can override the behavior when creating the pipelines.
 */
export enum ThemeExportStyle {
    ApplyDirectly = "applyDirectly",
    SeparateFiles = "separateFiles",
    MergedTheme = "mergedTheme"
}

export enum FileStructure {
    SeparateByType = "separateByType",
    SingleFile = "singleFile"
}

export enum FindReplaceTiming {
    BeforePrefix = "beforePrefix",
    AfterPrefix = "afterPrefix"
}

export type ColorUtilityType = 
  | 'text' 
  | 'boxShadow' 
  | 'background' 
  | 'outline' 
  | 'border' 
  | 'stroke'
  | 'fill'
  | 'ring'

export type ColorUtilityPrefixes = Record<ColorUtilityType, string>

export type ExporterConfiguration = {
  /** When enabled, a disclaimer showing the fact that the file was generated automatically and should not be changed manually will appear in all style styles */
  showGeneratedFileDisclaimer: boolean
  /** When enabled, a disclaimer showing the fact that the file was generated automatically and should not be changed manually will appear in all style styles */
  disclaimer: string
  /** When enabled, empty style files will be generated. Otherwise empty are omitted */
  generateEmptyFiles: boolean
  /** When enabled, token description will be shown as code comments for every exported token */
  showDescriptions: boolean
  /** When enabled, values will use references to other tokens where applicable */
  useReferences: boolean
  /** Format of the exported colors */
  colorFormat: ColorFormat
  /** Max number of decimals in colors */
  colorPrecision: number
  /** Number of spaces used to indent every css variables */
  indent: number
  /** When set, will prefix each token of a specific type with provided identifier. Put empty string if not necessary */
  tokenPrefixes: Record<TokenType, string>
  /** Name of each file that will be generated. Tokens are grouped by the type and will land in each of those files */
  styleFileNames: Record<TokenType, string>
  /** All files will be written to this directory (relative to export root set by the exporter / pipeline configuration / VSCode extension) */
  baseStyleFilePath: string
  /** CSS selector where variables will be defined */
  cssSelector: string
  /** CSS selector pattern for themes, {theme} will be replaced with theme name */
  themeSelector: string
  /**
   * When enabled (and cssSelector resolves to `@theme`/`@theme inline`), every leaf color token
   * (a color token with no referencedTokenId — i.e. a primitive palette value, not an alias) is
   * additionally emitted as a raw value in a `:root` block under a distinct alias name (see
   * `rootIndirectionPrefix`), and the `@theme` copy of that token becomes `var(--<alias>)`.
   * That makes the whole color system runtime-overridable (e.g. per-tenant white-labeling)
   * without touching alias/semantic tokens, which already chain through var() to these leaves.
   *
   * The alias is deliberately a DIFFERENT custom property name than the theme token. Pointing a
   * theme token at itself (`--color-x: var(--color-x)`) also works in practice — Tailwind emits
   * `@theme` into `@layer theme`, and an unlayered `:root` outranks it — but it relies on that
   * layer precedence to break the tie, and silently resolves to an invalid value if the override
   * ever ends up in the same layer. A distinct name means there is no tie to break at all, and
   * matches the pattern Tailwind's own documentation recommends.
   *
   * Requires `useReferences` — with references off, alias/semantic tokens are baked to raw values
   * and would not follow a runtime override, so the feature is skipped (and says so in a comment
   * in the generated file).
   *
   * Also switches the OKLCH channel utility variables (opacity-composited colors in shadows/
   * borders/gradients) for root-indirected leaves to a CSS Color 4 relative-color reference
   * (`from var(--<alias>) l c h`) instead of a baked snapshot, so those track a runtime override
   * too. Only applied for OKLCH color formats — `rgba()` has no equivalent `l c h` form.
   */
  rootIndirectionForColors: boolean
  /**
   * Prefix for the `:root` alias custom properties emitted by `rootIndirectionForColors`.
   * `--<prefix>-<token-name>`, e.g. `ds` → `--ds-color-palette-brand-500`. Must be non-empty and
   * must not collide with a Tailwind theme namespace; consumers override the alias, not the token.
   */
  rootIndirectionPrefix: string
  /** Controls how themes are exported in the CSS files */
  exportThemesAs: ThemeExportStyle
  /** When enabled, themed files will only include tokens that have different values from the base theme */
  exportOnlyThemedTokens: boolean
  /** When enabled, base token values will be exported along with themes */
  exportBaseValues: boolean
  /** When enabled, converts pixel values to rem units */
  forceRemUnit: boolean
  /** Base pixel value for rem conversion (default: 16) */
  remBase: number
  /** When enabled, allows customization of style file names */
  customizeStyleFileNames: boolean
  /** Prefix for Tailwind classes and CSS variables */
  globalPrefix: string
  /** When enabled, uses specific prefixes for different color utilities */
  useColorUtilityPrefixes: boolean
  /** Configuration for color utility prefixes and their patterns */
  colorUtilityPrefixes: ColorUtilityPrefixes
  /** Find and replace strings in token paths and names */
  findReplace: Record<string, string>
  /** Controls when find/replace is applied: before or after token type prefixes are added */
  findReplaceTiming: FindReplaceTiming
  /** When enabled, resets all animation token values to initial state before applying new values */
  disableAnimateDefaults: boolean
  /** When enabled, resets all blur token values to initial state before applying new values */
  disableBlurDefaults: boolean
  /** When enabled, resets all border radius token values to initial state before applying new values */
  disableBorderRadiusDefaults: boolean
  /** When enabled, resets all breakpoint token values to initial state before applying new values */
  disableBreakpointDefaults: boolean
  /** When enabled, resets all color token values to initial state before applying new values */
  disableColorDefaults: boolean
  /** When enabled, resets all container token values to initial state before applying new values */
  disableContainerDefaults: boolean
  /** When enabled, resets all drop shadow token values to initial state before applying new values */
  disableDropShadowDefaults: boolean
  /** When enabled, resets all font family token values to initial state before applying new values */
  disableFontDefaults: boolean
  /** When enabled, resets all font weight token values to initial state before applying new values */
  disableFontWeightDefaults: boolean
  /** When enabled, resets all inset token values to initial state before applying new values */
  disableInsetDefaults: boolean
  /** When enabled, resets all line height token values to initial state before applying new values */
  disableLeadingDefaults: boolean
  /** When enabled, resets all perspective token values to initial state before applying new values */
  disablePerspectiveDefaults: boolean
  /** When enabled, resets all shadow token values to initial state before applying new values */
  disableShadowDefaults: boolean
  /** When enabled, resets all spacing token values to initial state before applying new values */
  disableSpacingDefaults: boolean
  /** When enabled, resets all text token values to initial state before applying new values */
  disableTextDefaults: boolean
  /** When enabled, resets all letter spacing token values to initial state before applying new values */
  disableTrackingDefaults: boolean
  /** When enabled, adds debug information to the generated files to help with troubleshooting */
  debug: boolean
  /** When enabled, generates typography classes in @layer components using typography tokens */
  generateTypographyClasses: boolean
  /** When enabled, generates component classes (e.g. .alert, .button-primary) in @layer components for the component groups listed in componentGroupsToGenerate */
  generateComponentClasses: boolean
  /** Comma-separated list of component group names whose tokens should be emitted as classes in @layer components (e.g. "alert,button,badge") */
  componentGroupsToGenerate: string
  /** When enabled, size variants (sm/md/lg) of component classes are emitted as @utility blocks instead of @layer components, so they can be combined with Tailwind variants like md: and hover: (e.g. className="radio-size-md md:radio-size-sm") */
  useTailwindUtilityAPI: boolean
  /** When enabled, removes all default Tailwind utilities by adding --*: initial; to reset group */
  disableAllDefaults: boolean
  /** When enabled, generated Tailwind classnames will be saved back to tokens as custom properties */
  writeClassnameToProperty: boolean
  /** Name of the custom property where generated Tailwind classnames will be saved */
  propertyToWriteClassnameTo: string
  /** When enabled, generated CSS variable names will be saved back to tokens as custom properties */
  writeCSSVariableNameToProperty: boolean
  /** Name of the custom property where generated CSS variable names will be saved */
  propertyToWriteCSSVariableNameTo: string
  /** When enabled, the resulting written properties will be encapsulated in var() syntax for easier copying */
  propertyToWriteCSSVariableNameToIncludesVar: boolean
  /** Controls how token styles are organized in files */
  fileStructure: FileStructure
  generateEmptyConfigTypeFiles: boolean
  customizeConfigFileNames: boolean
  configFileNames: Record<string, string>
  generateIndexFile: boolean
  baseIndexFilePath: string
  indexFileName: string
}
