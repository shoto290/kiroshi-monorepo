import { expect, it } from "vitest"

import {
	createMessageLandingController,
	type MessageLanding,
} from "./message-landing-controller"

const landingOf = (messageId: string): MessageLanding => ({
	conversationId: "c-1",
	messageId,
	seq: 7,
})

it("forgets the landing that was taken", () => {
	const controller = createMessageLandingController()
	const taken = landingOf("m-1")

	controller.record(taken)
	controller.forget(taken)

	expect(controller.getState()).toBeNull()
})

it("keeps a landing recorded after the one before it is forgotten", () => {
	const controller = createMessageLandingController()
	const first = landingOf("m-1")
	const second = landingOf("m-2")

	controller.record(first)
	controller.record(second)
	controller.forget(first)

	expect(controller.getState()).toBe(second)
})
