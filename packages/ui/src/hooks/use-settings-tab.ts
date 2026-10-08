"use client"

import { useState } from "react"

export const useSettingsTab = (
	isOpen: boolean,
	tab: string,
	onTabChange?: (tab: string) => void,
) => {
	const [wasOpen, setWasOpen] = useState(isOpen)
	const [chosen, setChosen] = useState(tab)

	if (wasOpen !== isOpen) {
		setWasOpen(isOpen)
		if (isOpen) setChosen(tab)
	}

	if (onTabChange) {
		return {
			value: tab,
			onValueChange: (value: unknown) => onTabChange(String(value)),
		}
	}

	return {
		value: chosen,
		onValueChange: (value: unknown) => setChosen(String(value)),
	}
}
