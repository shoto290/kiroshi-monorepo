import { useCallback, useMemo, useState } from "react"

import type { AppRailPanel } from "@workspace/ui/components/app-rail"
import type { CompanionSelect } from "@workspace/ui/components/companion-select"
import type { MissionsPanelProps } from "@workspace/ui/components/missions-panel"

import type { SidebarActions } from "../sidebar/use-sidebar-actions"

const IS_GRAPH_PAGE_ENABLED = import.meta.env.DEV

export type OpenedGraph = { onBack: () => void }

export type GraphExits = Pick<
	SidebarActions,
	"onSelectBot" | "onSelectConversation"
> & {
	selectCompanion: CompanionSelect
	openSidebarTab: (panel: AppRailPanel) => void
	missionsBySpaceId: Record<string, MissionsPanelProps>
}

const closingFirst =
	<Args extends unknown[]>(
		close: () => void,
		action: (...args: Args) => void,
	) =>
	(...args: Args) => {
		close()
		action(...args)
	}

const closingMissions = (
	close: () => void,
	missionsBySpaceId: Record<string, MissionsPanelProps>,
) =>
	Object.fromEntries(
		Object.entries(missionsBySpaceId).map(([spaceId, panel]) => [
			spaceId,
			{ ...panel, onOpen: closingFirst(close, panel.onOpen) },
		]),
	)

export const useGraphPage = (exits: GraphExits) => {
	const [isOpen, setIsOpen] = useState(false)
	const toggle = useCallback(() => setIsOpen((open) => !open), [])
	const close = useCallback(() => setIsOpen(false), [])
	const {
		onSelectBot,
		onSelectConversation,
		selectCompanion,
		openSidebarTab,
		missionsBySpaceId,
	} = exits
	const closingExits = useMemo<GraphExits>(
		() => ({
			onSelectBot: closingFirst(close, onSelectBot),
			onSelectConversation: closingFirst(close, onSelectConversation),
			selectCompanion: closingFirst(close, selectCompanion),
			openSidebarTab: closingFirst(close, openSidebarTab),
			missionsBySpaceId: closingMissions(close, missionsBySpaceId),
		}),
		[
			close,
			onSelectBot,
			onSelectConversation,
			selectCompanion,
			openSidebarTab,
			missionsBySpaceId,
		],
	)
	if (!IS_GRAPH_PAGE_ENABLED) {
		return { isOpen: false, exits }
	}
	const opened = isOpen ? { onBack: close } : undefined
	return { isOpen, toggle, opened, exits: closingExits }
}
