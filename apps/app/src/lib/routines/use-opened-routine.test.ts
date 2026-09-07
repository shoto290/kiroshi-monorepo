// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import type { RoutineRowModel } from "@workspace/ui/components/routine-row"

import { useOpenedRoutine } from "./use-opened-routine"

const A_ROUTINE = { id: "r-1", title: "Roadmap digest" } as RoutineRowModel

const CONVERSATION = "c-1"

const renderRequest = (
	routines: RoutineRowModel[],
	conversationId: string | null,
) => {
	const onOpen = vi.fn()
	const onTaken = vi.fn()
	renderHook(() =>
		useOpenedRoutine({
			opened: { routineId: A_ROUTINE.id, conversationId: CONVERSATION },
			conversationId,
			routines,
			onOpen,
			onTaken,
		}),
	)
	return { onOpen, onTaken }
}

afterEach(cleanup)

it("opens the detail of the routine its conversation is asked for", () => {
	const { onOpen, onTaken } = renderRequest([A_ROUTINE], CONVERSATION)

	expect(onOpen).toHaveBeenCalledWith(A_ROUTINE.id)
	expect(onTaken).toHaveBeenCalledTimes(1)
})

it("waits for the routine to be read before opening its detail", () => {
	const { onOpen } = renderRequest([], CONVERSATION)

	expect(onOpen).not.toHaveBeenCalled()
})

it("leaves the request to the conversation it names", () => {
	const { onOpen } = renderRequest([A_ROUTINE], "c-other")

	expect(onOpen).not.toHaveBeenCalled()
})
