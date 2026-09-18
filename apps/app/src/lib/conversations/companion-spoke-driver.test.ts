import { describe, expect, it } from "vitest"

import type { NoticeMessage } from "@workspace/ui/components/notice-surface"

import { startCompanionSpokeDriver } from "./companion-spoke-driver"
import {
	type ConversationRuntimes,
	createConversationRuntimes,
} from "./conversation-runtimes"
import { createFakeTranscriptStore } from "./fake-transcript-store"
import { createScriptedDriver, type ScriptedDriver } from "./scripted-driver"
import type { Conversation } from "./store-contract"
import type { TranscriptStore } from "./store-port"
import type { CompanionSpoke } from "./transcript-contract"
import { seatBots } from "./transcript-fixtures"

const SPACE = "personal"

const settled = async () => {
	for (let round = 0; round < 60; round += 1) {
		await Promise.resolve()
	}
}

const idOf = (conversation: Conversation, name: string) => {
	const seat = conversation.participants.find(
		(participant) => participant.name === name,
	)
	if (!seat) {
		throw new Error(`no seat for ${name}`)
	}
	return seat.botId
}

type Room = {
	driver: ScriptedDriver
	store: TranscriptStore
	runtimes: ConversationRuntimes
	conversation: Conversation
	notices: NoticeMessage[]
	announce: (spoken: CompanionSpoke) => Promise<void>
	stop: () => void
}

const createRoom = async (
	store: TranscriptStore = createFakeTranscriptStore(),
): Promise<Room> => {
	const driver = createScriptedDriver()
	const bots = await seatBots(store, SPACE, ["Ada", "Nyx", "Rex"])
	const conversation = await store.createConversation({
		spaceId: SPACE,
		sectionId: null,
		title: "Walls",
		botIds: bots.map((bot) => bot.id),
	})
	const runtimes = createConversationRuntimes(driver, store)
	const notices: NoticeMessage[] = []
	let heard: ((spoken: CompanionSpoke) => void) | null = null
	const stop = startCompanionSpokeDriver({
		runtimes,
		companions: {
			onCompanionSpoke: (listener) => {
				heard = listener
				return Promise.resolve(() => {
					heard = null
				})
			},
		},
		reportFailure: (notice) => {
			notices.push(notice)
		},
	})
	await settled()

	const announce = async (spoken: CompanionSpoke) => {
		heard?.(spoken)
		await settled()
	}

	return { driver, store, runtimes, conversation, notices, announce, stop }
}

const refusingFirstRead = (store: TranscriptStore): TranscriptStore => {
	let reads = 0
	return {
		...store,
		spaces: () => {
			reads += 1
			return reads === 1 ? Promise.reject(new Error("refused")) : store.spaces()
		},
	}
}

const blindOnFirstRead = (store: TranscriptStore): TranscriptStore => {
	let reads = 0
	return {
		...store,
		spaces: () => {
			reads += 1
			return reads === 1 ? Promise.resolve([]) : store.spaces()
		},
	}
}

const spokenIn = async (store: TranscriptStore, conversationId: string) => {
	const page = await store.loadPage(conversationId, null)
	return page.messages
}

const summonedBy = (driver: ScriptedDriver) =>
	driver.submissions.map(({ scope }) => scope.botId)

