import type { OnboardingPort } from "./onboarding-port"

import type { CheckReport } from "../agent/contract"

export type OnboardingCommand =
	| "check"
	| "signIn"
	| "enterCode"
	| "cancelSignIn"
	| "holdApiKey"
	| "openSignInUrl"

export type OnboardingCall = {
	command: OnboardingCommand
	value?: string
}

type PendingSignIn = {
	resolve: () => void
	reject: (reason: unknown) => void
}

export type FakeOnboardingPort = OnboardingPort & {
	calls: OnboardingCall[]
	report: CheckReport
	refusals: Partial<Record<OnboardingCommand, unknown>>
	isListening: () => boolean
	announceStarted: (url: string) => void
	completeSignIn: () => void
	refuseSignIn: (reason: unknown) => void
}

const AUTHENTICATED_NOWHERE: CheckReport = {
	connection: "ready",
	binaryVersion: null,
	authenticated: false,
	error: null,
}

export const createFakeOnboardingPort = (): FakeOnboardingPort => {
	let pending: PendingSignIn | null = null
	let announce: ((url: string) => void) | null = null

	const answer = (call: OnboardingCall) => {
		fake.calls.push(call)
		const refusal = fake.refusals[call.command]
		if (refusal !== undefined) {
			throw refusal
		}
	}

	const settle = (settleWith: (signIn: PendingSignIn) => void) => {
		if (pending) {
			settleWith(pending)
		}
		pending = null
	}

	const fake: FakeOnboardingPort = {
		calls: [],
		report: AUTHENTICATED_NOWHERE,
		refusals: {},

		check: async () => {
			answer({ command: "check" })
			return fake.report
		},

		signIn: async () => {
			answer({ command: "signIn" })
			await new Promise<void>((resolve, reject) => {
				pending = { resolve, reject }
			})
		},

		enterCode: async (code) => {
			answer({ command: "enterCode", value: code })
		},

		cancelSignIn: async () => {
			answer({ command: "cancelSignIn" })
			settle((signIn) => signIn.reject({ kind: "cancelled" }))
		},

		holdApiKey: async (apiKey) => {
			answer({ command: "holdApiKey", value: apiKey })
		},

		openSignInUrl: async (url) => {
			answer({ command: "openSignInUrl", value: url })
		},

		onSignInStarted: async (onStarted) => {
			announce = onStarted
			return () => {
				announce = null
			}
		},

		isListening: () => announce !== null,

		announceStarted: (url) => announce?.(url),

		completeSignIn: () => settle((signIn) => signIn.resolve()),

		refuseSignIn: (reason) => settle((signIn) => signIn.reject(reason)),
	}

	return fake
}
