import type {
	HookCallback,
	HookInput,
	SDKMessage,
	SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk"

import { KIROSHI_SERVER } from "./kiroshi-server"

export const MISSION_STATUS_TOOL = `mcp__${KIROSHI_SERVER}__mission_status`

export const MISSION_STATUS_REASON =
	"Before this turn ends, call mission_status to write the status of this mission."

const callsMissionStatus = (message: SDKMessage): boolean =>
	message.type === "assistant" &&
	message.message.content.some(
		(block) => block.type === "tool_use" && block.name === MISSION_STATUS_TOOL,
	)

const isStopHookActive = (input: HookInput): boolean =>
	input.hook_event_name === "Stop" && input.stop_hook_active

export const createMissionStatusReminder = () => {
	let written = false

	const stop: HookCallback = async (input): Promise<SyncHookJSONOutput> => {
		const owesStatus = !written && !isStopHookActive(input)
		written = false
		return owesStatus
			? { decision: "block", reason: MISSION_STATUS_REASON }
			: {}
	}

	return {
		observe: (message: SDKMessage) => {
			if (callsMissionStatus(message)) {
				written = true
			}
		},
		stop,
	}
}