describe("a companion speaking in a room the front never opened", () => {
	it("writes its text as an assistant message of its author", async () => {
		const { store, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		})

		const messages = await spokenIn(store, conversation.id)
		expect(
			messages.map(({ role, content, authorBotId }) => ({
				role,
				content,
				authorBotId,
			})),
		).toEqual([
			{ role: "assistant", content: "Walls are up.", authorBotId: ada },
		])
	})

	it("leaves the turn of that message without a cause", async () => {
		const { store, runtimes, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		})

		const [spoken] = await spokenIn(store, conversation.id)
		const held = runtimes.runtimeFor(conversation.id)

		expect(held.getState().reportedCauses.get(spoken.turnId)).toBeUndefined()
	})

	it("stores the at-name of a seated companion as its mention token", async () => {
		const { store, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")
		const nyx = idOf(conversation, "Nyx")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up. @Nyx, read it.",
		})

		const [spoken] = await spokenIn(store, conversation.id)
		expect(spoken.content).toBe(`Walls are up. <@${nyx}>, read it.`)
	})

	it("stores an at-name nobody answers to unchanged and summons nobody", async () => {
		const { driver, store, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up. @Zoe, read it.",
		})

		const [spoken] = await spokenIn(store, conversation.id)
		expect(spoken.content).toBe("Walls are up. @Zoe, read it.")
		expect(summonedBy(driver)).toEqual([])
	})

	it("summons every seated companion the text names", async () => {
		const { driver, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")
		const nyx = idOf(conversation, "Nyx")
		const rex = idOf(conversation, "Rex")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "@Nyx and @Rex, read the walls.",
		})

		expect(summonedBy(driver)).toEqual([nyx, rex])
		expect(driver.submissions[0].prompt).toContain(`<@${nyx}>`)
	})

	it("summons nobody when the text names no seated companion", async () => {
		const { driver, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		})

		expect(summonedBy(driver)).toEqual([])
	})

	it("writes nothing and raises no notice for an unknown conversation", async () => {
		const { driver, store, conversation, notices, announce } =
			await createRoom()
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: "conversation-ghost",
			authorBotId: ada,
			text: "Walls are up. @Nyx, read it.",
		})

		expect(await spokenIn(store, conversation.id)).toEqual([])
		expect(summonedBy(driver)).toEqual([])
		expect(notices).toEqual([])
	})

	it("raises a failure and writes on redelivery when the conversation cannot be read", async () => {
		const { store, conversation, notices, announce } = await createRoom(
			refusingFirstRead(createFakeTranscriptStore()),
		)
		const ada = idOf(conversation, "Ada")
		const spoken: CompanionSpoke = {
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		}

		await announce(spoken)

		expect(notices).toHaveLength(1)
		expect(await spokenIn(store, conversation.id)).toEqual([])

		await announce({ ...spoken })

		expect(
			(await spokenIn(store, conversation.id)).map(({ content }) => content),
		).toEqual(["Walls are up."])
	})

	it("keeps an unknown conversation deduped when it later shows up", async () => {
		const { store, conversation, notices, announce } = await createRoom(
			blindOnFirstRead(createFakeTranscriptStore()),
		)
		const ada = idOf(conversation, "Ada")
		const spoken: CompanionSpoke = {
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		}

		await announce(spoken)
		await announce({ ...spoken })

		expect(await spokenIn(store, conversation.id)).toEqual([])
		expect(notices).toEqual([])
	})

	it("raises a failure when companion messages cannot be listened to", async () => {
		const notices: NoticeMessage[] = []
		startCompanionSpokeDriver({
			runtimes: createConversationRuntimes(
				createScriptedDriver(),
				createFakeTranscriptStore(),
			),
			companions: {
				onCompanionSpoke: () => Promise.reject(new Error("refused")),
			},
			reportFailure: (notice) => {
				notices.push(notice)
			},
		})
		await settled()

		expect(notices).toHaveLength(1)
	})

	it("writes nothing and raises no notice for an author holding no seat", async () => {
		const { driver, store, conversation, notices, announce } =
			await createRoom()

		await announce({
			conversationId: conversation.id,
			authorBotId: "bot-ghost",
			text: "Walls are up. @Nyx, read it.",
		})

		expect(await spokenIn(store, conversation.id)).toEqual([])
		expect(summonedBy(driver)).toEqual([])
		expect(notices).toEqual([])
	})

	it("writes one message and opens one wave for a payload delivered twice", async () => {
		const { driver, store, conversation, announce } = await createRoom()
		const ada = idOf(conversation, "Ada")
		const nyx = idOf(conversation, "Nyx")
		const spoken: CompanionSpoke = {
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up. @Nyx, read it.",
		}

		await announce(spoken)
		await announce({ ...spoken })

		expect(await spokenIn(store, conversation.id)).toHaveLength(1)
		expect(summonedBy(driver)).toEqual([nyx])
	})

	it("summons nobody and raises a failure when the message cannot be written", async () => {
		const base = createFakeTranscriptStore()
		const { driver, conversation, notices, announce } = await createRoom({
			...base,
			openAssistantMessage: () => Promise.reject(new Error("refused")),
		})
		const ada = idOf(conversation, "Ada")

		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up. @Nyx, read it.",
		})

		expect(summonedBy(driver)).toEqual([])
		expect(notices).toHaveLength(1)
	})

	it("stops listening when the mount that started it goes away", async () => {
		const { store, conversation, announce, stop } = await createRoom()
		const ada = idOf(conversation, "Ada")

		stop()
		await settled()
		await announce({
			conversationId: conversation.id,
			authorBotId: ada,
			text: "Walls are up.",
		})

		expect(await spokenIn(store, conversation.id)).toEqual([])
	})
})
