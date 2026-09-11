import { describe, expect, it } from "bun:test"

import { AWAITING_AUTH, leftOut } from "./server-env"
import { standingOf } from "./server-standing"

describe("standingOf", () => {
	it("names a server holding its tools", () => {
		expect(
			standingOf({
				detail:
					'the server "superset" connected, and holds its tools for the rest of this session',
				state: "holding",
			}),
		).toEqual({ name: "superset", state: "holding" })
	})

	it("names a server waiting for authorization with no reason", () => {
		expect(
			standingOf({
				detail: leftOut("granola", AWAITING_AUTH),
				state: "needs-auth",
			}),
		).toEqual({ name: "granola", state: "needs-auth" })
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
