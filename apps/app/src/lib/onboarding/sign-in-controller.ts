import type { OnboardingPort } from "./onboarding-port"
import {
	type ConnectionStep,
	createSignInFlow,
	type SignInActions,
} from "./sign-in-flow"

import { createStore } from "../store"
import type { ChatController } from "../chat/chat-controller"
import { isSignedOut } from "../chat/screen-model"

export type SignInState = {
	botId: string | null
	connection: ConnectionStep | null
	round: number
	isBusy: boolean
}

export type SignInWorld = {
	reopen: (botId: string) => Promise<void>
}

export type SignInController = SignInActions & {
	getState: () => SignInState
	subscribe: (listener: () => void) => () => void
	offer: (botId: string) => void
}

const initialSignInState: SignInState = {
	botId: null,
	connection: null,
	round: 0,
	isBusy: false,
}

export const createSignInController = (
	port: OnboardingPort,
	world: SignInWorld,
): SignInController => {
	const stateStore = createStore(initialSignInState)
	const current = stateStore.getState

	const set = (fields: Partial<SignInState>) =>
		stateStore.setState({ ...current(), ...fields })

	const showConnection = (connection: ConnectionStep) => {
		set({ connection, round: current().round + 1, isBusy: false })
	}

	const settle = async () => {
		const { botId, round } = current()
		set({ connection: null, round: round + 1 })
		if (botId) {
			await world.reopen(botId)
		}
	}

	const { actions } = createSignInFlow(port, {
		showConnection,
		setBusy: (isBusy) => set({ isBusy }),
		settle,
	})

	return {
		...actions,

		getState: current,

		subscribe: stateStore.subscribe,

		offer: (botId) => {
			set({ botId })
			showConnection({ state: "offer" })
		},
	}
}

type SignInScene = {
	chat: ChatController
	selectedBotId: () => string | null
}

export const signInWorldOf = ({
	chat,
	selectedBotId,
}: SignInScene): SignInWorld => ({
	reopen: async (botId) => {
		if (selectedBotId() !== botId) {
			return
		}
		const latest = chat.getState().errors.at(-1)
		if (latest && isSignedOut(latest.error)) {
			chat.dismissError(latest.id)
		}
		await chat.restart()
	},
})
