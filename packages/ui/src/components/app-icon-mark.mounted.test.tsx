// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppIconMark } from "@workspace/ui/components/app-icon-mark"

const RESTING_STATE = "waiting"
const LONG_ENOUGH_FOR_SEVERAL_ANIMATIONS = 60_000

const prefersReducedMotion = () => {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({
			matches: true,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	)
}

describe("AppIconMark under prefers-reduced-motion", () => {
	beforeEach(() => {
		prefersReducedMotion()
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it("holds the resting pose and schedules nothing", () => {
		const { container } = render(<AppIconMark />)
		const stateOfMark = () =>
			container
				.querySelector('[data-slot="app-icon-mark"]')
				?.getAttribute("data-state")

		expect(stateOfMark()).toBe(RESTING_STATE)

		act(() => {
			vi.advanceTimersByTime(LONG_ENOUGH_FOR_SEVERAL_ANIMATIONS)
		})

		expect(stateOfMark()).toBe(RESTING_STATE)
		expect(vi.getTimerCount()).toBe(0)
	})
})
