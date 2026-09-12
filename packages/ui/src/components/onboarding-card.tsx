"use client"

import { type ComponentProps, type ReactNode, useId } from "react"

import { Button } from "@workspace/ui/components/ui/button"
import { Input } from "@workspace/ui/components/ui/input"
import { cn } from "@workspace/ui/lib/utils"

const ONBOARDING_LABEL_TYPE =
	"text-(length:--text-compact) leading-4 font-medium"

const ONBOARDING_LINE_TYPE = "text-(length:--text-compact) leading-4.5"

const ONBOARDING_STEP_COUNT = 3

type OnboardingCardWidth = "default" | "wide"

const CARD_WIDTH: Record<OnboardingCardWidth, string> = {
	default: "max-w-105 gap-3",
	wide: "max-w-115 gap-2.5",
}

type OnboardingCardProps = {
	title?: string
	counter?: string
	width?: OnboardingCardWidth
	className?: string
	children: ReactNode
}

const OnboardingCard = ({
	title,
	counter,
	width = "default",
	className,
	children,
}: OnboardingCardProps) => {
	const titleId = useId()

	return (
		<div
			aria-labelledby={title ? titleId : undefined}
			className={cn(
				"flex w-full min-w-0 flex-col rounded-(--radius-card) border border-border bg-background p-3.5 text-foreground",
				CARD_WIDTH[width],
				className,
			)}
			data-slot="onboarding-card"
			role="group"
		>
			{title ? (
				<div
					className="flex items-start gap-2"
					data-slot="onboarding-card-title"
				>
					<p
						className={cn(
							"min-w-0 flex-1 wrap-break-word",
							ONBOARDING_LABEL_TYPE,
						)}
						id={titleId}
					>
						{title}
					</p>
					{counter ? (
						<span
							className="shrink-0 whitespace-nowrap text-muted-foreground text-xs"
							data-slot="onboarding-card-counter"
						>
							{counter}
						</span>
					) : null}
				</div>
			) : null}
			{children}
		</div>
	)
}

type OnboardingActionsProps = {
	className?: string
	children: ReactNode
}

const OnboardingActions = ({ className, children }: OnboardingActionsProps) => (
	<div
		className={cn("flex flex-wrap gap-2", className)}
		data-slot="onboarding-actions"
	>
		{children}
	</div>
)

type OnboardingActionEmphasis = "primary" | "secondary"

const ACTION_EMPHASIS: Record<
	OnboardingActionEmphasis,
	Pick<ComponentProps<typeof Button>, "variant" | "className">
> = {
	primary: { variant: "default", className: "px-3.5" },
	secondary: { variant: "ghost", className: "px-3 text-muted-foreground" },
}

type OnboardingActionProps = Omit<
	ComponentProps<typeof Button>,
	"variant" | "size"
> & {
	emphasis: OnboardingActionEmphasis
}

const OnboardingAction = ({
	emphasis,
	className,
	...props
}: OnboardingActionProps) => (
	<Button
		className={cn(
			"h-auto min-h-8 max-w-full whitespace-normal rounded-(--radius-control) py-1.5 text-center",
			ONBOARDING_LABEL_TYPE,
			ACTION_EMPHASIS[emphasis].className,
			className,
		)}
		data-emphasis={emphasis}
		type="button"
		variant={ACTION_EMPHASIS[emphasis].variant}
		{...props}
	/>
)

type OnboardingFieldFamily = "mono" | "sans"

type OnboardingFieldProps = {
	label: string
	placeholder: string
	value: string
	onValueChange: (value: string) => void
	family: OnboardingFieldFamily
	type?: "text" | "password"
}

const OnboardingField = ({
	label,
	placeholder,
	value,
	onValueChange,
	family,
	type = "text",
}: OnboardingFieldProps) => {
	const fieldId = useId()

	return (
		<div
			className="flex flex-col gap-1.5 border-border border-t pt-2.5"
			data-slot="onboarding-field"
		>
			<label
				className="wrap-break-word ps-1 text-muted-foreground text-xs"
				htmlFor={fieldId}
			>
				{label}
			</label>
			<Input
				autoComplete="off"
				className={cn(
					"h-auto min-h-8.5 rounded-(--radius-control) border-border bg-background px-3 md:text-(length:--text-compact)",
					ONBOARDING_LINE_TYPE,
					family === "mono" && "font-mono",
				)}
				id={fieldId}
				onChange={(event) => onValueChange(event.target.value)}
				placeholder={placeholder}
				spellCheck={false}
				type={type}
				value={value}
			/>
		</div>
	)
}

export {
	ONBOARDING_LABEL_TYPE,
	ONBOARDING_LINE_TYPE,
	ONBOARDING_STEP_COUNT,
	OnboardingAction,
	type OnboardingActionEmphasis,
	type OnboardingActionProps,
	OnboardingActions,
	type OnboardingActionsProps,
	OnboardingCard,
	type OnboardingCardProps,
	type OnboardingCardWidth,
	OnboardingField,
	type OnboardingFieldFamily,
	type OnboardingFieldProps,
}
