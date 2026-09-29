// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useTheme } from "./use-theme"

const press = (init: KeyboardEventInit) =>
	window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }))

describe("useTheme", () => {
	afterEach(cleanup)

	it("applies the chosen scheme to the document", () => {
		renderHook(useTheme, { initialProps: { colorScheme: "dark" as const } })

		expect(document.documentElement.classList.contains("dark")).toBe(true)
	})

	it("keeps the scheme on D and Shift+D", () => {
		renderHook(useTheme, { initialProps: { colorScheme: "light" as const } })

		press({ key: "d" })
		press({ key: "D", shiftKey: true })

		expect(document.documentElement.classList.contains("light")).toBe(true)
		expect(document.documentElement.classList.contains("dark")).toBe(false)
	})
})
