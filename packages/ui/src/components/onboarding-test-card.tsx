"use client"

import { useTranslation } from "react-i18next"

import {
	ONBOARDING_STEP_COUNT,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
} from "@workspace/ui/components/onboarding-card"

type OnboardingTestCardProps = {
	onPickCompanion: () => void
	onKeepTalking: () => void
	disabled?: boolean
	className?: string
}

const OnboardingTestCard = ({
	onPickCompanion,
	onKeepTalking,
	disabled,
	className,
}: OnboardingTestCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<OnboardingCard
			className={className}
			counter={t("onboarding.step", { step: 2, total: ONBOARDING_STEP_COUNT })}
			title={t("onboarding.test.title")}
		>
			<OnboardingActions>
				<OnboardingAction
					disabled={disabled}
					emphasis="primary"
					onClick={onPickCompanion}
				>
					{t("onboarding.test.pick")}
				</OnboardingAction>
				<OnboardingAction
					disabled={disabled}
					emphasis="secondary"
					onClick={onKeepTalking}
				>
					{t("onboarding.test.keepTalking")}
				</OnboardingAction>
			</OnboardingActions>
		</OnboardingCard>
	)
}

export { OnboardingTestCard, type OnboardingTestCardProps }
