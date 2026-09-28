import { describe, expect, it } from "vitest"

import {
	BRAND_FIELD,
	PLAYABLE_STATES,
} from "@workspace/ui/components/app-icon-mark"
import { fieldTones } from "@workspace/ui/components/dithered-field-avatar"

const FRAME_TIMES = Array.from({ length: 40 }, (_, index) => index * 97)

const isOutsideRing = (index: number) => BRAND_FIELD.mask?.[index] === 0

describe("brand ring field", () => {
	it("leaves the hole and the outside empty in every state at every frame", () => {
		for (const state of PLAYABLE_STATES)
			for (const time of FRAME_TIMES)
				expect(
					fieldTones(BRAND_FIELD, state, time).filter(
						(tone, index) => tone > 0 && isOutsideRing(index),
					),
				).toEqual([])
	})

	it("moves the ring cells while a state plays", () => {
		for (const state of PLAYABLE_STATES) {
			const frames = FRAME_TIMES.map((time) =>
				fieldTones(BRAND_FIELD, state, time).join(""),
			)
			expect(new Set(frames).size).toBeGreaterThan(1)
		}
	})

	it("holds the resting ring still", () => {
		const frames = FRAME_TIMES.map((time) =>
			fieldTones(BRAND_FIELD, "idle", time).join(""),
		)
		expect(new Set(frames).size).toBe(1)
	})
})
