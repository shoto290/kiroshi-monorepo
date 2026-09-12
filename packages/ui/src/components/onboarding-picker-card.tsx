"use client"

import { useId } from "react"
import { useTranslation } from "react-i18next"

import {
	ONBOARDING_LINE_TYPE,
	ONBOARDING_STEP_COUNT,
	OnboardingAction,
	OnboardingActions,
	OnboardingCard,
	OnboardingField,
} from "@workspace/ui/components/onboarding-card"
import {
	RadioGroup,
	RadioGroupItem,
} from "@workspace/ui/components/ui/radio-group"
import { cn } from "@workspace/ui/lib/utils"

type OnboardingCompanion = {
	id: string
	name: string
	role: string
	description: string
}

type OnboardingPickerCardProps = {
	companions: OnboardingCompanion[]
	value: string
	onValueChange: (companionId: string) => void
	request: string
	onRequestChange: (request: string) => void
	onRequestSubmit: (request: string) => void
	onAdd: () => void
	onSkip: () => void
	disabled?: boolean
	className?: string
}

const OnboardingPickerCard = ({
	companions,
	value,
	onValueChange,
	request,
	onRequestChange,
	onRequestSubmit,
	onAdd,
	onSkip,
	disabled,
	className,
}: OnboardingPickerCardProps) => {
	const { t } = useTranslation("chat")
	const optionId = useId()
	const selected = companions.find((companion) => companion.id === value)
	const idOf = (companionId: string) => `${optionId}-${companionId}`

	return (
		<OnboardingCard
			className={className}
			counter={t("onboarding.step", { step: 3, total: ONBOARDING_STEP_COUNT })}
			title={t("onboarding.picker.title")}
			width="wide"
		>
			<RadioGroup
				aria-label={t("onboarding.picker.title")}
				className="gap-1.5"
				disabled={disabled}
				onValueChange={onValueChange}
				value={value}
			>
				{companions.map((companion) => (
					<label
						className={cn(
							"flex items-start gap-2.5 rounded-control-lg border border-border bg-background px-3 py-2.5 has-data-checked:border-foreground has-data-checked:bg-secondary",
							disabled ? "cursor-default" : "cursor-pointer",
						)}
						data-slot="onboarding-option"
						htmlFor={idOf(companion.id)}
						key={companion.id}
					>
						<RadioGroupItem
							aria-describedby={`${idOf(companion.id)}-description`}
							className="mt-px"
							id={`${optionId}-${companion.id}`}
							value={companion.id}
						/>
						<span className="flex min-w-0 flex-col gap-0.5">
							<span
								className={cn(
									"wrap-break-word font-medium",
									ONBOARDING_LINE_TYPE,
								)}
							>
								{t("onboarding.picker.option", {
									name: companion.name,
									role: companion.role,
								})}
							</span>
							<span
								className="wrap-break-word text-muted-foreground text-xs"
								id={`${idOf(companion.id)}-description`}
							>
								{companion.description}
							</span>
						</span>
					</label>
				))}
			</RadioGroup>
			<OnboardingField
				disabled={disabled}
				family="sans"
				label={t("onboarding.picker.requestLabel")}
				onSubmit={onRequestSubmit}
				onValueChange={onRequestChange}
				placeholder={t("onboarding.picker.requestPlaceholder")}
				value={request}
			/>
			<OnboardingActions className="pt-0.5">
				{selected ? (
					<OnboardingAction
						disabled={disabled}
						emphasis="primary"
						onClick={onAdd}
					>
						{t("onboarding.picker.add", { name: selected.name })}
					</OnboardingAction>
				) : null}
				<OnboardingAction
					disabled={disabled}
					emphasis="secondary"
					onClick={onSkip}
				>
					{t("onboarding.picker.skip")}
				</OnboardingAction>
			</OnboardingActions>
		</OnboardingCard>
	)
}

export {
	type OnboardingCompanion,
	OnboardingPickerCard,
	type OnboardingPickerCardProps,
}
