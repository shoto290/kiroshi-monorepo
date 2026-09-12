import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { openUrl } from "@tauri-apps/plugin-opener"

import type { OnboardingPort } from "./onboarding-port"

import { agentTransport } from "../agent/transport"

const SIGN_IN_STARTED_CHANNEL = "agent://sign-in-started"

const API_KEY_CONNECTION = "apiKey"

type SignInStarted = { url: string }

export const onboardingTransport: OnboardingPort = {
	check: () => agentTransport.check(null),

	signIn: () => invoke<void>("agent_sign_in"),

	enterCode: (code) => invoke<void>("agent_sign_in_code", { text: code }),

	cancelSignIn: () => invoke<void>("agent_sign_in_cancel"),

	holdApiKey: (apiKey) =>
		invoke<void>("connection_set", {
			kind: API_KEY_CONNECTION,
			value: apiKey,
		}),

	openSignInUrl: (url) => openUrl(url),

	onSignInStarted: (onStarted) =>
		listen<SignInStarted>(SIGN_IN_STARTED_CHANNEL, ({ payload }) =>
			onStarted(payload.url),
		),
}
