import { useMemo } from "react"

import type { MissionCardWrap } from "@workspace/ui/components/mission-card"
import { MissionMenu } from "@workspace/ui/components/mission-menu"

import type { ConversationRuntimes } from "@/lib/conversations/conversation-runtimes"
import { openInBrowser } from "@/lib/links/use-external-links"
import {
	type MissionActionsPort,
	missionActionsOf,
	type OpenMission,
} from "@/lib/missions/mission-actions"
import type { Mission } from "@/lib/missions/mission-contract"
import { missionsTransport } from "@/lib/missions/missions-transport"

const OPEN_SHORTCUT = "↵"

const CLOSE_SHORTCUT = "⌘⌫"

type MissionCardMenusInput = {
	missions: Mission[]
	runtimes: Pick<ConversationRuntimes, "heldFor">
	onOpenMission: OpenMission
	onChanged: () => void
}

const writeClipboard = (text: string) => navigator.clipboard.writeText(text)

export const useMissionCardMenus = ({
	missions,
	runtimes,
	onOpenMission,
	onChanged,
}: MissionCardMenusInput): MissionCardWrap =>
	useMemo(() => {
		const missionById = new Map(
			missions.map((mission) => [mission.id, mission]),
		)
		const port: MissionActionsPort = {
			openMission: onOpenMission,
			openInBrowser,
			writeClipboard,
			stopThread: async (conversationId) => {
				await runtimes.heldFor(conversationId)?.stop()
			},
			close: missionsTransport.close,
			reopen: missionsTransport.reopen,
			onChanged,
		}

		return (card) => {
			const mission = missionById.get(card.props.id)
			if (!mission) {
				return card
			}

			return (
				<MissionMenu
					{...missionActionsOf(mission, port)}
					closeShortcut={CLOSE_SHORTCUT}
					hasBranch={mission.branch !== null}
					hasPullRequest={mission.pullRequestUrl !== null}
					hasWorkspacePath={mission.workspacePath !== null}
					openShortcut={OPEN_SHORTCUT}
					state={card.props.state}
				>
					{card}
				</MissionMenu>
			)
		}
	}, [missions, runtimes, onOpenMission, onChanged])
