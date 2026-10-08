import { useCallback, useEffect, useMemo } from "react"

import type { ApplicationScopes } from "./use-application-scopes"
import type { WorkspaceCore } from "./use-workspace-core"

import {
	openRowIdOf,
	rosterSpaceIdsOf,
} from "../spaces/joined-spaces-controller"
import { useSpaceEntry } from "../spaces/use-space-entry"
import { lastBotIn } from "../user/preferences-mirror"

type SpaceLoadingInput = {
	core: WorkspaceCore
	scopes: ApplicationScopes
}

export const useSpaceLoading = ({ core, scopes }: SpaceLoadingInput) => {
	const { joinedSpaces, roster, spaces, user } = core
	const { selectedSpaceId } = scopes

	const listedSpaces = rosterSpaceIdsOf(
		spaces.state.spaces,
		joinedSpaces.state.joinedSpaces,
		joinedSpaces.hosts.active,
	).join(" ")
	const spaceIds = useMemo(
		() => (listedSpaces === "" ? [] : listedSpaces.split(" ")),
		[listedSpaces],
	)

	const loadSpaces = useCallback(() => {
		const { lastSpaceId } = user.controller.getState().preferences
		void spaces.controller
			.load(lastSpaceId)
			.then(() => joinedSpaces.controller.restore(lastSpaceId))
	}, [spaces.controller, joinedSpaces.controller, user.controller])

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
		openRowId: openRowIdOf(joinedSpaces.state, selectedSpaceId),
	})

	return loadSpaces
}
