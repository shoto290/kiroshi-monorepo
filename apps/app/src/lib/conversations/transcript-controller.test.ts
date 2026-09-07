import { describe, expect, it } from "vitest"

import { createFakeTranscriptPort } from "./fake-transcript-port"
import {
	TRANSCRIPT_WINDOW_SIZE,
	type TranscriptDraft,
	type TranscriptMessage,
} from "./transcript-contract"
import {
	createTranscriptController,
	type TranscriptController,
} from "./transcript-controller"
import {
	CONVERSATION,
	message,
	OTHER_CONVERSATION,
} from "./transcript-fixtures"
import type { TranscriptPort } from "./transcript-port"
import {
	selectHasMore,
	selectHasNewer,
	selectMessages,
} from "./transcript-state"

const PAGE_SIZE = 2

const STORED: TranscriptMessage[] = [
	message({ id: "m-1", seq: 1 }),
	message({ id: "m-2", seq: 2 }),
	message({ id: "m-3", seq: 3 }),
	message({ id: "m-4", seq: 4 }),
	message({ id: "o-1", seq: 1, conversationId: OTHER_CONVERSATION }),
	message({ id: "o-2", seq: 2, conversationId: OTHER_CONVERSATION }),
]

type Harness = {
	controller: TranscriptController
	reads: () => number
}

const createHarness = (messages: TranscriptMessage[] = STORED): Harness => {
	const fake = createFakeTranscriptPort({ messages, pageSize: PAGE_SIZE })
	let reads = 0
	const port: TranscriptPort = {
		loadPage: (conversationId, cursor) => {
			reads += 1
			return fake.loadPage(conversationId, cursor)
		},
		loadWindow: (conversationId, seq) => {
			reads += 1
			return fake.loadWindow(conversationId, seq)
		},
	}
	return { controller: createTranscriptController(port), reads: () => reads }
}

const idsOf = (
	controller: TranscriptController,
	conversationId = CONVERSATION,
): string[] =>
	selectMessages(controller.getState(), conversationId).map((entry) => entry.id)

const draft = (overrides: Partial<TranscriptDraft>): TranscriptDraft => ({
	id: "local-1",
	conversationId: CONVERSATION,
	turnId: "t-9",
	role: "user",
	content: "hello",
	completion: "pending",
	createdAt: 0,
	authorBotId: null,
	repliedToMessageId: null,
	runtimeSessionId: null,
	...overrides,
})

