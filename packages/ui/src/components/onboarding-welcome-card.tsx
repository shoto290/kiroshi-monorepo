"use client"

import { useTranslation } from "react-i18next"

import {
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
} from "@workspace/ui/components/onboarding-card"

const ONBOARDING_STEP_COUNT = 3

type OnboardingWelcomeCardProps = {
	onStart: () => void
	onTellMore: () => void
	disabled?: boolean
	className?: string
}

const OnboardingWelcomeCard = ({
	onStart,
	onTellMore,
	disabled,
	className,
}: OnboardingWelcomeCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<OnboardingCard
			className={className}
			counter={t("onboarding.steps", { count: ONBOARDING_STEP_COUNT })}
			title={t("onboarding.welcome.title")}
		>
			<OnboardingActions>
				<OnboardingAction
					disabled={disabled}
					emphasis="primary"
					onClick={onStart}
				>
					{t("onboarding.welcome.start")}
				</OnboardingAction>
				<OnboardingAction
					disabled={disabled}
					emphasis="secondary"
					onClick={onTellMore}
				>
					{t("onboarding.welcome.more")}
				</OnboardingAction>
			</OnboardingActions>
		</OnboardingCard>
	)
}

export {
	ONBOARDING_STEP_COUNT,
	OnboardingWelcomeCard,
	type OnboardingWelcomeCardProps,
}
