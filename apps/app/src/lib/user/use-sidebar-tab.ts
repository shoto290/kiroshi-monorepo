import { useCallback, useState } from "react"

import type { User } from "./use-user"

import type { SidebarTab } from "@/lib/bindings"

export const useSidebarTab = ({ controller, state }: User) => {
	const [clickedTab, setClickedTab] = useState<SidebarTab | null>(null)
	const openTab = clickedTab ?? state.preferences.sidebarTab

	const openSidebarTab = useCallback(
		(tab: SidebarTab) => {
			setClickedTab(tab)
			void controller.setSidebarTab(tab)
		},
		[controller],
	)

	return { openTab, openSidebarTab }
}
