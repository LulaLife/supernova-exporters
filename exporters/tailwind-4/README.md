![Tailwind Exporter](https://raw.githubusercontent.com/Supernova-Studio/exporters/main/exporters/tailwind/resources/header.png)

# Tailwind CSS Exporter

The Tailwind CSS Exporter is a powerful package for converting your design system data into a production-ready Tailwind configuration. It facilitates a seamless transition from design to development, ensuring consistency and accuracy throughout the process. The Tailwind exporter has a variety of configuration options to make sure the configuration always fits your codebase.

## Exporter Features

This exporter package takes your design system tokens and converts them to Tailwind CSS configuration in various ways. Here are its key features:

- **Support for all Supernova token types:** Generates Tailwind configuration from all token types, including colors, text styles, shadows, dimensions and more.
- **Branding support:** Can generate configurations for different brands you've defined in Supernova.
- **Theming support:** Can generate configurations for different themes you've defined in Supernova.
- **Customizable output:** Can be configured to generate Tailwind configuration in variety of ways.
- **Customizable formatting:** Can be configured to generate each token using various formatting options.
- **Comment support:** Can include descriptions for each token as code comments, if provided. Can also provide a disclaimer at the top of each file to prevent people from tinkering with the generated code manually.
- **File organization:** Can generate output in various ways, such as separate files for each token type, or a single configuration file.
- **Reset rules:** Can generate reset rules to disable default Tailwind styles, either in a separate file or within the main CSS file.
- **Typography classes:** Can generate typography classes in @layer components using typography tokens.
- **Component classes (LulaLife fork):** Can generate component classes (e.g. `.alert`, `.button-primary`, `.button-primary:hover`) in @layer components from configured component token groups. See _Component classes_ below.
- **Debug information:** Can include debug information in the generated files to help with troubleshooting.

## Component classes (LulaLife fork)

This fork adds an optional `@layer components` emission path for component-level tokens (alert, button, badge, etc.) so consumers can use semantic classes directly instead of composing utilities per component.

### Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `generateComponentClasses` | `false` | Enable component-class emission. |
| `componentGroupsToGenerate` | `"alert,button,badge,field,switch,tooltip"` | Comma-separated list of component names. Each name matches tokens whose CSS variable name contains `-<name>-` (case-insensitive). |

### How it works

Given tokens like:

```
--spacing-alert-padding-x
--spacing-alert-padding-y
--spacing-alert-gap
--radius-alert-radius
--color-alert-success-bg
--color-alert-success-icon
--color-alert-success-border
```

The exporter emits:

```css
@layer components {
  .alert {
    padding-inline: var(--spacing-alert-padding-x);
    padding-block: var(--spacing-alert-padding-y);
    gap: var(--spacing-alert-gap);
    border-radius: var(--radius-alert-radius);
  }
  .alert-success {
    background-color: var(--color-alert-success-bg);
    color: var(--color-alert-success-icon);
    border-color: var(--color-alert-success-border);
  }
}
```

State suffixes (`-hover`, `-pressed`, `-disabled`, `-focus`) become CSS pseudo-classes (`:hover`, `:active`, `:disabled`, `:focus-visible`). `-placeholder` maps to `::placeholder`.

### Supported token-leaf → CSS-property mapping

`padding-x` → `padding-inline`, `padding-y` → `padding-block`, `gap`, `margin-*`, `radius` → `border-radius`, `height` / `min-height` / `max-height`, `width` / `min-width` / `max-width`, `bg` / `background` → `background-color`, `color` / `text` / `icon` / `foreground` → `color`, `border` → `border-color`, `border-width`, `shadow` → `box-shadow`, `font-size`, `font-weight`, `line-height`, `opacity`, `z-index`.

Leaves not in this map are skipped (no class emission). A few meta leaves like `padding-text-y` and `label-gap` are explicitly skipped.

### Limitations

- Only the `singleFile` file structure is currently wired up for component classes. In `separateByType` mode, component classes are not emitted (component tokens span multiple types like spacing + radius + color).
- Variant detection is driven by the CSS variable name pattern (`-<component>-<variant>-<property>` or `-<component>-<property>-<state>`), not the Supernova group hierarchy. This works because the exporter's naming helper already collapses the group path into the variable name.

## Example of Output

Given the following design system token (meta representation for brevity):

```typescript
const tokens = [{
    type: "color",
    name: "red",
    value: "#ff0000",
    description: "The reddest of reds"
}, {
    type: "color",
    name: "blue",
    value: "#0000ff",
}, {
    type: "color",
    name: "primary",
    value: "{primary}",
    description: "The main color used throughout the application"
}];
```

With configurations:

```json
{
    "showGeneratedFileDisclaimer": true,
    "disclaimer": "This file was automatically generated. Do not modify manually.",
    "showDescriptions": true,
    "useReferences": true,
    "colorFormat": "hex",
    "indent": 2,
    "fileStructure": "singleFile"
}
```

The exporter would produce:

```css
/* This file was automatically generated. Do not modify manually. */

@import "tailwindcss";

:root {
  /* The reddest of reds */
  --color-red: #ff0000;
  --color-blue: #0000ff;
  /* The main color used throughout the application */
  --color-primary: var(--color-red);
}
```

## Configuration Options

Here is a list of all the configuration options this exporter provides:

### General Settings
- **showGeneratedFileDisclaimer:** Toggle to show a disclaimer indicating the file is auto-generated.
- **disclaimer:** Set the text of the aforementioned disclaimer.
- **generateEmptyFiles:** Choose if files with no styles should still be generated.
- **showDescriptions:** Display descriptions for each token as code comments.
- **useReferences:** Use references to other tokens instead of direct values where possible.
- **debug:** Include debug information in the generated files to help with troubleshooting.
- **indent:** Set the number of spaces for indentation in the generated files.

### File Structure
- **fileStructure:** Controls how token styles are organized in files. Options:
  - `singleFile`: All tokens are in a single CSS file
  - `separateByType`: Tokens are separated into different files by type
- **generateIndexFile:** Decide whether an aggregate index file should be created.
- **indexFileName:** Name the generated index file.
- **baseIndexFilePath:** Define the directory path for the index file.
- **baseStyleFilePath:** Define the directory path for style files.
- **generateEmptyConfigTypeFiles:** Choose if empty config type files should be generated.
- **customizeConfigFileNames:** Enable customization of config file names.
- **configFileNames:** Define custom names for config files by token type.
- **cssSelector:** CSS selector where variables will be defined.
- **themeSelector:** CSS selector pattern for themes, {theme} will be replaced with theme name.

### Colors
- **colorFormat:** Set the format in which colors are exported. Options:
  - `smartHashHex`: Automatically choose between #RRGGBB and #RRGGBBAA
  - `smartRgba`: Automatically choose between rgb() and rgba()
  - `smartHsla`: Automatically choose between hsl() and hsla()
  - `smartOklch`: Automatically choose between oklch() and oklch() with alpha
  - `hashHex6`: HEX (6 digits), e.g., #ff0000
  - `hashHex8`: HEX (8 digits), e.g., #ff0000ff
  - `rgb`: RGB, e.g., rgb(255, 0, 0)
  - `rgba`: RGBA, e.g., rgba(255, 0, 0, 1)
  - `hsl`: HSL, e.g., hsl(0, 100%, 50%)
  - `hsla`: HSLA, e.g., hsla(0, 100%, 50%, 1)
  - `oklch`: OKLCH, e.g., oklch(0.6 0.15 30)
  - `oklcha`: OKLCHA, e.g., oklch(0.6 0.15 30 / 1)
- **colorPrecision:** Maximum number of decimals in colors.
- **useColorUtilityPrefixes:** Enable specific prefixes for different color utilities.
- **colorUtilityPrefixes:** Define patterns to prefix color tokens. Use commas for multiple patterns (e.g., 'background,bg') and ! to negate (e.g., 'bg,!fill').

### Theme Settings
- **exportThemesAs:** Controls how themes are exported in the CSS files. Options:
  - `applyDirectly`: Apply themes directly to tokens
  - `separateFiles`: Generate separate files for each theme
  - `mergedTheme`: Generate a single merged theme file
- **exportOnlyThemedTokens:** When enabled, themed files will only include tokens that have different values from the base theme.
- **exportBaseValues:** When enabled, base token values will be exported along with themes.

### Reset Rules
- **disableAllDefaults:** When enabled, removes all default Tailwind utilities by adding --*: initial; to reset group.
- **disableAnimateDefaults:** When enabled, resets all animation token values to initial state.
- **disableBlurDefaults:** When enabled, resets all blur token values to initial state.
- **disableBorderRadiusDefaults:** When enabled, resets all border radius token values to initial state.
- **disableBreakpointDefaults:** When enabled, resets all breakpoint token values to initial state.
- **disableColorDefaults:** When enabled, resets all color token values to initial state.
- **disableContainerDefaults:** When enabled, resets all container token values to initial state.
- **disableDropShadowDefaults:** When enabled, resets all drop shadow token values to initial state.
- **disableFontDefaults:** When enabled, resets all font family token values to initial state.
- **disableFontWeightDefaults:** When enabled, resets all font weight token values to initial state.
- **disableInsetDefaults:** When enabled, resets all inset token values to initial state.
- **disableLeadingDefaults:** When enabled, resets all line height token values to initial state.
- **disablePerspectiveDefaults:** When enabled, resets all perspective token values to initial state.
- **disableShadowDefaults:** When enabled, resets all shadow token values to initial state.
- **disableSpacingDefaults:** When enabled, resets all spacing token values to initial state.
- **disableTextDefaults:** When enabled, resets all text token values to initial state.
- **disableTrackingDefaults:** When enabled, resets all letter spacing token values to initial state.

### Typography
- **generateTypographyClasses:** When enabled, generates typography classes in @layer components using typography tokens.
- **forceRemUnit:** When enabled, converts pixel values to rem units.
- **remBase:** Base pixel value for rem conversion (default: 16).

### Token Properties
- **writeClassnameToProperty:** When enabled, generated Tailwind classnames will be saved back to tokens as custom properties.
- **propertyToWriteClassnameTo:** Name of the custom property where generated Tailwind classnames will be saved.
- **writeCSSVariableNameToProperty:** When enabled, generated CSS variable names will be saved back to tokens as custom properties.
- **propertyToWriteCSSVariableNameTo:** Name of the custom property where generated CSS variable names will be saved.
- **propertyToWriteCSSVariableNameToIncludesVar:** When enabled, the resulting written properties will be encapsulated in var() syntax for easier copying.

### Token Formatting
- **tokenPrefixes:** Prefix each token type with a specific identifier.
- **globalPrefix:** Prefix for Tailwind classes and CSS variables.
- **findReplace:** Find and replace strings in token paths and names.
