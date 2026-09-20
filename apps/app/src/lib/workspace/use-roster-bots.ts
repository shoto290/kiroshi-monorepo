import { useMemo } from "react"

import { probeRender } from "@workspace/ui/lib/render-probe"

import { toRosterBots } from "../bots/bot-settings"
import { useRosterClock } from "../bots/use-roster-clock"
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

type RosterBotsInput = {
	badges: ReturnType<typeof useBotBadges>
	bots: Bot[]
	missions: ReturnType<typeof missionsBySpaceId>
	previews: ReturnType<typeof useBotPreviews>
	rosteredSpaceId: string | null
	working: ReturnType<typeof useBotActivity>
}

export const useRosterBots = ({
	badges,
	bots,
	missions,
	previews,
	rosteredSpaceId,
	working,
}: RosterBotsInput) => {
	"use no memo"

	const now = useRosterClock()
	const rosterBots = useMemo(() => {
		probeRender("rosterBots")
		return withMissions(
			withLineBadges(
				toRosterBots(
					bots,
					{
						working: activityIn(working, rosteredSpaceId),
						previews: previewsIn(previews, rosteredSpaceId),
					},
					now,
				),
				badges,
				rosteredSpaceId,
			),
			missionsIn(missions, rosteredSpaceId),
		)
	}, [bots, rosteredSpaceId, working, previews, now, badges, missions])

	return { now, rosterBots }
}
