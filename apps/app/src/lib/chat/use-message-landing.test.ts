// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import { useMessageLanding } from "./use-message-landing"

import type { TranscriptMessage } from "@/lib/conversations/transcript-contract"
import { message } from "@/lib/conversations/transcript-fixtures"
import type { MessageLanding } from "@/lib/search/message-landing-controller"

vi.mock("@workspace/ui/components/notice-surface", () => ({
	raiseFailureNotice: vi.fn(),
}))

const notice = vi.mocked(raiseFailureNotice)

const CONVERSATION = "c-1"

const FIRST: MessageLanding = {
	conversationId: CONVERSATION,
	messageId: "m-1",
	seq: 1,
}

const LATER: MessageLanding = {
	conversationId: CONVERSATION,
	messageId: "m-2",
	seq: 2,
}

const LOADED: TranscriptMessage[] = [
	message({ id: FIRST.messageId, conversationId: CONVERSATION, seq: 1 }),
	message({ id: LATER.messageId, conversationId: CONVERSATION, seq: 2 }),
]

type Read = {
	resolve: (window: TranscriptMessage[]) => void
	reject: (reason: unknown) => void
}

const supersededLanding = () => {
	const reads = new Map<number, Read>()
	const onLand = vi.fn(() => true)
	const onTaken = vi.fn()
	const landOn = (seq: number) =>
		new Promise<TranscriptMessage[]>((resolve, reject) => {
			reads.set(seq, { resolve, reject })
		})

	const { rerender } = renderHook(
		(landing: MessageLanding) =>
			useMessageLanding({
				conversationId: CONVERSATION,
				landOn,
				landing,
				messages: LOADED,
				onLand,
				onTaken,
			}),
		{ initialProps: FIRST },
	)

	rerender(LATER)

	return { first: reads.get(FIRST.seq), onLand, onTaken }
}

const settle = () => act(async () => undefined)

beforeEach(() => {
	notice.mockClear()
})

afterEach(cleanup)

it("ignores a landing read that resolves once a later landing was asked for", async () => {
	const { first, onLand } = supersededLanding()

	first?.resolve(LOADED)
	await settle()

	expect(onLand).not.toHaveBeenCalled()
})

it("raises no notice when the read of a superseded landing fails", async () => {
	const { first } = supersededLanding()

	first?.reject(new Error("refused"))
	await settle()

	expect(notice).not.toHaveBeenCalled()
})
