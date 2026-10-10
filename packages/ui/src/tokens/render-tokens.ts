type Token = {
	light: string
	dark?: string
}

export type TokenFile = {
	colors: Record<string, Token>
	parameters: Record<string, Token>
}

export type Srgb = {
	red: number
	green: number
	blue: number
	alpha: number
}

type Theme = "light" | "dark"

const REFERENCE = /^\{([a-z0-9-]+)\}$/
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGB = /^rgb\(\s*(\S+)\s+(\S+)\s+(\S+)\s*(?:\/\s*(\S+)\s*)?\)$/
const OKLCH = /^oklch\(\s*(\S+)\s+(\S+)\s+(\S+)\s*(?:\/\s*(\S+)\s*)?\)$/

const referenceOf = (value: string) => REFERENCE.exec(value)?.[1]

const toCssValue = (value: string) => {
	const reference = referenceOf(value)
	return reference ? `var(--${reference})` : value
}

const declarations = (file: TokenFile, theme: Theme) =>
	Object.entries({ ...file.colors, ...file.parameters }).flatMap(
		([name, token]) => {
			const value = theme === "light" ? token.light : token.dark
			return value === undefined ? [] : [`\t--${name}: ${toCssValue(value)};`]
		},
	)

export const renderCss = (file: TokenFile) =>
	[
		":root {",
		...declarations(file, "light"),
		"}",
		"",
		".dark {",
		...declarations(file, "dark"),
		"}",
		"",
	].join("\n")

const parseAlpha = (alpha: string | undefined) => {
	if (alpha === undefined) return 1
	return alpha.endsWith("%") ? Number.parseFloat(alpha) / 100 : Number(alpha)
}

const encodeGamma = (linear: number) => {
	const magnitude = Math.abs(linear)
	const encoded =
		magnitude <= 0.0031308
			? 12.92 * magnitude
			: 1.055 * magnitude ** (1 / 2.4) - 0.055
	return Math.sign(linear) * encoded
}

const oklchToSrgb = (lightness: number, chroma: number, hue: number) => {
	const radians = (hue * Math.PI) / 180
	const a = chroma * Math.cos(radians)
	const b = chroma * Math.sin(radians)
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map(encodeGamma)
}

const toByte = (unit: number) =>
	Math.round(Math.min(1, Math.max(0, unit)) * 255)

const toRgbChannel = (channel: string) =>
	channel.endsWith("%")
		? toByte(Number.parseFloat(channel) / 100)
		: Math.round(Number(channel))

export const toSrgb = (value: string): Srgb => {
	const hex = HEX.exec(value)
	if (hex) {
		const [red, green, blue] = hex
			.slice(1)
			.map((pair) => Number.parseInt(pair, 16))
		return { red, green, blue, alpha: 1 }
	}
	const rgb = RGB.exec(value)
	if (rgb) {
		const [red, green, blue] = rgb.slice(1, 4).map(toRgbChannel)
		return { red, green, blue, alpha: parseAlpha(rgb[4]) }
	}
	const oklch = OKLCH.exec(value)
	if (oklch) {
		const [red, green, blue] = oklchToSrgb(
			Number(oklch[1]),
			Number(oklch[2]),
			Number(oklch[3]),
		).map(toByte)
		return { red, green, blue, alpha: parseAlpha(oklch[4]) }
	}
	throw new Error(`Unsupported colour notation: ${value}`)
}

const resolve = (file: TokenFile, name: string, theme: Theme): string => {
	const token = file.colors[name]
	if (!token) throw new Error(`Unknown colour token: ${name}`)
	const value = theme === "dark" ? (token.dark ?? token.light) : token.light
	const reference = referenceOf(value)
	return reference ? resolve(file, reference, theme) : value
}

const toComponent = (byte: number) =>
	`0x${byte.toString(16).toUpperCase().padStart(2, "0")}`

const colorEntry = (srgb: Srgb) => ({
	"color-space": "srgb",
	components: {
		alpha: srgb.alpha.toFixed(3),
		blue: toComponent(srgb.blue),
		green: toComponent(srgb.green),
		red: toComponent(srgb.red),
	},
})

const XCODE_INFO = { author: "xcode", version: 1 }

const toJson = (value: unknown) => `${JSON.stringify(value, null, "\t")}\n`

export const CATALOGUE_CONTENTS = toJson({ info: XCODE_INFO })

export const renderColorSets = (file: TokenFile) =>
	Object.keys(file.colors).map((name) => ({
		name,
		contents: toJson({
			colors: [
				{
					color: colorEntry(toSrgb(resolve(file, name, "light"))),
					idiom: "universal",
				},
				{
					appearances: [{ appearance: "luminosity", value: "dark" }],
					color: colorEntry(toSrgb(resolve(file, name, "dark"))),
					idiom: "universal",
				},
			],
			info: XCODE_INFO,
		}),
	}))
