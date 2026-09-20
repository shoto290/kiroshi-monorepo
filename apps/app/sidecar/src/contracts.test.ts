import { describe, expect, it } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { z } from "zod"

import { type Command, createRouter } from "./serve"

import { readBotSettings } from "./providers/claude/bot-settings"
import { sessionServers } from "./providers/claude/bundle-servers"
import { kiroshiTools } from "./providers/claude/kiroshi-server"
import type { AgentProvider } from "./providers/provider"

const REWRITE = "bun run snapshots"

const CONTRACTS = new URL("../../contracts/", import.meta.url).pathname

const TOOLS_SNAPSHOT = "kiroshi-tools.json"

const LAYERS_SNAPSHOT = "plugin-layers.sidecar.json"

const COMMANDS = "host-commands.ndjson"

const LAYERS = ["system", "user", "space", "companion"] as const

const rendered = (live: unknown) => `${JSON.stringify(live, null, "\t")}\n`

const frozen = (name: string, live: unknown) => {
	const path = join(CONTRACTS, name)
	const written = rendered(live)
	if (process.env.UPDATE_SNAPSHOTS) {
		writeFileSync(path, written)
		return
	}
	expect(readFileSync(path, "utf8")).toBe(written)
}

const committedLines = (name: string): Command[] =>
	readFileSync(join(CONTRACTS, name), "utf8")
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as Command)

const bundleOf = (layer: string) =>
	join(CONTRACTS, "plugin-layers", "plugins", layer)

const toolEntries = () =>
	kiroshiTools({
		cwd: "/workspace/space",
		managedSettings: {},
		session: "k1",
	}).map((held) => ({
		name: held.name,
		description: held.description,
		inputSchema: z.toJSONSchema(z.object(held.inputSchema)),
	}))

const mergedServers = () =>
	sessionServers({
		pluginPath: bundleOf("companion"),
		systemPluginPath: bundleOf("system"),
		userPluginPath: bundleOf("user"),
		spacePluginPath: bundleOf("space"),
	})

const acceptedSettings = () =>
	Object.fromEntries(
		LAYERS.map((layer) => [
			layer,
			readBotSettings({
				cwd: bundleOf(layer),
				partialMessages: false,
				settingsPath: join(bundleOf(layer), "settings.json"),
			}),
		]),
	)

const HANDLER_OF: Record<string, string> = {
	open: "openSession",
	prompt: "promptSession",
	interrupt: "interruptSession",
	permission: "decidePermission",
	host_response: "settleHostRequest",
	close: "closeSession",
	check: "reportConnection",
	models: "listModels",
	tools: "listTools",
	title: "nameConversation",
	sign_in: "startSignIn",
	sign_in_code: "enterSignInCode",
	sign_in_cancel: "cancelSignIn",
	mcp_oauth_authorize: "authorizeServer",
	mcp_oauth_cancel: "cancelAuthorization",
	mcp_oauth_revoke: "revokeGrant",
	mcp_oauth_refresh: "refreshGrant",
}

const refuses = (name: string) => () => {
	throw new Error(`the routing test never calls ${name}`)
}

const silentProvider: AgentProvider = {
	id: "contracts",
	version: "0.0.0",
	sdkVersion: "0.0.0",
	capabilities: [],
	assertReady: refuses("assertReady"),
	authenticate: refuses("authenticate"),
	signIn: refuses("signIn"),
	enterSignInCode: refuses("enterSignInCode"),
	cancelSignIn: refuses("cancelSignIn"),
	models: refuses("models"),
	tools: refuses("tools"),
	title: refuses("title"),
	open: refuses("open"),
}

describe("the frozen back-end contracts", () => {
	it(`holds every kiroshi tool in ${TOOLS_SNAPSHOT}, rewritten by \`${REWRITE}\``, () => {
		frozen(TOOLS_SNAPSHOT, toolEntries())
	})

	it(`holds what the plugin readers extract in ${LAYERS_SNAPSHOT}, rewritten by \`${REWRITE}\``, () => {
		frozen(LAYERS_SNAPSHOT, {
			mergedServers: mergedServers(),
			acceptedSettings: acceptedSettings(),
		})
	})

	it(`routes every command of ${COMMANDS} to the handler that serves it`, () => {
		const { route } = createRouter(silentProvider, () => undefined)
		const routed = committedLines(COMMANDS).map(
			(command) => [command.type, route(command)?.name] as const,
		)

		expect(Object.fromEntries(routed)).toEqual(HANDLER_OF)
	})
})
