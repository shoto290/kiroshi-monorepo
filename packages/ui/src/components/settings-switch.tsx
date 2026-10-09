"use client"

import { useId } from "react"

import { Icons } from "@workspace/ui/components/icons"
import { FIELD_LABEL_CLASS } from "@workspace/ui/components/settings-styles"
import { ToggleSwitch } from "@workspace/ui/components/toggle-switch"
import { cn } from "@workspace/ui/lib/utils"

type SettingsSwitchStatus = {
	tone: "pending" | "done"
	label: string
}

type SettingsSwitchProps = {
	label: string
	description: string
	checked: boolean
	onCheckedChange: (checked: boolean) => void
	status?: SettingsSwitchStatus
}

type StatusLineProps = {
	status?: SettingsSwitchStatus
}

const StatusLine = ({ status }: StatusLineProps) => (
	<div
		className={cn(
			"flex items-center gap-1.5 font-medium text-xs",
			status && "pt-1",
			status?.tone === "done" ? "text-foreground" : "text-muted-foreground",
		)}
		data-slot="settings-switch-status"
		role="status"
	>
		{status?.tone === "pending" ? (
			<Icons.Loading
				aria-hidden
				className="pointer-events-none size-3 shrink-0 animate-spin motion-reduce:animate-none"
			/>
		) : null}
		{status?.tone === "done" ? (
			<span
				aria-hidden
				className="pointer-events-none size-2 shrink-0 rounded-full bg-bot-badge-done"
			/>
		) : null}
		{status?.label}
	</div>
)

const SettingsSwitch = ({
	label,
	description,
	checked,
	onCheckedChange,
	status,
}: SettingsSwitchProps) => {
	const id = useId()
	const descriptionId = `${id}-description`

	return (
		<div className="flex shrink-0 items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-3">
			<div className="flex min-w-0 flex-col">
				<div className="flex flex-col gap-1">
					<label className={FIELD_LABEL_CLASS} htmlFor={id}>
						{label}
					</label>
					<p
						className="text-muted-foreground text-xs leading-relaxed"
						id={descriptionId}
					>
						{description}
					</p>
				</div>
				<StatusLine status={status} />
			</div>
			<ToggleSwitch
				aria-describedby={descriptionId}
				checked={checked}
				id={id}
				onCheckedChange={onCheckedChange}
			/>
		</div>
	)
}

export {
	SettingsSwitch,
	type SettingsSwitchProps,
	type SettingsSwitchStatus,
	StatusLine,
}
