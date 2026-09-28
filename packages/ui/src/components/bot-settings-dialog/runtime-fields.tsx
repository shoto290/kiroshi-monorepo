"use client"

import { useTranslation } from "react-i18next"

import {
	BOT_OUTPUT_STYLES,
	type BotModelOption,
	type BotOutputStyle,
	DEFAULT_BOT_OUTPUT_STYLE,
	readBotOutputStyle,
} from "@workspace/ui/components/bot-settings"
import { SettingsSelect } from "@workspace/ui/components/settings-select"

type RuntimeFieldsProps = {
	models: BotModelOption[]
	model: string
	onModelChange: (model: string) => void
	outputStyle?: BotOutputStyle
	onOutputStyleChange?: (outputStyle: BotOutputStyle) => void
}

const RuntimeFields = ({
	models,
	model,
	onModelChange,
	outputStyle = DEFAULT_BOT_OUTPUT_STYLE,
	onOutputStyleChange,
}: RuntimeFieldsProps) => {
	const { t } = useTranslation("bots")

	const outputStyleOptions = BOT_OUTPUT_STYLES.map((style) => ({
		label: t(`runtime.outputStyle.option.${style}.label`),
		value: style,
	}))

	return (
		<>
			<SettingsSelect
				label={t("runtime.model.label")}
				onValueChange={onModelChange}
				options={models}
				placeholder={t("runtime.model.placeholder")}
				value={model}
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
