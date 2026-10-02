import { useEffect, useMemo } from "react"

import {
	createJoinedSpacesController,
	type JoinedSpacesController,
	type JoinedSpacesState,
	remoteMarksOf,
	switcherSpacesOf,
} from "./joined-spaces-controller"
import type { SpacesController } from "./spaces-controller"

import { isDesktopHost, joinedHosts } from "../host"
import { useController, useControllerState } from "../use-controller"
import type { Space } from "../conversations/store-contract"
import type { JoinedHostsState } from "../host/joined-hosts"

export type JoinedSpaces = {
	state: JoinedSpacesState
	controller: JoinedSpacesController
	hosts: JoinedHostsState
}

export const useJoinedSpaces = (spaces: SpacesController): JoinedSpaces => {
	const { state, controller } = useController(() =>
		createJoinedSpacesController({ spaces }),
	)
	const hosts = useControllerState(joinedHosts)

	useEffect(
		() => (isDesktopHost() ? controller.watch() : undefined),
		[controller],
	)

	return { state, controller, hosts }
}

export const useSwitcherSpaces = (
	spaces: Space[],
	{ state, hosts }: JoinedSpaces,
) => {
	const { joinedSpaces } = state
	const { connections } = hosts
	return useMemo(
		() => ({
			spaces: switcherSpacesOf(spaces, joinedSpaces),
			remoteBySpaceId: remoteMarksOf(joinedSpaces, connections),
		}),
		[spaces, joinedSpaces, connections],
	)
}
