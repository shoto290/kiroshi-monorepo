import { homedir } from "node:os"

import {
	type Options,
	query,
	type SlashCommand,
} from "@anthropic-ai/claude-agent-sdk"

import { readBotSettings, type SettingsOptions } from "./bot-settings"
import type { BundleScope } from "./bundle-writes"
import { resolveExecutable } from "./executable"
import { kiroshiServer } from "./kiroshi-server"
import { createPermissionGate } from "./permissions"
import { createPromptStream } from "./prompt-stream"
import { securityFloor } from "./security-floor"
import {
	CONNECT_BUDGET_MS,
	type ConnectPass,
	delay,
	unconnectedServers,
} from "./server-connect"
import { type ResolvedServers, resolvedServers } from "./server-env"
import { inheritedEnv } from "./session-env"
import { layerFor, unavailableServersSection } from "./system-layer"

import type {
	AgentCommand,
	AgentSession,
	EmitFrame,
	SessionFrame,
	SessionRequest,
} from "../provider"
import { describeError } from "../../describe-error"

const ABANDONED = "The session ended before this was answered."
const ENDED = "the agent ended"
const DISABLE_AUTO_MEMORY = "CLAUDE_CODE_DISABLE_AUTO_MEMORY"
const MCP_CONNECT_TIMEOUT = "MCP_CONNECT_TIMEOUT_MS"
export const CLASSIFY_ASK_USER_QUESTION =
	"CLAUDE_CODE_AUTO_MODE_CLASSIFY_ASK_USER_QUESTION"

const described = (commands: SlashCommand[]): AgentCommand[] =>
	commands.map(({ name, description }) => ({
		name,
		...(description ? { description } : {}),
	}))

const definedPaths = (paths: (string | undefined)[]): string[] =>
	paths.filter((path): path is string => Boolean(path))

const pluginPaths = (request: SessionRequest): string[] =>
	definedPaths([
		request.pluginPath,
		request.systemPluginPath,
		request.userPluginPath,
		request.spacePluginPath,
	])

const writeScope = (request: SessionRequest): BundleScope =>
	request.pluginPath
		? {
				botPath: request.pluginPath,
				userPath: request.userPluginPath,
				spacePath: request.spacePluginPath,
			}
		: {}

const writablePaths = ({
	botPath,
	userPath,
	spacePath,
}: BundleScope): string[] => definedPaths([botPath, userPath, spacePath])

const localPlugins = (paths: string[]): NonNullable<Options["plugins"]> =>
	paths.map((path) => ({ type: "local" as const, path }))

export const buildOptions = (
	request: SessionRequest,
	canUseTool: Options["canUseTool"],
	settings: SettingsOptions = readBotSettings(request).options,
	resolved: ResolvedServers = resolvedServers(request),
): Options => {
	const managedSettings = securityFloor({
		appDataDir: request.appDataDir,
		conversationId: request.conversationId,
		home: homedir(),
		platform: process.platform,
		pluginPaths: pluginPaths(request),
		writablePaths: writablePaths(writeScope(request)),
	})
	return {
		cwd: request.cwd,
		resume: request.resume,
		includePartialMessages: request.partialMessages,
		canUseTool,
		...settings,
		...(request.pluginPath && request.agent
			? {
					plugins: localPlugins(pluginPaths(request)),
					agent: request.agent,
					mcpServers: {
						...resolved.servers,
						...kiroshiServer({
							cwd: request.cwd,
							managedSettings,
							session: request.session,
						}),
					},
				}
			: {}),
		...(request.outputSchema
			? {
					outputFormat: {
						type: "json_schema" as const,
						schema: request.outputSchema,
					},
				}
			: {}),
		systemPrompt: {
			type: "preset",
			preset: "claude_code",
			append: layerFor(request, resolved.rejections),
		},
		env: {
			...inheritedEnv(),
			[DISABLE_AUTO_MEMORY]: "1",
			[CLASSIFY_ASK_USER_QUESTION]: "0",
			[MCP_CONNECT_TIMEOUT]: String(CONNECT_BUDGET_MS),
		},
		managedSettings,
		settingSources: [],
		strictMcpConfig: true,
		pathToClaudeCodeExecutable: resolveExecutable(),
		stderr: () => {},
	}
}

export const HELD_RELEASE_MS = 10_000

export type ConnectionReport = {
	emit: EmitFrame
	push: (text: string) => void
	pass: ConnectPass
	releaseAfter?: number
}

export const reportConnections = ({
	emit,
	push,
	pass,
	releaseAfter = HELD_RELEASE_MS,
}: ConnectionReport) => {
	const abandoning = new AbortController()
	const signal = abandoning.signal
	const held: string[] = []
	let details: string[] = []
	let holding = true
	let announced = false

	const hand = (text: string) => {
		if (announced || details.length === 0) {
			push(text)
			return
		}
		announced = true
		for (const detail of details) {
			emit({ type: "server_env_rejected", detail })
		}
		push(`${unavailableServersSection(details)}\n\n${text}`)
	}

	const release = (reported: string[]) => {
		if (signal.aborted) {
			return
		}
		details = reported
		holding = false
		for (const text of held.splice(0)) {
			hand(text)
		}
	}

	void delay(0, signal)
		.then(() => (signal.aborted ? [] : unconnectedServers({ ...pass, signal })))
		.then(release, () => release([]))

	void delay(releaseAfter, signal).then(() => {
		if (holding) {
			release([])
		}
	})

	return {
		prompt: (text: string) => {
			if (holding) {
				held.push(text)
				return
			}
			hand(text)
		},
		drop: () => {
			held.length = 0
		},
		abandon: () => {
			abandoning.abort()
			held.length = 0
			holding = false
		},
	}
}

export const openClaudeSession = async (
	request: SessionRequest,
	emit: EmitFrame,
): Promise<AgentSession> => {
	const prompts = createPromptStream()
	const permissions = createPermissionGate(emit, writeScope(request))
	const botSettings = readBotSettings(request)
	if (botSettings.rejection) {
		emit({ type: "settings_rejected", detail: botSettings.rejection })
	}
	const resolved = resolvedServers(request)
	for (const detail of resolved.rejections) {
		emit({ type: "server_env_rejected", detail })
	}
	const run = query({
		prompt: prompts.stream,
		options: buildOptions(
			request,
			permissions.canUseTool,
			botSettings.options,
			resolved,
		),
	})

	let closing = false

	const pump = async () => {
		try {
			for await (const message of run) {
				emit(message as unknown as SessionFrame)
			}
			return ENDED
		} catch (error) {
			return describeError(error)
		}
	}

	const drained = pump().then((detail) => {
		permissions.denyAll(ABANDONED)
		if (!closing) {
			emit({ type: "closed", detail })
		}
		return detail
	})
	const collapsed = drained.then((detail) => {
		throw new Error(detail)
	})
	collapsed.catch(() => {})

	const initialized = await Promise.race([
		run.initializationResult(),
		collapsed,
	])

	emit({ type: "commands", commands: described(initialized.commands) })

	const report = reportConnections({
		emit,
		push: prompts.push,
		pass: {
			names: Object.keys(resolved.servers),
			port: {
				status: () => run.mcpServerStatus(),
				reconnect: (name) => run.reconnectMcpServer(name),
			},
			env: request.serverEnv,
		},
	})

	return {
		prompt: report.prompt,
		interrupt: async () => {
			report.drop()
			await run.interrupt()
		},
		decide: permissions.decide,
		close: async () => {
			closing = true
			report.abandon()
			prompts.end()
			run.close()
			await drained
		},
	}
}
