"use client"

import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	ONBOARDING_LINE_TYPE,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
	OnboardingField,
} from "@workspace/ui/components/onboarding-card"
import { ONBOARDING_STEP_COUNT } from "@workspace/ui/components/onboarding-welcome-card"
import { Button } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"

type OnboardingStatusTone = "ok" | "failed"

const STATUS_DOT: Record<OnboardingStatusTone, string> = {
	ok: "bg-bot-badge-done",
	failed: "bg-destructive",
}

const STATUS_GAP: Record<OnboardingStatusTone, string> = {
	ok: "gap-0.5",
	failed: "gap-1",
}

type OnboardingStatusProps = {
	tone: OnboardingStatusTone
	title: string
	children?: ReactNode
}

const OnboardingStatus = ({ tone, title, children }: OnboardingStatusProps) => (
	<div className="flex items-start gap-2" data-slot="onboarding-status">
		<span
			aria-hidden="true"
			className={cn("mt-1.25 size-2 shrink-0 rounded-full", STATUS_DOT[tone])}
			data-slot="onboarding-status-dot"
		/>
		<div className={cn("flex min-w-0 flex-col", STATUS_GAP[tone])}>
			<p className={cn("wrap-break-word font-medium", ONBOARDING_LINE_TYPE)}>
				{title}
			</p>
			{children}
		</div>
	</div>
)

type OnboardingConnectionCardProps = {
	className?: string
	disabled?: boolean
} & (
	| {
			state: "detected"
			account: string
			onUseAccount: () => void
			onUseAnotherAccount: () => void
	  }
	| {
			state: "offer"
			apiKey: string
			onApiKeyChange: (apiKey: string) => void
			onSignIn: () => void
	  }
	| {
			state: "failed"
			exitDetail: string
			onRetry: () => void
			onPasteKey: () => void
	  }
)

const OnboardingConnectionCard = ({
	className,
	disabled,
	...props
}: OnboardingConnectionCardProps) => {
	const { t } = useTranslation("chat")

	return (
		<OnboardingCard
			className={className}
			counter={t("onboarding.step", { step: 1, total: ONBOARDING_STEP_COUNT })}
			title={t("onboarding.connection.title")}
		>
			{props.state === "detected" ? (
				<>
					<OnboardingStatus title={props.account} tone="ok">
						<p className="wrap-break-word text-muted-foreground text-xs">
							{t("onboarding.connection.detected.subtitle")}
						</p>
					</OnboardingStatus>
					<OnboardingActions>
						<OnboardingAction
							disabled={disabled}
							emphasis="primary"
							onClick={props.onUseAccount}
						>
							{t("onboarding.connection.detected.use")}
						</OnboardingAction>
						<OnboardingAction
							disabled={disabled}
							emphasis="secondary"
							onClick={props.onUseAnotherAccount}
						>
							{t("onboarding.connection.detected.another")}
						</OnboardingAction>
					</OnboardingActions>
				</>
			) : null}
			{props.state === "offer" ? (
				<>
					<div className="flex flex-col gap-1.5">
						<Button
							className="h-auto min-h-10 gap-2 whitespace-normal rounded-(--radius-control-lg) py-2 text-center text-sm leading-5"
							disabled={disabled}
							onClick={props.onSignIn}
							type="button"
						>
							<Icons.Claude className="size-3.5" />
							{t("onboarding.connection.offer.signIn")}
						</Button>
						<p className="wrap-break-word ps-1 text-muted-foreground text-xs">
							{t("onboarding.connection.offer.note")}
						</p>
					</div>
					<OnboardingField
						family="mono"
						label={t("onboarding.connection.offer.keyLabel")}
						onValueChange={props.onApiKeyChange}
						placeholder={t("onboarding.connection.offer.keyPlaceholder")}
						type="password"
						value={props.apiKey}
					/>
				</>
			) : null}
			{props.state === "failed" ? (
				<>
					<OnboardingStatus
						title={t("onboarding.connection.failed.title")}
						tone="failed"
					>
						<code
							className="w-fit max-w-full self-start wrap-break-word rounded-md bg-muted px-2 py-0.75 font-mono text-muted-foreground text-xs leading-4.5"
							data-slot="onboarding-exit-detail"
						>
							{props.exitDetail}
						</code>
					</OnboardingStatus>
					<OnboardingActions>
						<OnboardingAction
							disabled={disabled}
							emphasis="primary"
							onClick={props.onRetry}
						>
							{t("onboarding.connection.failed.retry")}
						</OnboardingAction>
						<OnboardingAction
							disabled={disabled}
							emphasis="secondary"
							onClick={props.onPasteKey}
						>
							{t("onboarding.connection.failed.pasteKey")}
						</OnboardingAction>
					</OnboardingActions>
				</>
			) : null}
		</OnboardingCard>
	)
}

export {
	OnboardingConnectionCard,
	type OnboardingConnectionCardProps,
	OnboardingStatus,
	type OnboardingStatusProps,
	type OnboardingStatusTone,
}
