import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { toSrgb } from "./render-tokens"

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), "utf8")

const THEME_SELECTORS = [":root", ".dark"]

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

const themeDeclarations = (css: string) =>
	topLevelRules(css)
		.filter(({ selector }) => THEME_SELECTORS.includes(selector))
		.flatMap(({ selector, body }) =>
			body
				.split(";")
				.map((declaration) => declaration.trim())
				.filter((declaration) => declaration.startsWith("--"))
				.map(
					(declaration) =>
						`${selector} ${declaration.slice(0, declaration.indexOf(":"))}`,
				),
		)

describe("tokens.json", () => {
	it("leaves every generated custom property out of the hand-written theme blocks", () => {
		const generated = new Set(themeDeclarations(read("../styles/tokens.css")))
		const handWritten = themeDeclarations(read("../styles/globals.css"))

		expect(generated.size).toBeGreaterThan(0)
		expect(
			handWritten.filter((declaration) => generated.has(declaration)),
		).toEqual([])
	})

	it("converts each notation to the sRGB bytes Chromium paints", () => {
		expect(toSrgb("#123456")).toEqual({
			red: 18,
			green: 52,
			blue: 86,
			alpha: 1,
		})
		expect(toSrgb("rgb(10 20 30 / 50%)")).toEqual({
			red: 10,
			green: 20,
			blue: 30,
			alpha: 0.5,
		})
		expect(toSrgb("oklch(0.6 0.25 30)")).toEqual({
			red: 241,
			green: 0,
			blue: 0,
			alpha: 1,
		})
		expect(toSrgb("oklch(0.5 0 0 / 20%)")).toEqual({
			red: 99,
			green: 99,
			blue: 99,
			alpha: 0.2,
		})
	})
})
