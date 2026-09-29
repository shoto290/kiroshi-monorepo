import type {
	ConversationMissions,
	Mission,
	MissionChanged,
	MissionDetail,
	MissionInSpace,
	MissionOnBoard,
} from "./mission-contract"

import { invoke, listen } from "../host"

export const MISSION_CHANGED_EVENT = "mission://changed"

export const missionsTransport = {
	board: () => invoke<MissionOnBoard[]>("mission_board"),
	spaceFeed: (spaceId: string, closedSince: number) =>
		invoke<MissionInSpace[]>("mission_space_feed", { spaceId, closedSince }),
	unreported: () => invoke<MissionOnBoard[]>("mission_unreported"),
	reported: (missionId: string, turnId: string | null) =>
		invoke<Mission>("mission_reported", { missionId, turnId }),
	answered: (missionId: string, seq: number) =>
		invoke<Mission>("mission_answered", { missionId, seq }),
	close: (missionId: string) => invoke<Mission>("mission_close", { missionId }),
	reopen: (missionId: string) =>
		invoke<Mission>("mission_reopen", { missionId }),
	detail: (missionId: string) =>
		invoke<MissionDetail>("mission_detail", { missionId }),
	rosterBlock: (conversationId: string, botId: string) =>
		invoke<string | null>("conversation_roster_block", {
			conversationId,
			botId,
		}),
	list: (conversationId: string) =>
		invoke<ConversationMissions>("mission_list", { conversationId }),
	onChanged: (listener: (changed: MissionChanged) => void) =>
		listen<MissionChanged>(MISSION_CHANGED_EVENT, ({ payload }) =>
			listener(payload),
		),
}
