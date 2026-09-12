"use client"

import { type ReactNode, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"
import {
	ONBOARDING_LINE_TYPE,
	ONBOARDING_RULE,
	ONBOARDING_STEP_COUNT,
	ONBOARDING_STEP_TYPE,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
	OnboardingField,
} from "@workspace/ui/components/onboarding-card"
import { Button } from "@workspace/ui/components/ui/button"
import { useCopyText } from "@workspace/ui/hooks/use-copy-text"
import { cn } from "@workspace/ui/lib/utils"

type OnboardingStatusTone = "ok" | "failed"

const STATUS_TONE: Record<
	OnboardingStatusTone,
	{ row: string; dot: string; column: string }
> = {
	ok: {
		row: "items-start",
		dot: "mt-1.25 size-2 bg-bot-badge-done",
		column: "gap-0.5",
	},
	failed: {
		row: "items-start",
		dot: "mt-1.25 size-2 bg-destructive",
		column: "gap-1",
	},
}

type OnboardingStatusProps = {
	tone: OnboardingStatusTone
	title: string
	children?: ReactNode
}

const OnboardingStatus = ({ tone, title, children }: OnboardingStatusProps) => {
	const { row, dot, column } = STATUS_TONE[tone]

	return (
		<div className={cn("flex gap-2", row)} data-slot="onboarding-status">
			<span
				aria-hidden="true"
				className={cn("shrink-0 rounded-full", dot)}
				data-slot="onboarding-status-dot"
			/>
			<div className={cn("flex min-w-0 flex-col", column)}>
				<p className={cn("wrap-break-word font-medium", ONBOARDING_LINE_TYPE)}>
					{title}
				</p>
				{children}
			</div>
		</div>
	)
}

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
	const codeField = useRef<HTMLInputElement>(null)
	const linkStepId = useId()

	const hasCopied = copied && !hasFailedToCopy
	const copyControl = hasCopied
		? {
				name: t("onboarding.connection.waiting.copiedLink"),
				label: t("onboarding.connection.waiting.copied"),
			}
		: {
				name: t("onboarding.connection.waiting.copyLink"),
				label: t("onboarding.connection.waiting.copy"),
			}

	const copyLink = () => {
		setHasFailedToCopy(false)
		copy().catch(() => setHasFailedToCopy(true))
	}

	const submitCode = (value: string) => {
		if (value.trim() === "") {
			codeField.current?.focus()
			return
		}

		onCodeSubmit(value)
	}

	return (
		<>
			<div className="flex flex-col gap-1.5">
				<p className={ONBOARDING_STEP_TYPE} id={linkStepId}>
					{t("onboarding.connection.waiting.linkStep")}
				</p>
				<div className={LINK_ROW_CLASS} data-slot="onboarding-link">
					<input
						aria-describedby={linkStepId}
						aria-label={t("onboarding.connection.waiting.linkLabel")}
						className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs leading-4 outline-none"
						readOnly
						value={signInUrl}
					/>
					<Button
						aria-label={copyControl.name}
						className="shrink-0 rounded-md text-foreground"
						onClick={copyLink}
						size="xs"
						type="button"
						variant="secondary"
					>
						{copyControl.label}
					</Button>
				</div>
			</div>
			<span aria-live="polite" className="sr-only">
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
				hasRule={false}
				inputRef={codeField}
				label={t("onboarding.connection.waiting.codeLabel")}
				onSubmit={submitCode}
				onValueChange={onCodeChange}
				placeholder={t("onboarding.connection.waiting.codePlaceholder")}
				value={code}
			/>
			<OnboardingActions className={ONBOARDING_RULE}>
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
						<p className={ONBOARDING_STEP_TYPE}>
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
