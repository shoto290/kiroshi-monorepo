import { expect, it, vi } from "vitest"

import { createStore } from "./store"

it("holds the new value before the first listener runs", () => {
	const store = createStore(0)
	const read: number[] = []
	store.subscribe(() => read.push(store.getState()))

	store.setState(1)

	expect(read).toEqual([1])
})

it("notifies only the listeners held when the publish started", () => {
	const store = createStore(0)
	const late = vi.fn()
	const leaving = vi.fn()
	store.subscribe(() => {
		store.subscribe(late)
		stopLeaving()
	})
	const stopLeaving = store.subscribe(leaving)

	store.setState(1)

	expect(late).not.toHaveBeenCalled()
	expect(leaving).toHaveBeenCalledTimes(1)
})

it("leaves an unsubscribed listener uncalled on every later publish", () => {
	const store = createStore(0)
	const listener = vi.fn()
	const stop = store.subscribe(listener)

	stop()
	store.setState(1)
	store.setState(2)

	expect(listener).not.toHaveBeenCalled()
})
