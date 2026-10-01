import { useCallback, useState } from "react"

import type { AppRailPanel } from "@workspace/ui/components/app-rail"

const IS_GRAPH_PAGE_ENABLED = import.meta.env.DEV

export type OpenedGraph = { onClose: () => void }

export const useGraphPage = (openSidebarTab: (panel: AppRailPanel) => void) => {
	const [isOpen, setIsOpen] = useState(false)
	const toggle = useCallback(() => setIsOpen((open) => !open), [])
	const close = useCallback(() => setIsOpen(false), [])
	const switchPanel = useCallback(
		(panel: AppRailPanel) => {
			setIsOpen(false)
			openSidebarTab(panel)
		},
		[openSidebarTab],
	)
	if (!IS_GRAPH_PAGE_ENABLED) {
		return { isOpen: false, switchPanel: openSidebarTab }
	}
	const opened = isOpen ? { onClose: close } : undefined
	return { isOpen, toggle, opened, switchPanel }
}
