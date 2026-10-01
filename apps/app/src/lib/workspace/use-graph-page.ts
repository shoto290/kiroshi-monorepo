import { useCallback, useEffect, useState } from "react"

import type { AppRailPanel } from "@workspace/ui/components/app-rail"
import type { SpaceGraphScreenState } from "@workspace/ui/components/space-graph-screen"

import {
	type ReadSpaceGraph,
	readSpaceGraph,
	type SpaceGraphStore,
} from "../plugins/read-space-graph"

const IS_GRAPH_PAGE_ENABLED = import.meta.env.DEV

const READING: SpaceGraphScreenState = { status: "loading" }

export type OpenedGraph = { state: SpaceGraphScreenState; onClose: () => void }

type GraphSpace = { id: string; name: string }

type GraphPageSource = {
	store: SpaceGraphStore
	space?: GraphSpace
	openSidebarTab: (panel: AppRailPanel) => void
}

type SpaceRead = { space: GraphSpace; state: ReadSpaceGraph }

export const useGraphPage = ({
	store,
	space,
	openSidebarTab,
}: GraphPageSource) => {
	const [isOpen, setIsOpen] = useState(false)
	const [read, setRead] = useState<SpaceRead>()
	const toggle = useCallback(() => setIsOpen((open) => !open), [])
	const close = useCallback(() => setIsOpen(false), [])
	const switchPanel = useCallback(
		(panel: AppRailPanel) => {
			setIsOpen(false)
			openSidebarTab(panel)
		},
		[openSidebarTab],
	)

	useEffect(() => {
		if (!isOpen || !space) return
		let isCurrent = true
		void readSpaceGraph(store, space, new Date()).then((state) => {
			if (isCurrent) setRead({ space, state })
		})
		return () => {
			isCurrent = false
		}
	}, [isOpen, space, store])

	if (!IS_GRAPH_PAGE_ENABLED) {
		return { isOpen: false, switchPanel: openSidebarTab }
	}
	const state = read && read.space === space ? read.state : READING
	const opened = isOpen ? { state, onClose: close } : undefined
	return { isOpen, toggle, opened, switchPanel }
}
