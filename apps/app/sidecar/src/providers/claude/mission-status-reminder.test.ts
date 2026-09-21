import { describe, expect, it } from "bun:test"

import type { SDKMessage, StopHookInput } from "@anthropic-ai/claude-agent-sdk"

import {
	createMissionStatusReminder,
	MISSION_STATUS_REASON,
	MISSION_STATUS_TOOL,
} from "./mission-status-reminder"

const stopping = (stopHookActive: boolean): StopHookInput => ({
	hook_event_name: "Stop",
	stop_hook_active: stopHookActive,
	session_id: "sdk-0001",
	transcript_path: "/transcripts/sdk-0001.jsonl",
	cwd: "/workspace/space",
})

const calling = (name: string): SDKMessage =>
	({
		type: "assistant",
		parent_tool_use_id: null,
		message: {
			content: [{ type: "tool_use", id: "toolu-0001", name, input: {} }],
		},
	}) as unknown as SDKMessage

const signal = new AbortController().signal

describe("mission status reminder", () => {
	it("blocks a turn that ends without writing its status", async () => {
		const reminder = createMissionStatusReminder()

		expect(await reminder.stop(stopping(false), undefined, { signal })).toEqual(
			{ decision: "block", reason: MISSION_STATUS_REASON },
		)
		expect(MISSION_STATUS_REASON).toContain("mission_status")
	})

	it("lets a turn that wrote its status end", async () => {
		const reminder = createMissionStatusReminder()
		reminder.observe(calling(MISSION_STATUS_TOOL))

		expect(await reminder.stop(stopping(false), undefined, { signal })).toEqual(
			{},
		)
	})

	it("ignores a tool call of any other name", async () => {
		const reminder = createMissionStatusReminder()
		reminder.observe(calling("mcp__kiroshi__mission_create"))

		expect(
			await reminder.stop(stopping(false), undefined, { signal }),
		).toMatchObject({ decision: "block" })
	})

	it("lets a turn already continued by the hook end", async () => {
		const reminder = createMissionStatusReminder()

		expect(await reminder.stop(stopping(true), undefined, { signal })).toEqual(
			{},
		)
	})

	it("judges the next turn on its own tool calls", async () => {
		const reminder = createMissionStatusReminder()
		reminder.observe(calling(MISSION_STATUS_TOOL))
		await reminder.stop(stopping(false), undefined, { signal })

		expect(
			await reminder.stop(stopping(false), undefined, { signal }),
		).toMatchObject({ decision: "block" })
	})

	it("drops the mark on a continued stop too", async () => {
		const reminder = createMissionStatusReminder()
		reminder.observe(calling(MISSION_STATUS_TOOL))
		await reminder.stop(stopping(true), undefined, { signal })

		expect(
			await reminder.stop(stopping(false), undefined, { signal }),
		).toMatchObject({ decision: "block" })
	})
})
