import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	BOT,
	bootedHarness,
	deferred,
	REPLY,
	recordingStore,
	referentialStore,
	reload,
	runOf,
	spoken,
} from "./controller-fixtures"

import type { ChatDriver } from "../driver"
import type { FakeChatDriver } from "../fake-driver"
import { questionMessageIdOf } from "../question-message"
import type { AgentCommand, AgentEvent } from "../../agent/contract"
import { createFakeTranscriptStore } from "../../conversations/fake-transcript-store"
import type { TranscriptStore } from "../../conversations/store-port"
import type { TranscriptCompletion } from "../../conversations/transcript-contract"
import { botIdentity, named } from "../../conversations/transcript-fixtures"

describe("createChatController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("answers a question raised before any assistant text was published", async () => {
		const store = referentialStore(createFakeTranscriptStore())
		const { controller } = await bootedHarness({ store })
		await controller.send("pick one /question")
		await vi.runAllTimersAsync()

		const asked = controller.getState().question
		expect(asked).not.toBeNull()

		await controller.send("never mind, do it your way")
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.errors).toEqual([])
		const answered = state.messages.find(
			(message) => message.content === "never mind, do it your way",
		)
		expect(answered?.role).toBe("user")
		expect(answered?.repliedToMessageId).toBe(
			questionMessageIdOf(asked?.id ?? ""),
		)
		expect(spoken(await reload(store))).toEqual(spoken(state.messages))
	})

	it("keeps recording the turn still running in the thread left behind", async () => {
		const store = createFakeTranscriptStore()
		const elsewhere = await store.createSpace("Vocca")
		await store.addBotToSpace(BOT, elsewhere.id)
		const { controller } = await bootedHarness({ store })

		await controller.send("hello")
		await controller.open(BOT, elsewhere.id)
		await vi.runAllTimersAsync()

		expect(spoken(await reload(store))).toEqual([
			["user", "hello", "complete"],
			["assistant", REPLY, "complete"],
		])
	})
})

describe("every ending survives a launch", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const endings: [string, string, TranscriptCompletion][] = [
		["a turn that finished", "hello", "complete"],
		["a turn that crashed", "explain /fail", "failed"],
	]

	it.each(endings)(
		"brings %s back as it ended",
		async (_name, prompt, ending) => {
			const { controller, store } = await bootedHarness()

			await controller.send(prompt)
			await vi.runAllTimersAsync()

			const live = controller.getState().messages
			expect(live.at(-1)?.completion).toBe(ending)
			expect(spoken(await reload(store))).toEqual(spoken(live))
		},
	)
})

describe("the provider session a run answered under", () => {
	const REFUSED_BY_THE_STORE = {
		kind: "writeFailed",
		detail: "the transcript store refused it (storage, staleWrite)",
	}

	const STALE_WRITE = { kind: "storage", failure: { kind: "staleWrite" } }

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const announced = (sessionId: string): AgentEvent => ({
		type: "sessionReady",
		sessionId,
		resumed: false,
	})

	it("writes the id the child announces against the run it is answering in", async () => {
		const base = createFakeTranscriptStore()
		const { store, recorded } = recordingStore(base)
		const { controller } = await bootedHarness({ store })

		await controller.send("hello")
		await vi.runAllTimersAsync()

		const run = runOf(controller)
		const state = controller.getState()
		expect(state.sessionId).not.toBeNull()
		expect(recorded).toEqual([[run.runtimeSessionId, state.sessionId]])
		expect(state.errors).toEqual([])
		await expect(
			base.recordProviderSession(
				run.conversationId,
				run.botId,
				run.runtimeSessionId,
				"a-second-process",
			),
		).rejects.toEqual(STALE_WRITE)
	})

	it("takes the same announcement twice as the one write it is", async () => {
		const base = createFakeTranscriptStore()
		const { store, recorded } = recordingStore(base)
		const { controller, driver } = await bootedHarness({ store })
		await controller.send("hello")
		await vi.runAllTimersAsync()
		const run = runOf(controller)
		const sessionId = controller.getState().sessionId ?? ""

		driver.pushEvent(announced(sessionId), run)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(recorded).toEqual([
			[run.runtimeSessionId, sessionId],
			[run.runtimeSessionId, sessionId],
		])
		expect(state.errors).toEqual([])
		expect(state.sessionId).toBe(sessionId)
		expect(state.runtime).toEqual(run)
	})

	it("reports a second, different id without moving the run it holds", async () => {
		const base = createFakeTranscriptStore()
		const { store } = recordingStore(base)
		const { controller, driver } = await bootedHarness({ store })
		await controller.send("hello")
		await vi.runAllTimersAsync()
		const run = runOf(controller)

		driver.pushEvent(announced("a-second-process"), run)
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(state.errors.at(-1)?.error).toEqual(REFUSED_BY_THE_STORE)
		expect(state.runtime).toEqual(run)
		expect(state.turn).toBe("idle")
	})

	it("cannot write a replaced run's id onto the run that took its place", async () => {
		const base = createFakeTranscriptStore()
		const { store: recording, recorded } = recordingStore(base)
		const settled = deferred()
		const store: TranscriptStore = {
			...recording,
			recordProviderSession: async (
				conversationId,
				botId,
				runtimeSessionId,
				providerSessionId,
			) => {
				await settled.promise
				return recording.recordProviderSession(
					conversationId,
					botId,
					runtimeSessionId,
					providerSessionId,
				)
			},
		}
		const { controller, driver } = await bootedHarness({ store })
		const replaced = runOf(controller)

		driver.pushEvent(announced("stale-process"), replaced)
		await vi.advanceTimersByTimeAsync(0)
		await controller.restart()
		await vi.runAllTimersAsync()
		const replacement = runOf(controller)
		settled.release()
		await vi.runAllTimersAsync()

		const state = controller.getState()
		expect(replacement.runtimeSessionId).not.toBe(replaced.runtimeSessionId)
		expect(recorded).toEqual([[replaced.runtimeSessionId, "stale-process"]])
		expect(state.runtime).toEqual(replacement)
		expect(state.errors.at(-1)?.error).toEqual(REFUSED_BY_THE_STORE)
		await expect(
			base.recordProviderSession(
				replacement.conversationId,
				replacement.botId,
				replacement.runtimeSessionId,
				"its-own-process",
			),
		).resolves.toBeUndefined()
	})
})

