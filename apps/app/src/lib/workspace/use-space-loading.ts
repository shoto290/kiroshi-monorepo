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
	const { selectedSpaceId, openRowId } = scopes
	const activeHostId = joinedSpaces.hosts.active

	const listedSpaces = rosterSpaceIdsOf(
		spaces.state.spaces,
		joinedSpaces.state.joinedSpaces,
		activeHostId,
	).join(" ")
	const rosterScope = useMemo(
		() => ({
			hostId: activeHostId,
			spaceIds: listedSpaces === "" ? [] : listedSpaces.split(" "),
		}),
		[activeHostId, listedSpaces],
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
		const { spaceIds } = rosterScope
		if (spaceIds.length === 0) {
			return
		}
		const spaceId = spaces.controller.getState().selectedSpaceId
		const rowId = openRowIdOf(joinedSpaces.controller.getState(), spaceId)
		void roster.controller.load({
			spaceIds,
			spaceId,
			lastRowId: lastBotIn(user.controller.getState().preferences, rowId),
		})
	}, [
		roster.controller,
		spaces.controller,
		joinedSpaces.controller,
		user.controller,
		rosterScope,
	])

	useSpaceEntry({
		roster: roster.controller,
		user: user.controller,
		selectedSpaceId,
		openRowId,
	})

	return loadSpaces
}
