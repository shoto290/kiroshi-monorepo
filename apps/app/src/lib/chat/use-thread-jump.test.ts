// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, expect, it, vi } from "vitest"

import type { TranscriptHandle } from "@workspace/ui/components/transcript"

import { type ThreadPager, useThreadJump } from "./use-thread-jump"

import { message } from "@/lib/conversations/transcript-fixtures"

const LANDED = "m-landed"

afterEach(cleanup)

const aScroller = (isReached: boolean) => {
	const scrollToMessage = vi.fn(() => isReached)
	const handle: TranscriptHandle = {
		scrollToEnd: () => undefined,
		scrollToMessage,
	}
	const ref = createRef<TranscriptHandle | null>()
	ref.current = handle
	return { ref, scrollToMessage }
}

const aPager = (): ThreadPager & { loadOlder: ReturnType<typeof vi.fn> } => ({
	getState: () => ({ messages: [message({ id: LANDED })], hasOlder: true }),
	loadOlder: vi.fn(async () => undefined),
})

it("scrolls to a landed message once and reads no older page", async () => {
	const { ref, scrollToMessage } = aScroller(true)
	const pager = aPager()
	const { result } = renderHook(() => useThreadJump(pager, ref))

	await act(async () => {
		result.current.landOnMessage(LANDED)
	})

	expect(scrollToMessage).toHaveBeenCalledTimes(1)
	expect(scrollToMessage).toHaveBeenCalledWith(LANDED)
	expect(pager.loadOlder).not.toHaveBeenCalled()
	expect(result.current.highlightedMessageId).toBe(LANDED)
})

it("gives up on a landed message the transcript has no row for", async () => {
	const { ref, scrollToMessage } = aScroller(false)
	const pager = aPager()
	const { result } = renderHook(() => useThreadJump(pager, ref))

	await act(async () => {
		result.current.landOnMessage(LANDED)
	})

	expect(scrollToMessage).toHaveBeenCalledTimes(1)
	expect(pager.loadOlder).not.toHaveBeenCalled()
})
