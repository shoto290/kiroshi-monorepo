import { useState, useSyncExternalStore } from "react"

import {
	createOnboardingController,
	type OnboardingController,
	type OnboardingState,
	type OnboardingWorld,
} from "./onboarding-controller"
import type { OnboardingPort } from "./onboarding-port"

export type Onboarding = {
	state: OnboardingState
	controller: OnboardingController
}

export const useOnboarding = (
	port: OnboardingPort,
	world: OnboardingWorld,
): Onboarding => {
	const [controller] = useState(() => createOnboardingController(port, world))
	const state = useSyncExternalStore(controller.subscribe, controller.getState)

	return { state, controller }
}
