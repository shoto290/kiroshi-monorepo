import { useCallback, useEffect, useMemo } from "react"

import type { ApplicationScopes } from "./use-application-scopes"
import type { WorkspaceCore } from "./use-workspace-core"

import { useSpaceEntry } from "../spaces/use-space-entry"
import { lastBotIn } from "../user/preferences-mirror"

type SpaceLoadingInput = {
	core: WorkspaceCore
	scopes: ApplicationScopes
}

export const useSpaceLoading = ({ core, scopes }: SpaceLoadingInput) => {
	const { roster, spaces, user } = core
	const { selectedSpaceId } = scopes

	const listedSpaces = spaces.state.spaces.map((space) => space.id).join(" ")
	const spaceIds = useMemo(
		() => (listedSpaces === "" ? [] : listedSpaces.split(" ")),
		[listedSpaces],
	)

	const loadSpaces = useCallback(() => {
		void spaces.controller.load(
			user.controller.getState().preferences.lastSpaceId,
		)
	}, [spaces.controller, user.controller])

	useEffect(() => {
		loadSpaces()
	}, [loadSpaces])

	useEffect(() => {
		if (spaceIds.length === 0) {
			return
		}
		const spaceId = spaces.controller.getState().selectedSpaceId
		void roster.controller.load({
			spaceIds,
			spaceId,
			lastRowId: lastBotIn(user.controller.getState().preferences, spaceId),
		})
	}, [roster.controller, spaces.controller, user.controller, spaceIds])

	useSpaceEntry({
		roster: roster.controller,
		user: user.controller,
		selectedSpaceId,
	})

	return loadSpaces
}
