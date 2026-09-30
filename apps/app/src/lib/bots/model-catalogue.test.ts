import { beforeEach, describe, expect, it, vi } from "vitest"

import { readModelCatalogue } from "./model-catalogue"

import { drivesRealHost, invoke } from "@/lib/host"

vi.mock("@/lib/host", () => ({
	drivesRealHost: vi.fn(),
	invoke: vi.fn(),
}))

describe("readModelCatalogue", () => {
	beforeEach(() => vi.mocked(invoke).mockReset())

	it("reads the value of every model the host offers, in its order", async () => {
		vi.mocked(drivesRealHost).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue([
			{ value: "opus", supportedEffortLevels: ["low", "high"] },
			{ value: "haiku", supportedEffortLevels: [] },
		])

		await expect(readModelCatalogue()).resolves.toEqual(["opus", "haiku"])
		expect(invoke).toHaveBeenCalledWith("agent_models")
	})

	it("asks nothing of a host that is not the real one", async () => {
		vi.mocked(drivesRealHost).mockReturnValue(false)

		await expect(readModelCatalogue()).resolves.toEqual([])
		expect(invoke).not.toHaveBeenCalled()
	})
})
