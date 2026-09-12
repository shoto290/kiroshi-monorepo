"use client"

import { useTranslation } from "react-i18next"

import type { BotAvatarBlot } from "@workspace/ui/components/bot-avatar"
import type { BotAvatarAnimal } from "@workspace/ui/components/bot-avatar-animals"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import {
	ONBOARDING_LINE_TYPE,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
} from "@workspace/ui/components/onboarding-card"
import { cn } from "@workspace/ui/lib/utils"

const HANDOFF_AVATAR_SIZE = 40

type OnboardingHandoffCardProps = {
	name: string
	description: string
	animal?: BotAvatarAnimal
	blot?: BotAvatarBlot
	seed?: string
	onOpen: () => void
	onStay: () => void
	disabled?: boolean
	className?: string
}

const OnboardingHandoffCard = ({
	name,
	description,
	animal,
	blot,
	seed,
	onOpen,
	onStay,
	disabled,
	className,
}: OnboardingHandoffCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<OnboardingCard className={className}>
			<div className="flex items-center gap-2.5" data-slot="onboarding-handoff">
				<span className="flex size-8 shrink-0 items-center justify-center">
					<BotIdentityAvatar
						animal={animal}
						blot={blot}
						name={name}
						seed={seed}
						size={HANDOFF_AVATAR_SIZE}
					/>
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span
						className={cn("wrap-break-word font-medium", ONBOARDING_LINE_TYPE)}
					>
						{name}
					</span>
					<span className="wrap-break-word text-muted-foreground text-xs">
						{description}
					</span>
				</span>
			</div>
			<OnboardingActions>
				<OnboardingAction
					disabled={disabled}
					emphasis="primary"
					onClick={onOpen}
				>
					{t("onboarding.handoff.open", { name })}
				</OnboardingAction>
				<OnboardingAction
					disabled={disabled}
					emphasis="secondary"
					onClick={onStay}
				>
					{t("onboarding.handoff.stay")}
				</OnboardingAction>
			</OnboardingActions>
		</OnboardingCard>
	)
}

export { OnboardingHandoffCard, type OnboardingHandoffCardProps }
