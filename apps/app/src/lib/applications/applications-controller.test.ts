import { describe, expect, it, vi } from "vitest"

import type { Application, ApplicationSearch } from "./application-port"
import {
	createApplicationsController,
	type InstallTarget,
} from "./applications-controller"
import {
	createFakeApplicationPort,
	type FakeApplicationPort,
} from "./fake-application-port"

import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"
import type { EnvOwner } from "../conversations/store-contract"

const USER: EnvOwner = { kind: "user" }

const COMPANION: EnvOwner = { kind: "bot", id: "default", spaceId: "personal" }

const PAPER: Application = {
	name: "paper",
	title: "Paper",
	description: "Draws interfaces.",
	config: { command: "npx", args: ["-y", "@paper/mcp"] },
	tools: ["draw"],
	install: { kind: "nothing" },
}

const SUPERSET: Application = {
	name: "superset",
	title: "Superset",
	description: "Runs workspaces.",
	config: { type: "http", url: "https://api.superset.sh/mcp" },
	tools: ["tasks_list"],
	install: {
		kind: "key",
		fields: [
			{ name: "Authorization", secret: "SUPERSET_API_KEY", concealed: true },
		],
	},
}

const TWO_KEYED: Application = {
	name: "@owner/two-headers",
	title: "Two headers",
	description: "Asks a key and a tenant.",
	config: { type: "http", url: "https://two.test/mcp" },
	tools: ["search"],
	install: {
		kind: "key",
		fields: [
			{ name: "apiKey", secret: "APIKEY", concealed: true },
			{ name: "tenant", secret: "TENANT", concealed: false },
		],
	},
}

const LINEAR: Application = {
	name: "linear",
	title: "Linear",
	description: "Files issues.",
	config: { type: "http", url: "https://mcp.linear.app/mcp" },
	tools: ["list_issues"],
	install: { kind: "oauth" },
}

const REFUSED: Application = {
	name: "@owner/queried",
	title: "Queried",
	description: "Asks a key its url would carry.",
	config: { type: "http", url: "https://queried.test/mcp" },
	tools: ["search"],
	install: {
		kind: "refused",
		field: "apiKey",
		reason: 'the required field "apiKey" names no header to carry it',
	},
}

const targetOf = (overrides: Partial<InstallTarget> = {}): InstallTarget => ({
	owner: USER,
	declared: [],
	connect: async () => undefined,
	settle: async () => undefined,
	...overrides,
})

const SEARCH_DELAY = 10

const controllerOn = (
	port = createFakeApplicationPort(),
	store = createFakeTranscriptStore(),
) =>
	createApplicationsController(port, store, {
		reportFailure: () => undefined,
		searchDelayMs: SEARCH_DELAY,
	})

const settled = () =>
	new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY * 3))

const searchesOf = (port: FakeApplicationPort) =>
	port.calls.filter((call) => call.command === "search")

