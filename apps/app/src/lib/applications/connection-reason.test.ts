import { describe, expect, it } from "vitest"

import { toConnectionReason } from "./connection-reason"

const CARRIED_KINDS = [
	"alreadyRunning",
	"store",
	"transport",
	"refusedUrl",
	"browserRefused",
]

describe("the reason a connect was refused", () => {
	it.each(CARRIED_KINDS)("carries %s as it stands", (kind) => {
		expect(toConnectionReason({ kind })).toEqual({ kind })
	})

	it.each(["timedOut", "flowTimedOut"])("carries %s as timedOut", (kind) => {
		expect(toConnectionReason({ kind })).toEqual({ kind: "timedOut" })
	})

	it("carries the detail of a kind the screen does not render", () => {
		expect(
			toConnectionReason({ kind: "denied", detail: "access_denied" }),
		).toEqual({ kind: "unknown", detail: "access_denied" })
	})

	it.each([{ kind: "failed" }, { kind: "failed", detail: "  " }])(
		"falls back on the kind when that kind carries no detail",
		(refusal) => {
			expect(toConnectionReason(refusal)).toEqual({
				kind: "unknown",
				detail: "failed",
			})
		},
	)

	it("reads the message of a refusal carrying no kind", () => {
		expect(toConnectionReason(new Error("the sidecar is down"))).toEqual({
			kind: "unknown",
			detail: "the sidecar is down",
		})
	})

	it("reads as text a refusal that is neither shaped nor an error", () => {
		expect(toConnectionReason("connect exploded")).toEqual({
			kind: "unknown",
			detail: "connect exploded",
		})
	})
})
