import { useCallback, useState } from "react"

const IS_GRAPH_PAGE_ENABLED = import.meta.env.DEV

export type OpenedGraph = { onBack: () => void }

export const useGraphPage = () => {
	const [isOpen, setIsOpen] = useState(false)
	const toggle = useCallback(() => setIsOpen((open) => !open), [])
	const close = useCallback(() => setIsOpen(false), [])
	if (!IS_GRAPH_PAGE_ENABLED) {
		return { isOpen: false }
	}
	const opened: OpenedGraph | undefined = isOpen ? { onBack: close } : undefined
	return { isOpen, toggle, opened }
}
