"use client"

import { useState } from "react"

export const useSettingsTab = (isOpen: boolean, firstTab: string) => {
	const [wasOpen, setWasOpen] = useState(isOpen)
	const [chosen, setChosen] = useState(firstTab)

	if (wasOpen !== isOpen) {
		setWasOpen(isOpen)
		if (isOpen) setChosen(firstTab)
	}

	return {
		value: chosen,
		onValueChange: (value: unknown) => setChosen(String(value)),
	}
}
