import { useEffect } from "react"

import type { RosterController } from "../bots/roster-controller"
import { lastBotIn, type MirroredPreferences } from "../user/preferences-mirror"

type SpaceMemory = {
	getState: () => { preferences: MirroredPreferences }
	setLastSpace: (spaceId: string) => Promise<void>
}

export type SpaceEntry = {
	roster: RosterController
	user: SpaceMemory
	selectedSpaceId: string | null
	openRowId: string | null
}

export const useSpaceEntry = ({
	roster,
	user,
	selectedSpaceId,
	openRowId,
}: SpaceEntry) => {
	useEffect(() => {
		if (!selectedSpaceId || !openRowId) {
			return
		}
		void user.setLastSpace(openRowId)
		roster.enter({
			spaceRowId: openRowId,
			spaceId: selectedSpaceId,
			lastRowId: lastBotIn(user.getState().preferences, openRowId),
		})
	}, [roster, user, selectedSpaceId, openRowId])
}
