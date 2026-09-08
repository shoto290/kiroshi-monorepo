"use client"

import { Switch } from "@workspace/ui/components/ui/switch"

type ToggleSwitchProps = {
	checked: boolean
	onCheckedChange: (checked: boolean) => void
	id?: string
	"aria-describedby"?: string
	"aria-label"?: string
	"aria-labelledby"?: string
	disabled?: boolean
	className?: string
}

const ToggleSwitch = ({
	checked,
	onCheckedChange,
	id,
	disabled,
	className,
	...labelling
}: ToggleSwitchProps) => (
	<Switch
		{...labelling}
		checked={checked}
		className={className}
		disabled={disabled}
		id={id}
		onCheckedChange={onCheckedChange}
	/>
)

export { ToggleSwitch, type ToggleSwitchProps }
