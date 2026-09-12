import type { CheckReport } from "../agent/contract"

export type OnboardingPort = {
	check: () => Promise<CheckReport>
	signIn: () => Promise<void>
	enterCode: (code: string) => Promise<void>
	cancelSignIn: () => Promise<void>
	holdApiKey: (apiKey: string) => Promise<void>
	openSignInUrl: (url: string) => Promise<void>
	onSignInStarted: (onStarted: (url: string) => void) => Promise<() => void>
}
