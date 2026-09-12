import { exitDetailOf, isNotRunning } from "./onboarding-failure"
import type { OnboardingPort } from "./onboarding-port"
import {
	type OnboardingSummons,
	onboardingSummonsFor,
} from "./onboarding-summons"

import type { CheckReport } from "../agent/contract"
import type {
	AvatarAnimal,
	AvatarBlot,
	Bot,
	BotDraft,
	SuggestedBot,
} from "../conversations/store-contract"

export type ConnectionCard =
	| { state: "detected"; account: string }
	| { state: "offer" }
	| { state: "waiting"; signInUrl: string }
	| { state: "failed"; exitDetail: string }

export type OnboardingStep =
	| "welcome"
	| "connection"
	| "summoned"
	| "picking"
	| "handoff"
	| "done"

export type OnboardingHandoff = {
	botId: string
	name: string
	description: string
	animal: AvatarAnimal
	blot: AvatarBlot | null
}

export type OnboardingState = {
	step: OnboardingStep
	card: ConnectionCard | null
	hasSettled: boolean
	summons: string | null
	isBusy: boolean
	homeBotId: string | null
	suggestions: SuggestedBot[]
	handoff: OnboardingHandoff | null
	pickFailure: string | null
}

export type OnboardingWorld = {
	homeBotId: () => string | null
	send: (text: string) => Promise<void>
	suggest: () => Promise<SuggestedBot[]>
	create: (draft: BotDraft) => Promise<Bot>
	greet: (botId: string, text: string) => Promise<void>
	open: (botId: string) => void
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
	pickCompanion: () => Promise<void>
	addCompanion: (pickId: string) => Promise<void>
	askInOwnWords: (request: string) => Promise<void>
	openCompanion: () => Promise<void>
	finish: () => Promise<void>
}

const initialOnboardingState: OnboardingState = {
	step: "welcome",
	card: null,
	hasSettled: false,
	summons: null,
	isBusy: false,
	homeBotId: null,
	suggestions: [],
	handoff: null,
	pickFailure: null,
}

const draftOf = ({ name, job, description }: SuggestedBot): BotDraft => ({
	name,
	job,
	description,
})

const handoffOf = (created: Bot, description: string): OnboardingHandoff => ({
	botId: created.id,
	name: created.name,
	description,
	animal: created.avatarAnimal,
	blot: created.avatarBlot,
})

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
		if (report.error && report.error.kind !== "notAuthenticated") {
			showFailed(report.error)
			return
		}
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
		set({ homeBotId: world.homeBotId() })
		return readAccount()
	}

	const finishRun = () => {
		set({ step: "done", card: null, suggestions: [], pickFailure: null })
		return world.markFirstRunDone()
	}

	const readSuggestions = async () => {
		set({ isBusy: true, pickFailure: null })
		try {
			const read = await world.suggest()
			set({ step: "picking", card: null, suggestions: read })
		} catch (reason) {
			set({
				step: "picking",
				card: null,
				suggestions: [],
				pickFailure: exitDetailOf(reason),
			})
		} finally {
			set({ isBusy: false })
		}
	}

	const addCompanion = async (pickId: string) => {
		const pick = state.suggestions.find(({ id }) => id === pickId)
		if (!pick) {
			return
		}
		set({ isBusy: true, pickFailure: null })
		try {
			const created = await world.create(draftOf(pick))
			await world.greet(created.id, onboardingSummonsFor("arrival"))
			set({ step: "handoff", handoff: handoffOf(created, pick.blurb) })
		} catch (reason) {
			set({ pickFailure: exitDetailOf(reason) })
		} finally {
			set({ isBusy: false })
		}
	}

	const openCompanion = async () => {
		const opened = state.handoff
		if (opened) {
			world.open(opened.botId)
		}
		await finishRun()
	}

	const openAttempt = () => {
		attempt += 1
		const mine = attempt
		const isLive = () => mine === attempt

		return {
			isLive,
			fail: (reason: unknown) => {
				if (isLive()) {
					showFailed(reason)
				}
			},
		}
	}

	type Attempt = ReturnType<typeof openAttempt>

	const waitingOn = (live: Attempt) => (signInUrl: string) => {
		if (!live.isLive()) {
			return
		}
		showCard({ state: "waiting", signInUrl })
		port.openSignInUrl(signInUrl).catch(live.fail)
	}

	const signIn = async () => {
		const live = openAttempt()
		set({ isBusy: true })
		let stopListening: (() => void) | undefined
		try {
			stopListening = await port.onSignInStarted(waitingOn(live))
			await port.signIn()
			if (live.isLive()) {
				await settle()
			}
		} catch (reason) {
			live.fail(reason)
		} finally {
			stopListening?.()
			if (live.isLive()) {
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

		pickCompanion: readSuggestions,

		addCompanion,

		askInOwnWords: async (request) => {
			await world.send(request)
			await finishRun()
		},

		openCompanion,

		finish: finishRun,
	}
}
