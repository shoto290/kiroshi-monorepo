import type { OnboardingPort } from "./onboarding-port"
import {
	createSignInController,
	type SignInController,
	type SignInState,
	type SignInWorld,
} from "./sign-in-controller"

import { useController } from "../use-controller"

export type SignIn = {
	state: SignInState
	controller: SignInController
}

export const useSignIn = (port: OnboardingPort, world: SignInWorld): SignIn =>
	useController(() => createSignInController(port, world))
