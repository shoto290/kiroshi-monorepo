import { afterEach, describe, expect, it } from "vitest"

import { activateLanguage } from "@workspace/ui/lib/i18n"

import { pinTimestamp } from "./pin-timestamp"

const PINNED_AT = new Date(2025, 2, 12, 21, 30).getTime()

afterEach(() => {
	activateLanguage("en")
})

describe("pinTimestamp", () => {
	it("stamps a pin with its day and time in en", () => {
		expect(pinTimestamp(PINNED_AT)).toBe("Mar 12, 9:30 PM")
	})

	it("stamps a pin with its day and time in fr", () => {
		activateLanguage("fr")

		expect(pinTimestamp(PINNED_AT)).toBe("12 mars, 21:30")
	})
})