describe("the commands a companion last announced", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const silentDriver = (fake: FakeChatDriver): ChatDriver => ({
		...fake,
		startOrResumeSession: () => Promise.resolve({ resumed: false }),
	})

	it("holds what a session announced against the companion it answered for", async () => {
		const store = createFakeTranscriptStore()
		const { controller, detach } = await bootedHarness({ store })

		const announced = controller.getState().commands

		expect(announced.length).toBeGreaterThan(0)
		expect(await store.botCommands(BOT)).toEqual(announced)
		detach()
	})

	it("offers what was last held before a session of its own has started", async () => {
		const store = createFakeTranscriptStore()
		const first = await bootedHarness({ store })
		const announced = first.controller.getState().commands
		first.detach()

		const next = await bootedHarness({ store, driver: silentDriver })

		expect(next.controller.getState().commands).toEqual(announced)
		next.detach()
	})

	it("replaces what it holds with what the next session named", async () => {
		const store = createFakeTranscriptStore()
		const { controller, driver, detach } = await bootedHarness({ store })

		driver.pushEvent(
			{ type: "commandsListed", commands: named("status") },
			runOf(controller),
		)
		await vi.runAllTimersAsync()

		expect(controller.getState().commands).toEqual(named("status"))
		expect(await store.botCommands(BOT)).toEqual(named("status"))
		detach()
	})

	it("offers no command for a companion no session has announced anything for", async () => {
		const store = createFakeTranscriptStore()
		const other = await store.createBot(botIdentity({ name: "Ada" }))
		const { controller, detach } = await bootedHarness({
			store,
			driver: silentDriver,
			botId: other.id,
		})

		expect(controller.getState().commands).toEqual([])
		expect(await store.botCommands(other.id)).toEqual([])
		detach()
	})

	it("keeps what the session named over a recall still in flight", async () => {
		const base = createFakeTranscriptStore()
		await base.recordBotCommands(BOT, named("from-the-record"))
		const read = deferred()
		const store: TranscriptStore = {
			...base,
			botCommands: async (botId: string) => {
				const held = await base.botCommands(botId)
				await read.promise
				return held
			},
		}
		const { controller, detach } = await bootedHarness({ store })
		const announced = controller.getState().commands

		read.release()
		await vi.runAllTimersAsync()

		expect(announced).not.toEqual(named("from-the-record"))
		expect(controller.getState().commands).toEqual(announced)
		detach()
	})

	it("writes nothing for a session announcing what the store already holds", async () => {
		const base = createFakeTranscriptStore()
		let written = 0
		const store: TranscriptStore = {
			...base,
			recordBotCommands: (botId: string, commands: AgentCommand[]) => {
				written += 1
				return base.recordBotCommands(botId, commands)
			},
		}
		const { controller, driver, detach } = await bootedHarness({ store })
		const announced = controller.getState().commands
		expect(written).toBe(1)

		driver.pushEvent(
			{ type: "commandsListed", commands: announced },
			runOf(controller),
		)
		await vi.runAllTimersAsync()

		expect(written).toBe(1)
		expect(await store.botCommands(BOT)).toEqual(announced)
		detach()
	})
})
