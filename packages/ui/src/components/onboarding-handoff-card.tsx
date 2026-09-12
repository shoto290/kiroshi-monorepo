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

const HANDOFF_AVATAR_SIZE = 32

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
				<BotIdentityAvatar
					animal={animal}
					blot={blot}
					className="shrink-0"
					name={name}
					seed={seed}
					size={HANDOFF_AVATAR_SIZE}
				/>
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
