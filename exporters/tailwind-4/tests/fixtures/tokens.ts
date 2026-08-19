import {
  ColorToken,
  ColorTokenValue,
  ShadowToken,
  ShadowTokenValue,
  ShadowType,
  Token,
  TokenGroup,
  TokenType,
  Unit,
} from "@supernovaio/sdk-exporters"

const groupForType = (type: TokenType): TokenGroup =>
  ({
    id: `group-${type}`,
    name: type,
    isRoot: true,
    path: [],
    parentGroupId: null,
    tokenType: type,
    childrenIds: [],
    tokenIds: [],
  } as unknown as TokenGroup)

export const tokenGroups: Array<TokenGroup> = [
  groupForType(TokenType.color),
  groupForType(TokenType.shadow),
]

/**
 * A raw ("leaf") color value — no referencedTokenId, so it is a primitive palette value.
 * These are the tokens root indirection targets.
 */
const rawColor = (r: number, g: number, b: number, opacity = 1): ColorTokenValue => ({
  color: { r, g, b, referencedTokenId: null },
  opacity: { measure: opacity, unit: Unit.raw, referencedTokenId: null },
  referencedTokenId: null,
})

/**
 * An alias color value — points at another color token, so it is NOT a leaf and must never
 * receive a :root alias of its own.
 */
const aliasColor = (refId: string): ColorTokenValue => ({
  color: { r: 0, g: 0, b: 0, referencedTokenId: null },
  opacity: { measure: 1, unit: Unit.raw, referencedTokenId: null },
  referencedTokenId: refId,
})

const makeColor = (id: string, name: string, value: ColorTokenValue, description = ""): ColorToken =>
  ({
    id,
    idInVersion: id,
    name,
    description,
    tokenType: TokenType.color,
    parentGroupId: `group-${TokenType.color}`,
    value,
    origin: null,
    properties: [],
    propertyValues: {},
  } as unknown as ColorToken)

/**
 * A shadow whose color references `colorRefId` at a custom opacity. This is the shape that makes
 * the exporter emit an `--oklch-*` channel variable, consumed as `oklch(var(--oklch-x) / <alpha>)`.
 * The real Lula token set contains no such token today, which is exactly why it needs a fixture.
 */
const makeShadowWithOpacity = (id: string, name: string, colorRefId: string, alpha: number): ShadowToken => {
  const layer: ShadowTokenValue = {
    color: {
      color: { r: 0, g: 0, b: 0, referencedTokenId: null },
      opacity: { measure: 1, unit: Unit.raw, referencedTokenId: null },
      referencedTokenId: colorRefId,
    },
    // The custom opacity lives on the LAYER (see CSSHelper.shadowTokenValueToCSS, which passes
    // value.opacity as customOpacity) — that pairing of layer opacity + a referenced color is
    // what makes the exporter emit an --oklch-* channel variable.
    opacity: { measure: alpha, unit: Unit.raw, referencedTokenId: null },
    x: 0,
    y: 2,
    radius: 4,
    spread: 0,
    type: ShadowType.drop,
    referencedTokenId: null,
  } as unknown as ShadowTokenValue

  return {
    id,
    idInVersion: id,
    name,
    description: "",
    tokenType: TokenType.shadow,
    parentGroupId: `group-${TokenType.shadow}`,
    value: [layer],
    origin: null,
    properties: [],
    propertyValues: {},
  } as unknown as ShadowToken
}

/** Leaf: primitive palette blue. Gets a :root alias. */
export const paletteBrand500 = makeColor(
  "c-palette-brand-500",
  "palette-brand-500",
  rawColor(19, 104, 232),
  "Brand blue primitive — step 500."
)

/** Leaf: primitive white. Gets a :root alias. */
export const paletteWhite = makeColor("c-palette-white", "palette-white", rawColor(255, 255, 255))

/** Alias: semantic token pointing at the brand leaf. Must NOT get a :root alias. */
export const actionPrimaryBg = makeColor(
  "c-action-primary-bg",
  "action-primary-bg",
  aliasColor("c-palette-brand-500")
)

/** Shadow tinting a LEAF color at 20% — the root-indirected case. */
export const shadowFromLeaf = makeShadowWithOpacity("s-from-leaf", "shadow-from-leaf", "c-palette-brand-500", 0.2)

/** Shadow tinting an ALIAS color at 20% — the case that must keep baking its value. */
export const shadowFromAlias = makeShadowWithOpacity("s-from-alias", "shadow-from-alias", "c-action-primary-bg", 0.2)

/** Colors only — the common case. */
export const colorTokens: Array<Token> = [paletteBrand500, paletteWhite, actionPrimaryBg]

/** Colors plus a shadow that tints a leaf color, exercising the `--oklch-*` path. */
export const tokensWithLeafShadow: Array<Token> = [...colorTokens, shadowFromLeaf]

/** Colors plus a shadow that tints an alias color. */
export const tokensWithAliasShadow: Array<Token> = [...colorTokens, shadowFromAlias]