describe("applications controller", () => {
	it("opens on the curated applications the host answers", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER, SUPERSET]
		const controller = controllerOn(port)

		await controller.open()

		expect(controller.getState().curated).toEqual([PAPER, SUPERSET])
	})

	it("reads the catalogue once for every panel that opens it", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const controller = controllerOn(port)

		await controller.open()
		await controller.open()

		expect(port.calls).toEqual([{ command: "catalogue" }])
	})

	it("reports it is reading the catalogue until the read lands", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const pending: ((curated: Application[]) => void)[] = []
		port.catalogue = () =>
			new Promise((resolve) => {
				pending.push(resolve)
			})
		const controller = controllerOn(port)

		const reading = controller.open()
		expect(controller.getState().isReadingCatalogue).toBe(true)

		pending[0]?.([PAPER])
		await reading

		expect(controller.getState().isReadingCatalogue).toBe(false)
		expect(controller.getState().curated).toEqual([PAPER])
	})

	it("reports a catalogue it could not read", async () => {
		const port = createFakeApplicationPort()
		port.refusals.catalogue = { kind: "catalogueUnreadable", detail: "gone" }
		const reportFailure = vi.fn()
		const controller = createApplicationsController(
			port,
			createFakeTranscriptStore(),
			{ reportFailure },
		)

		await controller.open()

		expect(controller.getState().hasCatalogueFailed).toBe(true)
		expect(reportFailure).toHaveBeenCalledTimes(1)
	})

	it("searches the registry for what is typed", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		const controller = controllerOn(port)

		controller.search("linear")
		expect(controller.getState().isSearching).toBe(true)
		await settled()

		expect(controller.getState().registry).toEqual([LINEAR])
		expect(controller.getState().isSearching).toBe(false)
	})

	it("sends one registry search once the typing stops", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		const controller = controllerOn(port)

		for (const typed of ["l", "li", "lin", "line", "linea", "linear"]) {
			controller.search(typed)
		}
		expect(searchesOf(port)).toEqual([])
		expect(controller.getState().isSearching).toBe(true)
		await settled()

		expect(searchesOf(port)).toEqual([{ command: "search", query: "linear" }])
		expect(controller.getState().registry).toEqual([LINEAR])
		expect(controller.getState().isSearching).toBe(false)
	})

	it("keeps the answer of the last search and drops an earlier one", async () => {
		const port = createFakeApplicationPort()
		const pending: ((found: ApplicationSearch) => void)[] = []
		port.search = () =>
			new Promise((resolve) => {
				pending.push(resolve)
			})
		const controller = controllerOn(port)

		controller.search("linear")
		await settled()
		controller.retry()
		const [answerFirst, answerLast] = pending
		answerLast?.({ applications: [LINEAR] })
		await settled()
		answerFirst?.({ applications: [PAPER] })
		await settled()

		expect(controller.getState().registry).toEqual([LINEAR])
	})

	it("drops the answer of an earlier query that arrives last", async () => {
		const port = createFakeApplicationPort()
		const pending = new Map<string, (found: ApplicationSearch) => void>()
		port.search = (query) =>
			new Promise((resolve) => {
				pending.set(query, resolve)
			})
		const controller = controllerOn(port)

		controller.search("lin")
		await settled()
		controller.search("linear")
		await settled()
		pending.get("linear")?.({ applications: [LINEAR] })
		await settled()
		pending.get("lin")?.({ applications: [PAPER] })
		await settled()

		expect(controller.getState().registry).toEqual([LINEAR])
		expect(controller.getState().isSearching).toBe(false)
	})

	it("cancels the scheduled search when the field is cleared", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		const controller = controllerOn(port)

		controller.search("linear")
		controller.search("")
		await settled()

		expect(searchesOf(port)).toEqual([])
		expect(controller.getState().registry).toEqual([])
		expect(controller.getState().isSearching).toBe(false)
		expect(controller.getState().hasSearchFailed).toBe(false)
	})

	it("clears the registry when the query is emptied", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		const controller = controllerOn(port)
		controller.search("linear")
		await settled()

		controller.search("")

		expect(controller.getState().registry).toEqual([])
		expect(controller.getState().isSearching).toBe(false)
	})

	it("reports a refused search and searches again on a retry", async () => {
		const port = createFakeApplicationPort()
		port.refusals.search = { kind: "registryTimedOut" }
		const controller = controllerOn(port)

		controller.search("linear")
		await settled()
		expect(controller.getState().hasSearchFailed).toBe(true)

		port.refusals = {}
		port.found = [LINEAR]
		controller.retry()
		await settled()

		expect(controller.getState().hasSearchFailed).toBe(false)
		expect(controller.getState().registry).toEqual([LINEAR])
	})

	it("holds on to the results when one registry side failed", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		port.foundFailure = { kind: "registryTimedOut" }
		const controller = controllerOn(port)

		controller.search("linear")
		await settled()

		expect(controller.getState().registry).toEqual([LINEAR])
		expect(controller.getState().hasSearchPartlyFailed).toBe(true)
		expect(controller.getState().hasSearchFailed).toBe(false)
	})

	it("reports no partial failure when both registry sides answered", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		const controller = controllerOn(port)

		controller.search("linear")
		await settled()

		expect(controller.getState().hasSearchPartlyFailed).toBe(false)
	})

	it("drops the partial failure as soon as the query changes", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		port.foundFailure = { kind: "registryTimedOut" }
		const controller = controllerOn(port)
		controller.search("linear")
		await settled()

		controller.search("linears")

		expect(controller.getState().hasSearchPartlyFailed).toBe(false)
	})

	it("leaves no partial failure behind a refused search", async () => {
		const port = createFakeApplicationPort()
		port.found = [LINEAR]
		port.foundFailure = { kind: "registryTimedOut" }
		const controller = controllerOn(port)
		controller.search("linear")
		await settled()

		port.refusals.search = { kind: "registryTimedOut" }
		controller.retry()
		await settled()

		expect(controller.getState().hasSearchFailed).toBe(true)
		expect(controller.getState().hasSearchPartlyFailed).toBe(false)
	})

	it("declares a server for an install that asks nothing", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const store = createFakeTranscriptStore()
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("paper")

		await controller.install(targetOf())

		expect(await store.userPluginMcpServers()).toEqual([
			{ name: "paper", config: PAPER.config },
		])
	})

	it("writes the typed key under the secrets of the declared server", async () => {
		const port = createFakeApplicationPort()
		port.curated = [SUPERSET]
		const store = createFakeTranscriptStore()
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("superset")

		await controller.install(targetOf(), ["sk-typed"])

		const secrets = await store.environmentVariables({
			kind: "server",
			name: "superset",
			owner: USER,
		})
		expect(secrets.map((entry) => entry.name)).toEqual(["SUPERSET_API_KEY"])
	})

	it("refuses an install naming a field the page left without a value", async () => {
		const port = createFakeApplicationPort()
		port.curated = [TWO_KEYED]
		const store = createFakeTranscriptStore()
		const declare = vi.spyOn(store, "setUserPluginMcpServer")
		const write = vi.spyOn(store, "setEnvironmentVariable")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("@owner/two-headers")

		await controller.install(targetOf(), ["sk-typed"])

		expect(controller.getState().failure).toContain("tenant")
		expect(declare).not.toHaveBeenCalled()
		expect(write).not.toHaveBeenCalled()
		expect(await store.userPluginMcpServers()).toEqual([])
	})

	it("names every field it has no value for", async () => {
		const port = createFakeApplicationPort()
		port.curated = [TWO_KEYED]
		const controller = controllerOn(port)
		await controller.open()
		controller.pick("@owner/two-headers")

		await controller.install(targetOf(), ["   "])

		expect(controller.getState().failure).toContain("apiKey")
		expect(controller.getState().failure).toContain("tenant")
	})

	it("writes every value under its own variable in the scope of the server", async () => {
		const port = createFakeApplicationPort()
		port.curated = [TWO_KEYED]
		const store = createFakeTranscriptStore()
		const write = vi.spyOn(store, "setEnvironmentVariable")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("@owner/two-headers")

		await controller.install(targetOf(), ["sk-typed", "acme"])

		const scope = { kind: "server", name: "@owner/two-headers", owner: USER }
		expect(write.mock.calls).toEqual([
			[scope, "APIKEY", "sk-typed"],
			[scope, "TENANT", "acme"],
		])
		expect(controller.getState().failure).toBeNull()
	})

	it("runs the connect of the scope for an install that signs in", async () => {
		const port = createFakeApplicationPort()
		port.curated = [LINEAR]
		const controller = controllerOn(port)
		await controller.open()
		controller.pick("linear")
		const connect = vi.fn(async () => undefined)

		await controller.install(targetOf({ connect }))

		expect(connect).toHaveBeenCalledWith("linear", "https://mcp.linear.app/mcp")
	})

	it("shows the reason of a refused declaration and keeps the page open", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const store = createFakeTranscriptStore()
		vi.spyOn(store, "setUserPluginMcpServer").mockRejectedValue({
			kind: "store",
			detail: "the bundle is read only",
		})
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("paper")

		await controller.install(targetOf())

		expect(controller.getState().failure).toContain("the bundle is read only")
		expect(controller.getState().picked).toEqual(PAPER)
		expect(await store.userPluginMcpServers()).toEqual([])
	})

	it("shows the reason of a refused install and declares no server", async () => {
		const port = createFakeApplicationPort()
		port.curated = [REFUSED]
		const store = createFakeTranscriptStore()
		const declare = vi.spyOn(store, "setUserPluginMcpServer")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("@owner/queried")

		await controller.install(targetOf())

		expect(controller.getState().failure).toContain("apiKey")
		expect(declare).not.toHaveBeenCalled()
		expect(await store.userPluginMcpServers()).toEqual([])
	})

	it("shows the reason a config no runner runs was refused and writes nothing", async () => {
		const port = createFakeApplicationPort()
		port.curated = [TWO_KEYED]
		port.runnerRefusal = {
			field: "uvx",
			reason: "the command uvx is on no directory of your PATH",
		}
		const store = createFakeTranscriptStore()
		const declare = vi.spyOn(store, "setUserPluginMcpServer")
		const write = vi.spyOn(store, "setEnvironmentVariable")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("@owner/two-headers")

		await controller.install(targetOf(), ["sk-typed", "acme"])

		expect(controller.getState().failure).toContain(
			"the command uvx is on no directory of your PATH",
		)
		expect(declare).not.toHaveBeenCalled()
		expect(write).not.toHaveBeenCalled()
		expect(await store.userPluginMcpServers()).toEqual([])
	})

	it("reads the config of what it installs against the runners of this machine", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const controller = controllerOn(port)
		await controller.open()
		controller.pick("paper")

		await controller.install(targetOf())

		expect(port.calls).toContainEqual({
			command: "runnable",
			config: PAPER.config,
		})
		expect(controller.getState().failure).toBeNull()
	})

	it("refuses a second add of the application it is installing", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const store = createFakeTranscriptStore()
		const declare = vi.spyOn(store, "setUserPluginMcpServer")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("paper")

		const running = controller.install(targetOf())
		await controller.install(targetOf())
		await running

		expect(declare).toHaveBeenCalledTimes(1)
	})

	it("installs under a scope of its own what another scope already declares", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const store = createFakeTranscriptStore()
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("paper")
		await controller.install(targetOf())

		await controller.install(
			targetOf({ owner: COMPANION, declared: ["ledger"] }),
		)

		expect(await store.botMcpServers("default")).toEqual([
			{ name: "paper", config: PAPER.config },
		])
	})

	it("refuses an add of an application the owner already declares", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const store = createFakeTranscriptStore()
		const declare = vi.spyOn(store, "setUserPluginMcpServer")
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("paper")

		await controller.install(targetOf({ declared: ["paper"] }))

		expect(declare).not.toHaveBeenCalled()
	})

	it("undeclares what the install declared when the key is refused", async () => {
		const port = createFakeApplicationPort()
		port.curated = [SUPERSET]
		const store = createFakeTranscriptStore()
		vi.spyOn(store, "setEnvironmentVariable").mockRejectedValue({
			kind: "env",
			detail: "the keyring is locked",
		})
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("superset")

		await controller.install(targetOf(), ["sk-typed"])

		expect(await store.userPluginMcpServers()).toEqual([])
		expect(controller.getState().failure).toContain("the keyring is locked")
	})

	it("leaves a declaration it found in place when the key is refused", async () => {
		const port = createFakeApplicationPort()
		port.curated = [SUPERSET]
		const store = createFakeTranscriptStore()
		await store.setUserPluginMcpServer("superset", { type: "http" })
		vi.spyOn(store, "setEnvironmentVariable").mockRejectedValue({
			kind: "env",
			detail: "the keyring is locked",
		})
		const controller = controllerOn(port, store)
		await controller.open()
		controller.pick("superset")

		await controller.install(targetOf(), ["sk-typed"])

		expect(await store.userPluginMcpServers()).toEqual([
			{ name: "superset", config: SUPERSET.config },
		])
		expect(controller.getState().failure).toContain("the keyring is locked")
	})

	it("reports the key refusal even when the undeclaring is refused too", async () => {
		const port = createFakeApplicationPort()
		port.curated = [SUPERSET]
		const store = createFakeTranscriptStore()
		vi.spyOn(store, "setEnvironmentVariable").mockRejectedValue({
			kind: "env",
			detail: "the keyring is locked",
		})
		vi.spyOn(store, "deleteUserPluginMcpServer").mockRejectedValue({
			kind: "store",
			detail: "the bundle is read only",
		})
		const reportFailure = vi.fn()
		const controller = createApplicationsController(port, store, {
			reportFailure,
		})
		await controller.open()
		controller.pick("superset")

		await controller.install(targetOf(), ["sk-typed"])

		expect(controller.getState().failure).toContain("the keyring is locked")
		expect(reportFailure).toHaveBeenCalledTimes(1)
	})

	it("settles the scope once the install lands", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		const controller = controllerOn(port)
		await controller.open()
		controller.pick("paper")
		const settle = vi.fn(async () => undefined)

		await controller.install(targetOf({ settle }))

		expect(settle).toHaveBeenCalledTimes(1)
	})

	it("leaves the install page without forgetting the search", async () => {
		const port = createFakeApplicationPort()
		port.curated = [PAPER]
		port.found = [LINEAR]
		const controller = controllerOn(port)
		await controller.open()
		controller.search("linear")
		await settled()
		controller.pick("paper")

		controller.leave()

		expect(controller.getState().picked).toBeNull()
		expect(controller.getState().query).toBe("linear")
		expect(controller.getState().registry).toEqual([LINEAR])
	})
})
