import { homedir } from "node:os"

import {
	type Options,
	query,
	type SlashCommand,
} from "@anthropic-ai/claude-agent-sdk"

import { readBotSettings, type SettingsOptions } from "./bot-settings"
import type { BundleScope } from "./bundle-writes"
import { resolveExecutable } from "./executable"
import { KIROSHI_SERVER, kiroshiServer } from "./kiroshi-server"
import { createPermissionGate } from "./permissions"
import { createPromptStream } from "./prompt-stream"
import { securityFloor } from "./security-floor"
import {
	type ConnectPass,
	delay,
	type ReportedLine,
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
const SLASH_COMMAND = /^\/[^\s/]+(\s|$)/
const SERVER_NAMED = /^the server "([^"]+)"/
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
		},
		managedSettings,
		settingSources: [],
		strictMcpConfig: true,
		pathToClaudeCodeExecutable: resolveExecutable(),
		stderr: () => {},
	}
}

export const dialledServers = (options: Options): string[] =>
	Object.keys(options.mcpServers ?? {}).filter(
		(name) => name !== KIROSHI_SERVER,
	)

export type StopRequest = {
	dropped: boolean
	emit: EmitFrame
	interrupt: () => Promise<unknown>
}

const CANCELLED: SessionFrame = {
	type: "result",
	subtype: "interrupted",
	is_error: false,
}

export const stopTurn = async ({ dropped, emit, interrupt }: StopRequest) => {
	if (dropped) {
		emit(CANCELLED)
		return
	}
	await interrupt()
}

type WaitingLine = {
	detail: string
	owing: boolean
}

export type ConnectionReport = {
	emit: EmitFrame
	push: (text: string) => void
	pass: ConnectPass
}

const latest = (lines: WaitingLine[]): WaitingLine[] => {
	const named = new Map<string, WaitingLine>()
	for (const line of lines) {
		const key = SERVER_NAMED.exec(line.detail)?.[1] ?? line.detail
		named.delete(key)
		named.set(key, line)
	}
	return [...named.values()]
}

export const reportConnections = ({ emit, push, pass }: ConnectionReport) => {
	const abandoning = new AbortController()
	const { signal } = abandoning
	const held: string[] = []
	const waiting: WaitingLine[] = []
	let holding = pass.names.length > 0

	const framed = (detail: string) => {
		emit({ type: "server_env_rejected", detail })
	}

	const reported = ({ detail, notice }: ReportedLine) => {
		if (signal.aborted) {
			return
		}
		if (notice) {
			framed(detail)
		}
		waiting.push({ detail, owing: false })
	}

	const hand = (text: string) => {
		waiting.splice(0, waiting.length, ...latest(waiting))
		for (const line of waiting) {
			if (line.owing) {
				framed(line.detail)
				line.owing = false
			}
		}
		if (waiting.length === 0 || SLASH_COMMAND.test(text)) {
			push(text)
			return
		}
		const section = unavailableServersSection(
			waiting.splice(0).map((line) => line.detail),
		)
		push(`${section}\n\n${text}`)
	}

	const release = (settled: string[]) => {
		if (signal.aborted) {
			return
		}
		waiting.push(...settled.map((detail) => ({ detail, owing: true })))
		holding = false
		for (const text of held.splice(0)) {
			hand(text)
		}
	}

	void delay(0, signal)
		.then(() =>
			signal.aborted
				? []
				: unconnectedServers({ ...pass, signal, report: reported }),
		)
		.then(release, () => release([]))

	return {
		prompt: (text: string) => {
			if (holding) {
				held.push(text)
				return
			}
			hand(text)
		},
		drop: () => {
			const dropped = held.length > 0
			held.length = 0
			return dropped
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
	const options = buildOptions(
		request,
		permissions.canUseTool,
		botSettings.options,
		resolved,
	)
	const run = query({ prompt: prompts.stream, options })

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
			names: dialledServers(options),
			port: {
				status: () => run.mcpServerStatus(),
				reconnect: (name) => run.reconnectMcpServer(name),
			},
			env: request.serverEnv,
		},
	})

	return {
		prompt: report.prompt,
		interrupt: () =>
			stopTurn({
				dropped: report.drop(),
				emit,
				interrupt: () => run.interrupt(),
			}),
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
