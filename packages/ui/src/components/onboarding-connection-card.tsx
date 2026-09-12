"use client"

import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	ONBOARDING_LABEL_TYPE,
	ONBOARDING_LINE_TYPE,
	ONBOARDING_STEP_COUNT,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
	OnboardingField,
} from "@workspace/ui/components/onboarding-card"
import { Button } from "@workspace/ui/components/ui/button"
import { useCopyText } from "@workspace/ui/hooks/use-copy-text"
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

const LINK_ROW_CLASS =
	"flex h-8.5 items-center gap-2 rounded-control border border-border ps-3 pe-1.5 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/30"

type OnboardingWaitingProps = {
	signInUrl: string
	code: string
	onCodeChange: (code: string) => void
	onCodeSubmit: (code: string) => void
	onPasteKey: () => void
	disabled?: boolean
}

const OnboardingWaiting = ({
	signInUrl,
	code,
	onCodeChange,
	onCodeSubmit,
	onPasteKey,
	disabled,
}: OnboardingWaitingProps) => {
	const { t } = useTranslation("chat")
	const { copied, copy } = useCopyText(signInUrl)
	const [hasFailedToCopy, setHasFailedToCopy] = useState(false)

	const hasCopied = copied && !hasFailedToCopy

	const copyLink = () => {
		setHasFailedToCopy(false)
		copy().catch(() => setHasFailedToCopy(true))
	}

	const submitCode = (value: string) => {
		if (value.trim() === "") return
		onCodeSubmit(value)
	}

	return (
		<>
			<div className="flex items-center gap-2" data-slot="onboarding-status">
				<span
					aria-hidden="true"
					className="size-1.5 shrink-0 rounded-full bg-bot-badge-attention"
					data-slot="onboarding-status-dot"
				/>
				<p className={cn("min-w-0 truncate", ONBOARDING_LABEL_TYPE)}>
					{t("onboarding.connection.waiting.title")}
				</p>
			</div>
			<div className={LINK_ROW_CLASS} data-slot="onboarding-link">
				<input
					aria-label={t("onboarding.connection.waiting.linkLabel")}
					className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs leading-4 outline-none"
					readOnly
					value={signInUrl}
				/>
				<Button
					aria-label={t(
						hasCopied
							? "onboarding.connection.waiting.copiedLink"
							: "onboarding.connection.waiting.copyLink",
					)}
					className="shrink-0 rounded-md text-foreground"
					disabled={disabled}
					onClick={copyLink}
					size="xs"
					type="button"
					variant="secondary"
				>
					{t(
						hasCopied
							? "onboarding.connection.waiting.copied"
							: "onboarding.connection.waiting.copy",
					)}
				</Button>
			</div>
			<span aria-live="polite" className="sr-only">
				{hasCopied ? t("onboarding.connection.waiting.copiedLink") : null}
				{hasFailedToCopy ? t("onboarding.connection.waiting.copyFailed") : null}
			</span>
			<OnboardingField
				action={
					<OnboardingAction
						className="min-h-8.5"
						disabled={disabled}
						emphasis="primary"
						onClick={() => submitCode(code)}
					>
						{t("onboarding.connection.waiting.continue")}
					</OnboardingAction>
				}
				disabled={disabled}
				family="mono"
				label={t("onboarding.connection.waiting.codeLabel")}
				onSubmit={submitCode}
				onValueChange={onCodeChange}
				placeholder={t("onboarding.connection.waiting.codePlaceholder")}
				value={code}
			/>
			<OnboardingActions>
				<OnboardingAction
					disabled={disabled}
					emphasis="secondary"
					onClick={onPasteKey}
				>
					{t("onboarding.connection.failed.pasteKey")}
				</OnboardingAction>
			</OnboardingActions>
		</>
	)
}

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
			onApiKeySubmit: (apiKey: string) => void
			onSignIn: () => void
	  }
	| {
			state: "waiting"
			signInUrl: string
			code: string
			onCodeChange: (code: string) => void
			onCodeSubmit: (code: string) => void
			onPasteKey: () => void
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
							className="h-auto min-h-10 gap-2 whitespace-normal rounded-control-lg py-2 text-center text-sm leading-5"
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
						disabled={disabled}
						family="mono"
						label={t("onboarding.connection.offer.keyLabel")}
						onSubmit={props.onApiKeySubmit}
						onValueChange={props.onApiKeyChange}
						placeholder={t("onboarding.connection.offer.keyPlaceholder")}
						type="password"
						value={props.apiKey}
					/>
				</>
			) : null}
			{props.state === "waiting" ? (
				<OnboardingWaiting
					code={props.code}
					disabled={disabled}
					onCodeChange={props.onCodeChange}
					onCodeSubmit={props.onCodeSubmit}
					onPasteKey={props.onPasteKey}
					signInUrl={props.signInUrl}
				/>
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
