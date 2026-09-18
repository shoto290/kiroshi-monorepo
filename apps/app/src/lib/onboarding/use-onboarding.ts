import {
	createOnboardingController,
	type OnboardingController,
	type OnboardingState,
	type OnboardingWorld,
} from "./onboarding-controller"
import type { OnboardingPort } from "./onboarding-port"

import { useController } from "../use-controller"

export type Onboarding = {
	state: OnboardingState
	controller: OnboardingController
}

export const useOnboarding = (
	port: OnboardingPort,
	world: OnboardingWorld,
): Onboarding => useController(() => createOnboardingController(port, world))
