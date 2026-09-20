import { useMemo } from "react"

import { probeRender } from "@workspace/ui/lib/render-probe"

import { toRosterBots } from "../bots/bot-settings"
import { withLineBadges } from "../chat/sidebar-badges"
import type { useBotBadges } from "../chat/use-bot-badges"
import {
	activityIn,
	previewsIn,
	type useBotActivity,
	type useBotPreviews,
} from "../chat/use-chat"
import type { Bot } from "../conversations/store-contract"
import {
	type missionsBySpaceId,
	missionsIn,
	withMissions,
} from "../missions/missions-model"

type RosterBotsBySpaceInput = {
	badges: ReturnType<typeof useBotBadges>
	missions: ReturnType<typeof missionsBySpaceId>
	now: number
	previews: ReturnType<typeof useBotPreviews>
	rosters: Record<string, Bot[]>
	working: ReturnType<typeof useBotActivity>
}

export const useRosterBotsBySpace = ({
	badges,
	missions,
	now,
	previews,
	rosters,
	working,
}: RosterBotsBySpaceInput) => {
	"use no memo"

	return useMemo(() => {
		probeRender("rosterBotsBySpace")
		return Object.fromEntries(
			Object.entries(rosters).map(([spaceId, spaceBots]) => [
				spaceId,
				withMissions(
					withLineBadges(
						toRosterBots(
							spaceBots,
							{
								working: activityIn(working, spaceId),
								previews: previewsIn(previews, spaceId),
							},
							now,
						),
						badges,
						spaceId,
					),
					missionsIn(missions, spaceId),
				),
			]),
		)
	}, [rosters, working, previews, now, badges, missions])
}
