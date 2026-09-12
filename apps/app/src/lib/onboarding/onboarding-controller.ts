import { exitDetailOf, isNotRunning } from "./onboarding-failure"
import type { OnboardingPort } from "./onboarding-port"
import {
	type OnboardingSummons,
	onboardingSummonsFor,
} from "./onboarding-summons"

import type { CheckReport } from "../agent/contract"

export type ConnectionCard =
	| { state: "detected"; account: string }
	| { state: "offer" }
	| { state: "waiting"; signInUrl: string }
	| { state: "failed"; exitDetail: string }

export type OnboardingStep = "welcome" | "connection" | "summoned" | "done"

export type OnboardingState = {
	step: OnboardingStep
	card: ConnectionCard | null
	hasSettled: boolean
	summons: string | null
	isBusy: boolean
}

export type OnboardingWorld = {
	send: (text: string) => Promise<void>
	markFirstRunDone: () => Promise<void>
}

export type OnboardingController = {
	getState: () => OnboardingState
	subscribe: (listener: () => void) => () => void
	start: () => Promise<void>
	tellMore: () => Promise<void>
	acceptAccount: () => Promise<void>
	changeAccount: () => void
	signIn: () => Promise<void>
	submitCode: (code: string) => Promise<void>
	submitApiKey: (apiKey: string) => Promise<void>
	pasteKeyInstead: () => Promise<void>
	summonAgain: () => Promise<void>
	finish: () => Promise<void>
}

const initialOnboardingState: OnboardingState = {
	step: "welcome",
	card: null,
	hasSettled: false,
	summons: null,
	isBusy: false,
}

const ACCOUNT_PLAN_SEPARATOR = " · "

const accountLineOf = (email: string, plan: string | null | undefined) =>
	plan ? `${email}${ACCOUNT_PLAN_SEPARATOR}${plan}` : email

export const createOnboardingController = (
	port: OnboardingPort,
	world: OnboardingWorld,
): OnboardingController => {
	let state = initialOnboardingState
	let asked: OnboardingSummons = "greeting"
	let attempt = 0
	const listeners = new Set<() => void>()

	const publish = () => {
		for (const listener of listeners) {
			listener()
		}
	}

	const set = (fields: Partial<OnboardingState>) => {
		state = { ...state, ...fields }
		publish()
	}

	const showCard = (card: ConnectionCard) => {
		set({ step: "connection", card, summons: null, isBusy: false })
	}

	const showFailed = (reason: unknown) => {
		showCard({ state: "failed", exitDetail: exitDetailOf(reason) })
	}

	const settle = async () => {
		const summons = onboardingSummonsFor(asked)
		set({ step: "summoned", card: null, hasSettled: true, summons })
		await world.send(summons)
	}

	const show = async (report: CheckReport) => {
		if (!report.authenticated) {
			showCard({ state: "offer" })
			return
		}
		const email = report.account?.email
		if (!email) {
			await settle()
			return
		}
		showCard({
			state: "detected",
			account: accountLineOf(email, report.account?.plan),
		})
	}

	const readAccount = async () => {
		set({ isBusy: true })
		try {
			await show(await port.check())
		} catch (reason) {
			showFailed(reason)
		} finally {
			set({ isBusy: false })
		}
	}

	const askFor = (summons: OnboardingSummons) => {
		asked = summons
		return readAccount()
	}

	const isAbandoned = (mine: number) => mine !== attempt

	const showFailedUnlessAbandoned = (mine: number, reason: unknown) => {
		if (!isAbandoned(mine)) {
			showFailed(reason)
		}
	}

	const waitingOn = (mine: number) => (signInUrl: string) => {
		if (isAbandoned(mine)) {
			return
		}
		showCard({ state: "waiting", signInUrl })
		port
			.openSignInUrl(signInUrl)
			.catch((reason: unknown) => showFailedUnlessAbandoned(mine, reason))
	}

	const signIn = async () => {
		attempt += 1
		const mine = attempt
		set({ isBusy: true })
		let stopListening: (() => void) | undefined
		try {
			stopListening = await port.onSignInStarted(waitingOn(mine))
			await port.signIn()
			if (!isAbandoned(mine)) {
				await settle()
			}
		} catch (reason) {
			showFailedUnlessAbandoned(mine, reason)
		} finally {
			stopListening?.()
			if (!isAbandoned(mine)) {
				set({ isBusy: false })
			}
		}
	}

	const ignoringNotRunning = async (call: () => Promise<void>) => {
		try {
			await call()
		} catch (reason) {
			if (!isNotRunning(reason)) {
				showFailed(reason)
			}
		}
	}

	return {
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		start: () => askFor("greeting"),

		tellMore: () => askFor("purpose"),

		acceptAccount: settle,

		changeAccount: () => showCard({ state: "offer" }),

		signIn,

		submitCode: async (code) => {
			set({ isBusy: true })
			await ignoringNotRunning(() => port.enterCode(code))
			set({ isBusy: false })
		},

		submitApiKey: async (apiKey) => {
			set({ isBusy: true })
			try {
				await port.holdApiKey(apiKey)
			} catch (reason) {
				showFailed(reason)
				return
			}
			await readAccount()
		},

		pasteKeyInstead: async () => {
			attempt += 1
			showCard({ state: "offer" })
			await ignoringNotRunning(() => port.cancelSignIn())
		},

		summonAgain: settle,

		finish: () => {
			set({ step: "done", card: null })
			return world.markFirstRunDone()
		},
	}
}
