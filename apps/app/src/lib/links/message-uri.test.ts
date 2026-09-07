import { describe, expect, it } from "vitest"

import { messageUri, parseMessageUri } from "./message-uri"

describe("messageUri", () => {
	it("addresses a message under its conversation", () => {
		expect(messageUri("c-1", "m-2")).toBe("kiroshi://c/c-1/m/m-2")
	})
})

describe("parseMessageUri", () => {
	it("reads back what messageUri wrote", () => {
		expect(parseMessageUri(messageUri("c-1", "m-2"))).toEqual({
			conversationId: "c-1",
			messageId: "m-2",
		})
	})

	it("turns down anything that is not a message uri", () => {
		const strangers = [
			"kiroshi://c/c-1",
			"kiroshi://c/c-1/m/",
			"kiroshi://c//m/m-2",
			"kiroshi://c/c-1/m/m-2/extra",
			"https://kiroshi.app/c/c-1/m/m-2",
			"",
		]
		for (const stranger of strangers) {
			expect(parseMessageUri(stranger)).toBeNull()
		}
	})
})