describe("createTranscriptController", () => {
	it("reads the tail of a conversation and reports the history it left behind", async () => {
		const { controller } = createHarness()

		await controller.load(CONVERSATION)

		expect(idsOf(controller)).toEqual(["m-3", "m-4"])
		expect(selectHasMore(controller.getState(), CONVERSATION)).toBe(true)
	})

	it("walks back page by page until the history is exhausted", async () => {
		const { controller, reads } = createHarness()

		await controller.load(CONVERSATION)
		await controller.loadOlder(CONVERSATION)

		expect(idsOf(controller)).toEqual(["m-1", "m-2", "m-3", "m-4"])
		expect(selectHasMore(controller.getState(), CONVERSATION)).toBe(false)

		await controller.loadOlder(CONVERSATION)

		expect(reads()).toBe(2)
		expect(idsOf(controller)).toEqual(["m-1", "m-2", "m-3", "m-4"])
	})

	it("asks for nothing older while the conversation is still unread", async () => {
		const { controller, reads } = createHarness()

		await controller.loadOlder(CONVERSATION)

		expect(reads()).toBe(0)
		expect(idsOf(controller)).toEqual([])
	})

	it("re-reads the tail without duplicating or reordering the transcript", async () => {
		const { controller } = createHarness()

		await controller.load(CONVERSATION)
		await controller.loadOlder(CONVERSATION)
		await controller.load(CONVERSATION)

		expect(idsOf(controller)).toEqual(["m-1", "m-2", "m-3", "m-4"])
		expect(selectHasMore(controller.getState(), CONVERSATION)).toBe(false)
	})

	it("selects two conversations without either leaking into the other", async () => {
		const { controller } = createHarness()

		await controller.load(CONVERSATION)
		const first = controller.getState()
		await controller.load(OTHER_CONVERSATION)
		const both = controller.getState()
		await controller.loadOlder(CONVERSATION)

		expect(idsOf(controller)).toEqual(["m-1", "m-2", "m-3", "m-4"])
		expect(idsOf(controller, OTHER_CONVERSATION)).toEqual(["o-1", "o-2"])
		expect(selectHasMore(controller.getState(), OTHER_CONVERSATION)).toBe(false)
		expect(both.conversations[CONVERSATION]).toBe(
			first.conversations[CONVERSATION],
		)
		expect(controller.getState().conversations[OTHER_CONVERSATION]).toBe(
			both.conversations[OTHER_CONVERSATION],
		)
	})

	it("reconciles an optimistic message with the durable row the next read brings back", async () => {
		const durable = message({
			id: "local-1",
			seq: 5,
			role: "user",
			content: "hello",
			completion: "complete",
			turnId: "t-9",
			createdAt: 42,
		})
		const { controller } = createHarness([...STORED, durable])

		controller.append(draft({}))
		expect(
			selectMessages(controller.getState(), CONVERSATION)[0],
		).toMatchObject({
			id: "local-1",
			seq: 1,
			completion: "pending",
		})

		await controller.load(CONVERSATION)

		expect(idsOf(controller)).toEqual(["m-4", "local-1"])
		expect(
			selectMessages(controller.getState(), CONVERSATION)[1],
		).toMatchObject({
			seq: 5,
			completion: "complete",
			createdAt: 42,
		})
	})

	it("streams an appended answer and settles it once", async () => {
		const { controller } = createHarness()
		await controller.load(CONVERSATION)

		controller.append(
			draft({
				id: "a-1",
				role: "assistant",
				content: "",
				completion: "streaming",
			}),
		)
		controller.stream({
			conversationId: CONVERSATION,
			id: "a-1",
			text: "Hello",
		})
		controller.stream({
			conversationId: CONVERSATION,
			id: "a-1",
			text: " world",
		})
		controller.settle({
			conversationId: CONVERSATION,
			id: "a-1",
			completion: "complete",
		})
		controller.stream({
			conversationId: CONVERSATION,
			id: "a-1",
			text: " late",
		})

		expect(
			selectMessages(controller.getState(), CONVERSATION).at(-1),
		).toMatchObject({
			id: "a-1",
			seq: 5,
			content: "Hello world",
			completion: "complete",
		})
	})

	it("notifies subscribers on a change and stops once they leave", async () => {
		const { controller } = createHarness()
		let notifications = 0
		const unsubscribe = controller.subscribe(() => {
			notifications += 1
		})

		await controller.load(CONVERSATION)
		controller.append(draft({}))
		controller.append(draft({}))
		expect(notifications).toBe(2)

		unsubscribe()
		await controller.loadOlder(CONVERSATION)

		expect(notifications).toBe(2)
		expect(idsOf(controller)).toEqual(["m-1", "m-2", "m-3", "m-4", "local-1"])
	})

	it("holds the window only while the reader sits at the live edge", () => {
		const say = (controller: TranscriptController) => {
			for (let index = 0; index <= TRANSCRIPT_WINDOW_SIZE; index += 1) {
				controller.append(
					draft({
						id: `said-${index}`,
						turnId: `t-${index}`,
						completion: "complete",
					}),
				)
			}
		}

		const followed = createHarness().controller
		say(followed)

		expect(idsOf(followed)).toHaveLength(TRANSCRIPT_WINDOW_SIZE)
		expect(idsOf(followed)).not.toContain("said-0")
		expect(selectHasMore(followed.getState(), CONVERSATION)).toBe(true)

		const read = createHarness().controller
		read.follow(CONVERSATION, false)
		say(read)

		expect(idsOf(read)).toHaveLength(TRANSCRIPT_WINDOW_SIZE + 1)
		expect(selectHasMore(read.getState(), CONVERSATION)).toBe(false)
	})
})
describe("a landing window nobody is waiting for", () => {
	const LONG = Array.from({ length: TRANSCRIPT_WINDOW_SIZE * 2 }, (_, index) =>
		message({ id: `m-${index + 1}`, seq: index + 1 }),
	)

	const EARLIER_SEQ = 20

	const LATER_SEQ = 100

	const gatedLanding = () => {
		const fake = createFakeTranscriptPort({ messages: LONG })
		let release = (): void => undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const port: TranscriptPort = {
			loadPage: fake.loadPage,
			loadWindow: async (conversationId, seq) => {
				await gate
				return fake.loadWindow(conversationId, seq)
			},
		}
		return { controller: createTranscriptController(port), release }
	}

	it("installs the window while the reader stays in the thread", async () => {
		const { controller, release } = gatedLanding()

		const landing = controller.askLanding(CONVERSATION, EARLIER_SEQ)()
		release()
		await landing

		expect(idsOf(controller)).toContain(`m-${EARLIER_SEQ}`)
		expect(selectHasNewer(controller.getState(), CONVERSATION)).toBe(true)
	})

	it("installs no window when the reader leaves before the read starts", async () => {
		const { controller, release } = gatedLanding()
		await controller.load(CONVERSATION)
		release()

		const read = controller.askLanding(CONVERSATION, EARLIER_SEQ)
		controller.leave(CONVERSATION)
		await read()

		expect(idsOf(controller)).not.toContain(`m-${EARLIER_SEQ}`)
		expect(selectHasNewer(controller.getState(), CONVERSATION)).toBe(false)
	})

	it("installs no window when the reader leaves while the read is in flight", async () => {
		const { controller, release } = gatedLanding()
		await controller.load(CONVERSATION)

		const landing = controller.askLanding(CONVERSATION, EARLIER_SEQ)()
		controller.leave(CONVERSATION)
		release()
		await landing

		expect(idsOf(controller)).not.toContain(`m-${EARLIER_SEQ}`)
		expect(selectHasNewer(controller.getState(), CONVERSATION)).toBe(false)
	})

	it("shows a message appended to the thread the reader left that way", async () => {
		const { controller, release } = gatedLanding()
		await controller.load(CONVERSATION)

		const landing = controller.askLanding(CONVERSATION, EARLIER_SEQ)()
		controller.leave(CONVERSATION)
		release()
		await landing

		controller.append(draft({ id: "said-while-away" }))

		expect(idsOf(controller)).toContain("said-while-away")
	})

	it("installs the window of the later landing only", async () => {
		const { controller, release } = gatedLanding()
		release()

		const earlier = controller.askLanding(CONVERSATION, EARLIER_SEQ)
		const later = controller.askLanding(CONVERSATION, LATER_SEQ)

		await earlier()

		expect(idsOf(controller)).toEqual([])

		await later()

		expect(idsOf(controller)).toContain(`m-${LATER_SEQ}`)
		expect(idsOf(controller)).not.toContain(`m-${EARLIER_SEQ}`)
	})
})
