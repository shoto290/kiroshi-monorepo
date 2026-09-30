"use client"

import { useTranslation } from "react-i18next"

import {
	BOT_EFFORTS,
	BOT_OUTPUT_STYLES,
	type BotEffort,
	type BotModelOption,
	type BotOutputStyle,
	type BotSettingsValue,
	DEFAULT_BOT_OUTPUT_STYLE,
	readBotEffort,
	readBotOutputStyle,
} from "@workspace/ui/components/bot-settings"
import { SettingsSelect } from "@workspace/ui/components/settings-select"

type BotRuntime = Pick<BotSettingsValue, "model" | "effort">

type RuntimeFieldsProps = BotRuntime & {
	models: BotModelOption[]
	onModelChange: (runtime: BotRuntime) => void
	onEffortChange: (effort: BotEffort | null) => void
	outputStyle?: BotOutputStyle
	onOutputStyleChange?: (outputStyle: BotOutputStyle) => void
}

const DEFAULT_EFFORT = "default" as const

const supportedEffortsOf = (
	models: BotModelOption[],
	model: string,
): BotEffort[] =>
	models.find((option) => option.value === model)?.supportedEfforts ?? []

const effortKeptFor = (
	models: BotModelOption[],
	model: string,
	effort: BotEffort | null,
): BotEffort | null =>
	effort && supportedEffortsOf(models, model).includes(effort) ? effort : null

const RuntimeFields = ({
	models,
	model,
	onModelChange,
	effort,
	onEffortChange,
	outputStyle = DEFAULT_BOT_OUTPUT_STYLE,
	onOutputStyleChange,
}: RuntimeFieldsProps) => {
	const { t } = useTranslation("bots")

	const supportedEfforts = supportedEffortsOf(models, model)
	const shownEffort = effortKeptFor(models, model, effort) ?? DEFAULT_EFFORT

	const effortOptions = [
		DEFAULT_EFFORT,
		...BOT_EFFORTS.filter((level) => supportedEfforts.includes(level)),
	].map((level) => ({
		label: t(`runtime.effort.option.${level}`),
		value: level,
	}))

	const outputStyleOptions = BOT_OUTPUT_STYLES.map((style) => ({
		label: t(`runtime.outputStyle.option.${style}.label`),
		value: style,
	}))

	return (
		<>
			<SettingsSelect
				label={t("runtime.model.label")}
				onValueChange={(next) =>
					onModelChange({
						model: next,
						effort: effortKeptFor(models, next, effort),
					})
				}
				options={models}
				placeholder={t("runtime.model.placeholder")}
				value={model}
			/>

			<SettingsSelect
				isDisabled={supportedEfforts.length === 0}
				label={t("runtime.effort.label")}
				onValueChange={(value) => onEffortChange(readBotEffort(value))}
				options={effortOptions}
				value={shownEffort}
			/>

			<SettingsSelect
				hint={t(`runtime.outputStyle.option.${outputStyle}.hint`)}
				label={t("runtime.outputStyle.label")}
				onValueChange={(value) =>
					onOutputStyleChange?.(readBotOutputStyle(value))
				}
				options={outputStyleOptions}
				value={outputStyle}
			/>
		</>
	)
}

export { RuntimeFields, type RuntimeFieldsProps }
