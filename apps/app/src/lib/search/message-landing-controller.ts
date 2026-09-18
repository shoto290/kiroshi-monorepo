import { createOpenedController } from "../opened-controller"

export type MessageLanding = {
	conversationId: string
	messageId: string
	seq: number
}

export type MessageLandingController = {
	getState: () => MessageLanding | null
	subscribe: (listener: () => void) => () => void
	record: (landing: MessageLanding) => void
	forget: (landing: MessageLanding) => void
}

export const createMessageLandingController = (): MessageLandingController => {
	const landing = createOpenedController<MessageLanding>()

	return {
		getState: landing.getState,
		subscribe: landing.subscribe,
		record: landing.open,
		forget: (taken) => {
			if (landing.getState() === taken) {
				landing.leave()
			}
		},
	}
}
