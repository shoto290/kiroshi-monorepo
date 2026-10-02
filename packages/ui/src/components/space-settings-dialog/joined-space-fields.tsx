"use client"

import { useTranslation } from "react-i18next"

import { SettingsField } from "@workspace/ui/components/settings-field"
import { cn } from "@workspace/ui/lib/utils"

type JoinedSpaceFieldsProps = {
	name: string
	host: string
	className?: string
}

const JoinedSpaceFields = ({
	name,
	host,
	className,
}: JoinedSpaceFieldsProps) => {
	const { t } = useTranslation("settings")

	return (
		<div
			className={cn("flex flex-col gap-5", className)}
			data-slot="joined-space-fields"
		>
			<SettingsField label={t("space.name.label")} readOnly value={name} />
			<SettingsField
				hint={t("space.host.hint")}
				kind="url"
				label={t("space.host.label")}
				readOnly
				value={host}
			/>
		</div>
	)
}

export { JoinedSpaceFields, type JoinedSpaceFieldsProps }
