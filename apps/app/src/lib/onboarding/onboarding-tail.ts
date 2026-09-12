import type {
	ConnectionCard,
	OnboardingController,
	OnboardingState,
} from "./onboarding-controller"
import { type SummonOutcome, summonOutcomeOf } from "./onboarding-summons"
import type { Onboarding } from "./use-onboarding"

import type { ChatState } from "../chat/chat-state"

export type OnboardingTail = {
	controller: OnboardingController
	hasWelcome: boolean
	card: ConnectionCard | null
	turnFailure: string | null
	hasPill: boolean
	hasTest: boolean
	isBusy: boolean
}

const PENDING: SummonOutcome = { kind: "pending" }

const outcomeOf = (state: OnboardingState, chat: ChatState): SummonOutcome =>
	state.step === "summoned" && state.summons
		? summonOutcomeOf(chat, state.summons)
		: PENDING

export const onboardingTailOf = (
	onboarding: Onboarding | undefined,
	chat: ChatState,
): OnboardingTail | null => {
	if (!onboarding || onboarding.state.step === "done") {
		return null
	}
	const { state, controller } = onboarding
	const outcome = outcomeOf(state, chat)

	return {
		controller,
		hasWelcome: state.step === "welcome",
		card: state.card,
		turnFailure: outcome.kind === "failed" ? outcome.detail : null,
		hasPill: state.hasSettled,
		hasTest: outcome.kind === "answered",
		isBusy: state.isBusy,
	}
}
