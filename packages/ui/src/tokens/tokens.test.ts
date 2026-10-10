import { describe, expect, it } from "vitest"

import handWrittenThemeCss from "./hand-written-theme.fixture.css?raw"
import { toSrgb } from "./render-tokens"

import globalsCss from "../styles/globals.css?raw"
import tokensCss from "../styles/tokens.css?raw"

type Theme = Record<string, Record<string, string>>

const topLevelRules = (css: string) => {
	const rules: { selector: string; body: string }[] = []
	let depth = 0
	let selectorStart = 0
	let bodyStart = 0
	for (let index = 0; index < css.length; index++) {
		if (css[index] === "{" && depth++ === 0) bodyStart = index + 1
		if (css[index] === "}" && --depth === 0) {
			rules.push({
				selector: css.slice(selectorStart, bodyStart - 1).trim(),
				body: css.slice(bodyStart, index),
			})
			selectorStart = index + 1
		}
	}
	return rules
}

const customProperties = (body: string) =>
	body
		.split(";")
		.map((declaration) => declaration.trim())
		.filter((declaration) => declaration.startsWith("--"))
		.map((declaration) => {
			const colon = declaration.indexOf(":")
			return [
				declaration.slice(0, colon),
				declaration
					.slice(colon + 1)
					.trim()
					.replace(/\s+/g, " "),
			] as const
		})

const themeOf = (...sheets: string[]) => {
	const theme: Theme = { ":root": {}, ".dark": {} }
	for (const { selector, body } of sheets.flatMap(topLevelRules)) {
		const block = theme[selector]
		if (!block) continue
		for (const [name, value] of customProperties(body)) {
			expect(
				block,
				`${name} is declared twice on ${selector}`,
			).not.toHaveProperty(name)
			block[name] = value
		}
	}
	return theme
}

describe("tokens.json", () => {
	it("declares every custom property of the hand-written theme with the same value on the same selector", () => {
		const handWritten = themeOf(handWrittenThemeCss)
		const generated = themeOf(globalsCss, tokensCss)

		expect(generated).toEqual(handWritten)
	})

	it("converts each notation to the sRGB bytes Chromium paints", () => {
		expect(toSrgb("#7490c2")).toEqual({
			red: 116,
			green: 144,
			blue: 194,
			alpha: 1,
		})
		expect(toSrgb("rgb(116 144 194 / 40%)")).toEqual({
			red: 116,
			green: 144,
			blue: 194,
			alpha: 0.4,
		})
		expect(toSrgb("oklch(0.577 0.245 27.325)")).toEqual({
			red: 231,
			green: 0,
			blue: 11,
			alpha: 1,
		})
		expect(toSrgb("oklch(1 0 0 / 6%)")).toEqual({
			red: 255,
			green: 255,
			blue: 255,
			alpha: 0.06,
		})
	})
})
