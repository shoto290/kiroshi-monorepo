import { useMemo } from "react"

import { useRosterBotsBySpace } from "./use-roster-bots-by-space"
import type { RosterLines } from "./use-roster-lines"
import type { RosterView } from "./use-roster-view"
import type { WorkspaceCore } from "./use-workspace-core"
import type { WorkspaceDrivers } from "./use-workspace-drivers"

import { toSpaceBadges, withBadges } from "../chat/sidebar-badges"
import {
	presentParticipants,
	toConversationBots,
	toRosterConversations,
} from "../conversations/roster-conversations"
import {
	useConversationPreviews,
	useConversationWorkers,
} from "../conversations/use-conversation"
import {
	missionRingBadges,
	missionsIn,
	withMissions,
} from "../missions/missions-model"

type RosterListsInput = {
	core: WorkspaceCore
	drivers: WorkspaceDrivers
	rosterLines: RosterLines
	rosterView: RosterView
}

export const useRosterLists = ({
	core,
	drivers,
	rosterLines,
	rosterView,
}: RosterListsInput) => {
	const { conversationRuntimes, roster } = core
	const { badges, conversationBadges } = drivers
	const { now, previews, rosters, working } = rosterLines
	const {
		bots,
		conversationRosters,
		conversations,
		missions,
		rosteredSpaceId,
		settingsConversation,
	} = rosterView

	const rosterBotsBySpace = useRosterBotsBySpace({
		badges,
		missions,
		now,
		previews,
		rosters,
		working,
	})

	const conversationIds = useMemo(
		() =>
			Object.values(conversationRosters)
				.flat()
				.map((conversation) => conversation.id),
		[conversationRosters],
	)

	const conversationWorkers = useConversationWorkers(
		conversationRuntimes,
		conversationIds,
	)

	const conversationPreviews = useConversationPreviews(
		conversationRuntimes,
		conversationIds,
		roster.state.conversationPreviews,
	)

	const rosterConversations = useMemo(
		() =>
			withMissions(
				withBadges(
					toRosterConversations(
						conversations,
						{ working: conversationWorkers, previews: conversationPreviews },
						now,
					),
					conversationBadges,
				),
				missionsIn(missions, rosteredSpaceId),
			),
		[
			conversations,
			rosteredSpaceId,
			conversationWorkers,
			conversationPreviews,
			now,
			conversationBadges,
			missions,
		],
	)

	const seatedBots = useMemo(
		() =>
			settingsConversation
				? toConversationBots(presentParticipants(settingsConversation), bots)
				: [],
		[settingsConversation, bots],
	)

	const rosterConversationsBySpace = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(conversationRosters).map(([spaceId, spaceRooms]) => [
					spaceId,
					withMissions(
						withBadges(
							toRosterConversations(
								spaceRooms,
								{
									working: conversationWorkers,
									previews: conversationPreviews,
								},
								now,
							),
							conversationBadges,
						),
						missionsIn(missions, spaceId),
					),
				]),
			),
		[
			conversationRosters,
			conversationWorkers,
			conversationPreviews,
			now,
			conversationBadges,
			missions,
		],
	)

	const badgesBySpaceId = useMemo(
		() =>
			toSpaceBadges(
				rosterBotsBySpace,
				rosterConversationsBySpace,
				missionRingBadges(rosterBotsBySpace),
				missionRingBadges(rosterConversationsBySpace),
			),
		[rosterBotsBySpace, rosterConversationsBySpace],
	)

	return {
		badgesBySpaceId,
		rosterBotsBySpace,
		rosterConversations,
		rosterConversationsBySpace,
		seatedBots,
	}
}

export type RosterLists = ReturnType<typeof useRosterLists>
