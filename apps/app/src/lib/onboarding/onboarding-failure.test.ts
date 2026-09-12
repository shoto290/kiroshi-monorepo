import { describe, expect, it } from "vitest"

import { exitDetailOf, isNotRunning } from "./onboarding-failure"

const NAMED_KINDS = [
	"alreadyRunning",
	"notRunning",
	"cancelled",
	"timedOut",
	"refusedUrl",
	"flowTimedOut",
	"notAuthenticated",
	"binaryNotFound",
	"spawnFailed",
	"startupTimeout",
	"crashed",
]

const A_CAMEL_CASE_TOKEN = /[a-z][A-Z]/

describe("the exit detail of a failure", () => {
	it("shows the detail a failure carries", () => {
		expect(
			exitDetailOf({ kind: "crashed", detail: "exited with code 1" }),
		).toBe("exited with code 1")
	})

	it.each(NAMED_KINDS)("says %s in words", (kind) => {
		const detail = exitDetailOf({ kind })

		expect(detail).not.toBe(kind)
		expect(detail).not.toMatch(A_CAMEL_CASE_TOKEN)
	})

	it("says in words a kind it does not know", () => {
		const detail = exitDetailOf({ kind: "staleRuntimeSession" })

		expect(detail).not.toMatch(A_CAMEL_CASE_TOKEN)
	})

	it("reads the message of a raw refusal", () => {
		expect(exitDetailOf(new Error("the bridge is down"))).toBe(
			"the bridge is down",
		)
	})

	it("says in words a refusal that names nothing", () => {
		expect(exitDetailOf(undefined)).not.toMatch(A_CAMEL_CASE_TOKEN)
	})

	it("knows the sign-in that is no longer running", () => {
		expect(isNotRunning({ kind: "notRunning" })).toBe(true)
		expect(isNotRunning({ kind: "cancelled" })).toBe(false)
	})
})
