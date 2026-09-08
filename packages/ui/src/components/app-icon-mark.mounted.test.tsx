// @vitest-environment happy-dom

import { act, cleanup, render } from "@testing-library/react"
import { createRef } from "react"
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest"

import {
	AppIconMark,
	type AppIconMarkHandle,
} from "@workspace/ui/components/app-icon-mark"

const RESTING_STATE = "waiting"
const LONG_ENOUGH_FOR_SEVERAL_ANIMATIONS = 60_000

const reducedMotion = {
	matches: false,
	listeners: new Set<() => void>(),
	prefer(matches: boolean) {
		this.matches = matches
		for (const listener of this.listeners) listener()
	},
}

const stateOf = (container: HTMLElement) =>
	container
		.querySelector('[data-slot="app-icon-mark"]')
		?.getAttribute("data-state")

beforeAll(() => {
	vi.stubGlobal("matchMedia", () => ({
		get matches() {
			return reducedMotion.matches
		},
		addEventListener: (_: string, listener: () => void) =>
			reducedMotion.listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			reducedMotion.listeners.delete(listener),
	}))
})

describe("AppIconMark against the reduced-motion preference", () => {
	beforeEach(() => {
		reducedMotion.matches = false
		vi.useFakeTimers()
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it("holds the resting pose and schedules nothing when motion is unwelcome", () => {
		reducedMotion.matches = true

		const { container } = render(<AppIconMark />)

		expect(stateOf(container)).toBe(RESTING_STATE)

		act(() => {
			vi.advanceTimersByTime(LONG_ENOUGH_FOR_SEVERAL_ANIMATIONS)
		})

		expect(stateOf(container)).toBe(RESTING_STATE)
		expect(vi.getTimerCount()).toBe(0)
	})

	it("comes home when the preference turns on mid-play", () => {
		const mark = createRef<AppIconMarkHandle>()
		const { container } = render(<AppIconMark ref={mark} />)

		act(() => {
			mark.current?.play()
		})

		expect(stateOf(container)).not.toBe(RESTING_STATE)

		act(() => {
			reducedMotion.prefer(true)
		})

		expect(stateOf(container)).toBe(RESTING_STATE)
		expect(vi.getTimerCount()).toBe(0)
	})
})
