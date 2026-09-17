"use client"

import { useTranslation } from "react-i18next"

import { Icons } from "@workspace/ui/components/icons"

type ApplicationsSearchFieldProps = {
	value: string
	onValueChange: (value: string) => void
}

const ApplicationsSearchField = ({
	value,
	onValueChange,
}: ApplicationsSearchFieldProps) => {
	const { t } = useTranslation("bots")
	const label = t("applications.search")

	return (
		<label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
			<Icons.Search
				aria-hidden="true"
				className="size-4 shrink-0 text-muted-foreground"
			/>
			<input
				aria-label={label}
				className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
				onChange={(event) => onValueChange(event.target.value)}
				placeholder={label}
				type="text"
				value={value}
			/>
		</label>
	)
}

export { ApplicationsSearchField, type ApplicationsSearchFieldProps }
