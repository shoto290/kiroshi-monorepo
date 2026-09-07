// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, expect, it, vi } from "vitest"

import "@workspace/ui/lib/i18n"

import type { FakeChatDriver } from "@/lib/chat/fake-driver"
import { createFakeChatDriver } from "@/lib/chat/fake-driver"
import { createFakeTranscriptStore } from "@/lib/conversations/fake-transcript-store"
import type { TranscriptStore } from "@/lib/conversations/store-port"
import { type FakeLayout, fakeLayout } from "@/lib/perf/fake-layout"

const harness = vi.hoisted(
	(): { store: TranscriptStore | null; driver: FakeChatDriver | null } => ({
		store: null,
		driver: null,
	}),
)

vi.mock("@/lib/conversations/create-store", () => ({
	createTranscriptStore: () => harness.store,
}))

vi.mock("@/lib/chat/create-driver", () => ({
	createChatDriver: () => harness.driver,
}))

const { App } = await import("@/App")

const HOME = "personal"

const BOT = "default"

const HOME_WORD = "The home thread remembers this."

const AWAY_WORD = "The Vocca thread remembers that."

const MOUNT_MS = 200

const STEP_MS = 1

let layout: FakeLayout | null = null

let said = 0

const saidIn = async (
	store: TranscriptStore,
	conversationId: string,
	content: string,
) => {
	said += 1
	const turnId = `turn-${said}`
	await store.startTurn({ conversationId, id: turnId, startedAt: said })
	await store.appendUserMessage({
		id: `said-${said}`,
		conversationId,
		turnId,
		authorBotId: null,
		repliedToMessageId: null,
		content,
		createdAt: said,
	})
}

const settle = async (ms: number) => {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})
}

const aSharedBot = async () => {
	layout = fakeLayout()
	const store = createFakeTranscriptStore()
	const elsewhere = await store.createSpace("Vocca")
	await store.addBotToSpace(BOT, elsewhere.id)
	await saidIn(store, (await store.mainChat(BOT, HOME)).id, HOME_WORD)
	await saidIn(store, (await store.mainChat(BOT, elsewhere.id)).id, AWAY_WORD)
	harness.store = store
	harness.driver = createFakeChatDriver({ stepMs: STEP_MS })
	render(createElement(App))
	await settle(MOUNT_MS)
}

const textIn = (slot: string) =>
	[...document.querySelectorAll(`[data-slot="${slot}"]`)]
		.map((held) => held.textContent ?? "")
		.join(" ")

const threadText = () => textIn("chat-turn-group")

const previewText = () => textIn("roster-row-preview")

const enterSpace = async (name: string) => {
	fireEvent.click(screen.getByRole("button", { name: `Open ${name}` }))
	await settle(MOUNT_MS)
}

afterEach(() => {
	layout?.restore()
	layout = null
	cleanup()
	vi.useRealTimers()
})

it("opens the solo thread of the space entered and leaves the one it left", async () => {
	vi.useFakeTimers()
	await aSharedBot()

	expect(threadText()).toContain(HOME_WORD)
	expect(previewText()).toContain(HOME_WORD)

	await enterSpace("Vocca")

	expect(threadText()).toContain(AWAY_WORD)
	expect(threadText()).not.toContain(HOME_WORD)
	expect(previewText()).toContain(AWAY_WORD)

	await enterSpace("Personal")

	expect(threadText()).toContain(HOME_WORD)
	expect(threadText()).not.toContain(AWAY_WORD)
})
