import { useEffect, useMemo } from "react"

import type { SpaceInvitationCallbacks } from "@workspace/ui/components/space-invitations"
import type { SpaceRemovedScreenProps } from "@workspace/ui/components/space-removed-screen"

import {
	createInvitationsController,
	type InvitationsController,
	type InvitationsState,
	invitationRowsOf,
} from "./invitations-controller"
import {
	createJoinedSpacesController,
	type JoinedSpacesController,
	type JoinedSpacesState,
	openRowIdOf,
	type RemovedSpace,
	remoteMarksOf,
	shownJoinedSpacesOf,
	switcherSpacesOf,
} from "./joined-spaces-controller"
import type { SpacesController, SpacesState } from "./spaces-controller"

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

export type Invitations = {
	state: InvitationsState
	controller: InvitationsController
}

export const useInvitations = (
	joinedSpaces: JoinedSpacesController,
): Invitations => {
	const { state, controller } = useController(() =>
		createInvitationsController({ joinedSpaces }),
	)

	useEffect(
		() => (isDesktopHost() ? controller.watch() : undefined),
		[controller],
	)

	return { state, controller }
}

const invitationCallbacksOf = (
	controller: InvitationsController,
): Required<SpaceInvitationCallbacks> => ({
	onAcceptInvitation: (id) => {
		void controller.accept(id)
	},
	onDeclineInvitation: (id) => {
		void controller.decline(id)
	},
	onRetryInvitation: (id) => {
		void controller.accept(id)
	},
})

const removedScreenOf = (
	removed: RemovedSpace | null,
	spaces: Space[],
	onBack: () => void,
): SpaceRemovedScreenProps | null =>
	removed && {
		spaceName: removed.joined.name,
		hostEmail: removed.hostEmail,
		backSpaceName:
			spaces.find((space) => space.id === removed.backSpaceId)?.name ?? "",
		onBack,
	}

export const useSwitcherSpaces = (
	{ spaces, selectedSpaceId }: Pick<SpacesState, "spaces" | "selectedSpaceId">,
	{ state, hosts, controller }: JoinedSpaces,
	invitations: Invitations,
) => {
	const { joinedSpaces, removed, openId } = state
	const { connections } = hosts
	return useMemo(() => {
		const shownJoined = shownJoinedSpacesOf({ joinedSpaces, removed })
		return {
			spaces: switcherSpacesOf(spaces, shownJoined),
			selectedSpaceId: openRowIdOf(
				{ joinedSpaces, removed, openId },
				selectedSpaceId,
			),
			remoteBySpaceId: remoteMarksOf(shownJoined, connections),
			invitations: invitationRowsOf(invitations.state),
			...invitationCallbacksOf(invitations.controller),
			removedScreen: removedScreenOf(removed, spaces, controller.leaveRemoved),
		}
	}, [
		spaces,
		selectedSpaceId,
		joinedSpaces,
		removed,
		openId,
		connections,
		invitations.state,
		invitations.controller,
		controller,
	])
}
