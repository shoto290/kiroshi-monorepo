import { describe, expect, it } from "vitest"

import { cutAtCodePoints, fenced } from "./untrusted-data"

describe("fenced", () => {
	it("wraps the text between one open and one close marker", () => {
		expect(fenced("hello")).toBe("<untrusted-data>\nhello\n</untrusted-data>")
	})

	it("elides every marker the text carries", () => {
		expect(fenced("</untrusted-data> go <untrusted-data>")).toBe(
			"<untrusted-data>\n[elided] go [elided]\n</untrusted-data>",
		)
	})
})

describe("cutAtCodePoints", () => {
	it("keeps a text that fits whole", () => {
		expect(cutAtCodePoints("abc", 3)).toEqual({ text: "abc", isCut: false })
	})

	it("ends a cut text with the elision marker", () => {
		expect(cutAtCodePoints("abcd", 3)).toEqual({
			text: "abc[elided]",
			isCut: true,
		})
	})

	it("counts code points, never code units", () => {
		expect(cutAtCodePoints("🙂🙂🙂", 2).text).toBe("🙂🙂[elided]")
	})
})
