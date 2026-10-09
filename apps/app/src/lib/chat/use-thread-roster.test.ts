// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ReplyTarget } from "./screen-model"
import { useThreadNaming } from "./use-thread-roster"

const READER = "Sam"

const targetBy = (authorAccountId: string | null): ReplyTarget => ({
	messageId: "m-1",
	role: "user",
	excerpt: "hello",
	authorBotId: null,
	authorAccountId,
	authorName: authorAccountId ? "Tom" : null,
})

const quotedAuthorOf = (target: ReplyTarget) => {
	const { result } = renderHook(() =>
		useThreadNaming({
			bots: [],
			present: [],
			authors: new Map(),
			botFace: null,
			reader: READER,
			unnamed: "No name",
			personOf: (author) =>
				author.authorAccountId === "account-tom"
					? (author.authorName ?? undefined)
					: undefined,
			isConversation: true,
			onJump: () => undefined,
		}),
	)
	return result.current.toQuote(target).author
}

describe("the author a reply quotes", () => {
	it("names another person's message after that person", () => {
		expect(quotedAuthorOf(targetBy("account-tom"))).toBe("Tom")
	})

	it("names the reader's own message after the reader", () => {
		expect(quotedAuthorOf(targetBy(null))).toBe(READER)
	})
})
