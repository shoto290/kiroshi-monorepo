import { afterEach, describe, expect, it } from "bun:test"

import { AWAITING_AUTH, leftOut } from "./server-env"
import { recordStanding, standingOf } from "./server-standing"

import type { SessionFrame } from "../provider"
import { closeHostChannel, openHostChannel, settleHostAnswer } from "../../host"

const SESSION = "k1"

const HOLDING =
	'the server "superset" connected, and holds its tools for the rest of this session'

describe("standingOf", () => {
	it("names a server holding its tools", () => {
		expect(standingOf({ detail: HOLDING, state: "holding" })).toEqual({
			name: "superset",
			state: "holding",
		})
	})

	it("carries the reason a server waits for authorization for", () => {
		expect(
			standingOf({
				detail: leftOut("granola", AWAITING_AUTH),
				state: "needs-auth",
			}),
		).toEqual({ name: "granola", state: "needs-auth", reason: AWAITING_AUTH })
	})

	it("carries the reason a server was left out for", () => {
		expect(
			standingOf({
				detail: leftOut("clock", "TOKEN is defined by no scope"),
				state: "left-out",
			}),
		).toEqual({
			name: "clock",
			state: "left-out",
			reason: "TOKEN is defined by no scope",
		})
	})

	it("reports neither a line naming no server nor a server still connecting", () => {
		expect(
			standingOf({
				detail: "the environment store could not be read",
				state: "left-out",
			}),
		).toBeUndefined()
		expect(
			standingOf({
				detail: 'the server "superset" is still connecting after 4750 ms',
				state: "connecting",
			}),
		).toBeUndefined()
	})
})

describe("recordStanding", () => {
	afterEach(() => {
		closeHostChannel(SESSION)
	})

	it("carries the standing under the subtype the host records it by", () => {
		const asked: unknown[] = []
		openHostChannel(SESSION, (frame: SessionFrame) => {
			const { requestId, request } = frame as {
				requestId: string
				request: unknown
			}
			asked.push(request)
			settleHostAnswer(SESSION, { requestId })
		})

		recordStanding(SESSION)({ detail: HOLDING, state: "holding" })

		expect(asked).toEqual([
			{
				subtype: "standing",
				operation: "report",
				payload: { name: "superset", state: "holding" },
			},
		])
	})
})
