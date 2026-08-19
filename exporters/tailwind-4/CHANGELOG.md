# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - LulaLife fork

### Added
- Runtime-overridable colour leaves, for multi-tenant white-labeling. Controlled by `rootIndirectionForColors` (default `false`) and `rootIndirectionPrefix` (default `"ds"`). When enabled, every leaf colour token is emitted into a `:root` block under a distinct alias (`--ds-color-palette-brand-500`) and the `@theme` token points at that alias, so a consumer can re-theme the whole colour system at runtime by overriding the alias. Alias/semantic tokens are untouched — they already chain to the leaves via `var()`. See the README _Runtime-overridable colour leaves_ section for the cascade constraint on where overrides may live.
- OKLCH channel variables for root-indirected leaves now use CSS Color 4 relative colour syntax (`from var(--<alias>) l c h`), so custom-opacity colours in shadows/borders/gradients track a runtime override too. Only applied for OKLCH colour formats.
- Test suite for this exporter (`npm test`), including fixtures for the custom-opacity shadow path that previously had no coverage.
- Component-class emission inside `@layer components` for component-grouped tokens (alert, button, badge, etc.). Controlled by two new settings: `generateComponentClasses` (default `false`) and `componentGroupsToGenerate` (default `"alert,button,badge,field,switch,tooltip"`). State suffixes (`hover`, `pressed`, `disabled`, `focus`, `placeholder`) are emitted as CSS pseudo-classes (`:hover`, `:active`, `:disabled`, `:focus-visible`, `::placeholder`). See the README _Component classes_ section for details.

## [1.1.1] - 2025-09-10
- Fix spacing token output: generate `--spacing-*` instead of `--size-*` for sizing. Thanks @mickaelnijean for contribution!

## [1.1.0] - 2025-07-18

### Added
- OKLCH utility variable support for color tokens referenced with opacity
- Automatic generation of `--oklch-*` variables for color tokens used in shadows, borders, and gradients with custom opacity
- Support for `oklch(var(--oklch-...) / alpha)` syntax when using OKLCH color formats
- Proper color function selection (oklch vs rgba) based on configured color format

### Changed
- Updated color reference handling to use channel-based utility variables for better opacity control
- Improved compatibility with modern CSS color spaces

## [1.0.0] - 2025-04-07

### Added
- Initial release of the Tailwind CSS Exporter
- Support for all Supernova token types (that are also supported by Tailwind config)
- Branding and theming support
- Customizable output formatting
- Comment support for token descriptions
- File organization options (single file or separate by type)
- Reset rules functionality (can be in separate file or main CSS file)
- Typography classes generation
- Comprehensive configuration options for all aspects of the exporter