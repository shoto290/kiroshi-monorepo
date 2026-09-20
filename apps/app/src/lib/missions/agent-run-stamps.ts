import type { Mission } from "./mission-contract"
import { type AgentRunStamps, stampedAgentRuns } from "./missions-model"

let held: AgentRunStamps = {}

export const stampMissionRuns = (
	missions: Mission[],
	now: number,
): AgentRunStamps => {
	held = stampedAgentRuns(held, missions, now)
	return held
}

export const forgetMissionRuns = () => {
	held = {}
}
