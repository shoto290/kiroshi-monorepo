import { describe, expect, it } from "vitest"

import { createFakeOnboardingPort } from "./fake-onboarding-port"
import {
	createFakeOnboardingWorld,
	type FakeOnboardingWorld,
	SUGGESTED_SCOUT,
} from "./fake-onboarding-world"
import {
	createOnboardingController,
	type OnboardingController,
} from "./onboarding-controller"
import {
	onboardingSummonsFor,
	withoutOnboardingSummons,
} from "./onboarding-summons"
import { onboardingTailOf } from "./onboarding-tail"
import type { Onboarding } from "./use-onboarding"

import { type ChatState, initialChatState } from "../chat/chat-state"
import type { TranscriptRow } from "../chat/screen-model"
import { message } from "../conversations/transcript-fixtures"

const GREETING = onboardingSummonsFor("greeting")

const SUMMONS_TURN = "t-summons"

const HOME_BOT = "bot-home"

const OTHER_BOT = "bot-other"

let world: FakeOnboardingWorld

const controllerOf = (): OnboardingController => {
	world = createFakeOnboardingWorld()
	return createOnboardingController(createFakeOnboardingPort(), world)
}

const settled = async (): Promise<OnboardingController> => {
	const port = createFakeOnboardingPort()
	port.report = {
		connection: "ready",
		binaryVersion: null,
		authenticated: true,
		error: null,
		account: { email: null, plan: null },
	}
	world = createFakeOnboardingWorld()
	const controller = createOnboardingController(port, world)
	await controller.start()

	return controller
}

const onboardingOf = (controller: OnboardingController): Onboarding => ({
	state: controller.getState(),
	controller,
})

const chatWith = (overrides: Partial<ChatState> = {}): ChatState => ({
	...initialChatState,
	...overrides,
})

const summonsAsked = message({
	id: "m-summons",
	turnId: SUMMONS_TURN,
	role: "user",
	content: GREETING,
})

const answered = message({
	id: "m-answer",
	turnId: SUMMONS_TURN,
	role: "assistant",
	authorBotId: "bot-1",
	content: "Hello.",
})

describe("the onboarding tail", () => {
	it("stands down once the first run is done", async () => {
		const controller = controllerOf()
		await controller.finish()

		expect(
			onboardingTailOf(onboardingOf(controller), chatWith(), HOME_BOT),
		).toBeNull()
	})

	it("stands down when no onboarding is running", () => {
		expect(onboardingTailOf(undefined, chatWith(), HOME_BOT)).toBeNull()
	})

	it("shows the welcome card before any step is taken", () => {
		const tail = onboardingTailOf(
			onboardingOf(controllerOf()),
			chatWith(),
			HOME_BOT,
		)

		expect(tail?.hasWelcome).toBe(true)
		expect(tail?.hasPill).toBe(false)
	})

	it("shows the pill alone while the summoned turn is pending", async () => {
		const controller = await settled()
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith({ messages: [summonsAsked] }),
			HOME_BOT,
		)

		expect(tail?.hasPill).toBe(true)
		expect(tail?.hasTest).toBe(false)
		expect(tail?.turnFailure).toBeNull()
	})

	it("shows the test card once the answer landed", async () => {
		const controller = await settled()
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith({ messages: [summonsAsked, answered] }),
			HOME_BOT,
		)

		expect(tail?.hasTest).toBe(true)
		expect(tail?.turnFailure).toBeNull()
	})

	it("shows the failure detail and no test card when the turn failed", async () => {
		const controller = await settled()
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith({
				messages: [summonsAsked],
				turn: "failed",
				errors: [
					{
						id: "crashed-0",
						error: { kind: "crashed", code: 1, detail: "the agent stopped" },
					},
				],
			}),
			HOME_BOT,
		)

		expect(tail?.turnFailure).toBe("the agent stopped")
		expect(tail?.hasTest).toBe(false)
	})

	it("stands down in a conversation the onboarding did not start in", async () => {
		const controller = await settled()

		expect(
			onboardingTailOf(onboardingOf(controller), chatWith(), OTHER_BOT),
		).toBeNull()
	})

	it("shows the picker options once the reader picked", async () => {
		const controller = await settled()
		await controller.pickCompanion()
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith(),
			HOME_BOT,
		)

		expect(tail?.picks).toHaveLength(world.suggestions.length)
		expect(tail?.hasTest).toBe(false)
		expect(tail?.handoff).toBeNull()
	})

	it("keeps the picker under the reason when the creation is refused", async () => {
		const controller = await settled()
		await controller.pickCompanion()
		world.refusals.create = { kind: "storage", detail: "disk is full" }
		await controller.addCompanion(SUGGESTED_SCOUT.id)
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith(),
			HOME_BOT,
		)

		expect(tail?.pickFailure).toBe("disk is full")
		expect(tail?.picks).toHaveLength(world.suggestions.length)
	})

	it("shows the handoff once the companion is created", async () => {
		const controller = await settled()
		await controller.pickCompanion()
		await controller.addCompanion(SUGGESTED_SCOUT.id)
		const tail = onboardingTailOf(
			onboardingOf(controller),
			chatWith(),
			HOME_BOT,
		)

		expect(tail?.handoff?.name).toBe(SUGGESTED_SCOUT.name)
		expect(tail?.picks).toBeNull()
	})
})

const rowOf = (overrides: Partial<TranscriptRow>): TranscriptRow => ({
	messageId: "m-1",
	turnId: SUMMONS_TURN,
	blockIndex: 0,
	quotedMessageId: null,
	authorBotId: null,
	role: "user",
	text: "",
	timestamp: 0,
	completion: "complete",
	...overrides,
})

describe("the summons row", () => {
	it("drops the summons the reader never wrote", () => {
		const kept = withoutOnboardingSummons([
			rowOf({ text: GREETING }),
			rowOf({
				messageId: "m-2",
				role: "assistant",
				authorBotId: "bot-1",
				text: "Hello.",
			}),
		])

		expect(kept.map(({ text }) => text)).toEqual(["Hello."])
	})

	it("drops the summons that opened the created companion thread", () => {
		const kept = withoutOnboardingSummons([
			rowOf({ text: onboardingSummonsFor("arrival") }),
		])

		expect(kept).toHaveLength(0)
	})

	it("keeps a reader line that only looks like one", () => {
		const kept = withoutOnboardingSummons([rowOf({ text: "Say hello." })])

		expect(kept).toHaveLength(1)
	})
})
