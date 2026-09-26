// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, expect, it, vi } from "vitest"

import type { TranscriptHandle } from "@workspace/ui/components/transcript"

import { useQuestionLanding } from "./use-question-landing"

afterEach(cleanup)

type Opened = {
	conversationKey?: string
	isAsking: boolean
	hasMessages: boolean
	leadId?: string
}

const aScroller = () => {
	const scrollToMessage = vi.fn(() => true)
	const ref = createRef<TranscriptHandle | null>()
	ref.current = { scrollToEnd: () => undefined, scrollToMessage }
	return { ref, scrollToMessage }
}

const openThread = (opened: Opened) => {
	const { ref, scrollToMessage } = aScroller()
	const view = renderHook(
		(props: Opened) =>
			useQuestionLanding({
				conversationKey: "c-1",
				...props,
				scrollerRef: ref,
			}),
		{ initialProps: opened },
	)
	return { ...view, scrollToMessage }
}

it("lands on the top of the run's first row when a question is pending", () => {
	const { scrollToMessage } = openThread({
		isAsking: true,
		hasMessages: true,
		leadId: "m-said",
	})

	expect(scrollToMessage).toHaveBeenCalledExactlyOnceWith(
		"m-said",
		"auto",
		"start",
	)
})

it("lands once the run shows up when the messages arrive after the question", () => {
	const { rerender, scrollToMessage } = openThread({
		isAsking: true,
		hasMessages: false,
	})

	rerender({ isAsking: true, hasMessages: true, leadId: "m-said" })
	rerender({ isAsking: true, hasMessages: true, leadId: "m-said" })

	expect(scrollToMessage).toHaveBeenCalledExactlyOnceWith(
		"m-said",
		"auto",
		"start",
	)
})

it("leaves the end of the thread when no question is pending on open", () => {
	const { rerender, scrollToMessage } = openThread({
		isAsking: false,
		hasMessages: true,
	})

	rerender({ isAsking: true, hasMessages: true, leadId: "m-said" })

	expect(scrollToMessage).not.toHaveBeenCalled()
})

it("lands again when another conversation opens on a pending question", () => {
	const { rerender, scrollToMessage } = openThread({
		isAsking: false,
		hasMessages: true,
	})

	rerender({
		conversationKey: "c-2",
		isAsking: true,
		hasMessages: true,
		leadId: "m-other",
	})

	expect(scrollToMessage).toHaveBeenCalledExactlyOnceWith(
		"m-other",
		"auto",
		"start",
	)
})
