import type { OnboardingCompanion } from "@workspace/ui/components/onboarding-picker-card"

import type {
	ConnectionCard,
	OnboardingController,
	OnboardingHandoff,
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
	picks: OnboardingCompanion[] | null
	handoff: OnboardingHandoff | null
	pickFailure: string | null
}

const PENDING: SummonOutcome = { kind: "pending" }

const outcomeOf = (state: OnboardingState, chat: ChatState): SummonOutcome =>
	state.step === "summoned" && state.summons
		? summonOutcomeOf(chat, state.summons)
		: PENDING

const runsIn = (state: OnboardingState, botId: string) =>
	state.homeBotId === null || state.homeBotId === botId

export const onboardingTailOf = (
	onboarding: Onboarding | undefined,
	chat: ChatState,
	botId: string,
): OnboardingTail | null => {
	if (!onboarding || onboarding.state.step === "done") {
		return null
	}
	const { state, controller } = onboarding
	if (!runsIn(state, botId)) {
		return null
	}
	const outcome = outcomeOf(state, chat)

	return {
		controller,
		hasWelcome: state.step === "welcome",
		card: state.card,
		turnFailure: outcome.kind === "failed" ? outcome.detail : null,
		hasPill: state.hasSettled,
		hasTest: outcome.kind === "answered",
		isBusy: state.isBusy,
		picks: state.step === "picking" ? state.picks : null,
		handoff: state.step === "handoff" ? state.handoff : null,
		pickFailure: state.pickFailure,
	}
}
