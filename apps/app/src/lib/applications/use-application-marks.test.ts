// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { createApplicationsController } from "./applications-controller"
import {
	createFakeApplicationPort,
	type FakeApplicationPort,
} from "./fake-application-port"
import { useApplicationMarks } from "./use-application-marks"

import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import type { BotMcpServer } from "../conversations/store-contract"

afterEach(cleanup)

const ATLAS: BotMcpServer = { name: "atlas", config: {} }

const LEDGER: BotMcpServer = { name: "ledger", config: {} }

const KEPT: BotMcpServer = {
	name: "linear",
	config: {},
	title: "Linear",
	logo: "<svg />",
}

const askedNamesOf = (port: FakeApplicationPort) =>
	port.calls.filter((call) => call.command === "named").map((call) => call.name)

const asking = (servers: BotMcpServer[]) => {
	const port = createFakeApplicationPort()
	const controller = createApplicationsController(
		port,
		createFakeTranscriptStore(),
		{ reportFailure: () => undefined },
	)
	const rendered = renderHook(
		(declared: BotMcpServer[]) => useApplicationMarks(controller, declared),
		{ initialProps: servers },
	)
	return { port, rendered }
}

describe("useApplicationMarks", () => {
	it("asks the host for every declared name that kept no mark", () => {
		const { port } = asking([ATLAS, KEPT])

		expect(askedNamesOf(port)).toEqual(["atlas"])
	})

	it("asks once for a name two panels declare, however often they render", async () => {
		const { port, rendered } = asking([ATLAS, ATLAS])

		await act(async () => rendered.rerender([ATLAS]))

		expect(askedNamesOf(port)).toEqual(["atlas"])
	})

	it("asks for a name a panel declares later", async () => {
		const { port, rendered } = asking([ATLAS])

		await act(async () => rendered.rerender([ATLAS, LEDGER]))

		expect(askedNamesOf(port)).toEqual(["atlas", "ledger"])
	})
})
