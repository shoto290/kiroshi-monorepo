// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { createStore } from "./store"
import { useController } from "./use-controller"

afterEach(cleanup)

it("keeps the controller built on the first render when the arguments change", () => {
	const { result, rerender } = renderHook(
		({ initial }) => useController(() => createStore(initial)),
		{ initialProps: { initial: 1 } },
	)
	const first = result.current.controller

	rerender({ initial: 2 })

	expect(result.current.controller).toBe(first)
	expect(result.current.state).toBe(1)
})

it("re-renders with the published state", () => {
	const { result } = renderHook(() => useController(() => createStore(0)))

	act(() => result.current.controller.setState(1))

	expect(result.current.state).toBe(1)
})
