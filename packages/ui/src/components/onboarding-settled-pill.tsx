"use client"

import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import { cn } from "@workspace/ui/lib/utils"

const BUBBLE_COLUMN_OFFSET = "ms-12"

type OnboardingSettledPillProps = {
	className?: string
}

const OnboardingSettledPill = ({ className }: OnboardingSettledPillProps) => {
	const { t } = useTranslation("chat")

	return (
		<p
			className={cn(
				"inline-flex min-h-7 w-fit max-w-full items-center gap-1.5 self-start rounded-full bg-muted py-1 ps-2.5 pe-3 text-foreground text-xs",
				BUBBLE_COLUMN_OFFSET,
				className,
			)}
			data-slot="onboarding-settled-pill"
		>
			<Icons.Check
				aria-hidden="true"
				className="size-3 shrink-0 text-bot-badge-done"
			/>
			{t("onboarding.connection.settled")}
		</p>
	)
}

export { OnboardingSettledPill, type OnboardingSettledPillProps }
