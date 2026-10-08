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

	return {
		value: onTabChange ? tab : chosen,
		onValueChange: (value: unknown) =>
			(onTabChange ?? setChosen)(String(value)),
	}
}
