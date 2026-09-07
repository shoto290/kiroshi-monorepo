import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk"

import { leftOut } from "./server-env"
import { unavailableServersSection } from "./system-layer"

import type { ServerEnv } from "../provider"
import { describeError } from "../../describe-error"

export type ServerStatus = Pick<McpServerStatus, "name" | "status" | "error">

export type ConnectPort = {
	status: () => Promise<ServerStatus[]>
	reconnect: (name: string) => Promise<void>
}

export type ConnectPass = {
	names: string[]
	port: ConnectPort
	env?: ServerEnv
}

const NO_ENV: ServerEnv = {}

const PENDING_POLL = 250
const PENDING_WAIT = 5_000
const RECONNECT_LIMIT = 20_000
const PASS_LIMIT = 30_000
const REASON_LIMIT = 300
const REDACTED = "[redacted]"
const NO_REASON = "no reason given"
const TWO_ATTEMPTS = "two connection attempts failed"

const OUTLASTED = Symbol("outlasted")

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms))

const withinDeadline = async <T>(
	work: Promise<T>,
	ms: number,
): Promise<T | typeof OUTLASTED> => {
	let timer: ReturnType<typeof setTimeout> | undefined
	const bound = new Promise<typeof OUTLASTED>((resolve) => {
		timer = setTimeout(() => resolve(OUTLASTED), ms)
	})
	try {
		return await Promise.race([work, bound])
	} finally {
		clearTimeout(timer)
	}
}

const stillPending = (statuses: ServerStatus[], names: string[]): boolean =>
	statuses.some(
		({ name, status }) => names.includes(name) && status === "pending",
	)

const notConnected = (statuses: ServerStatus[], names: string[]): string[] => {
	const settled = new Set(
		statuses
			.filter(({ status }) => status === "connected" || status === "disabled")
			.map(({ name }) => name),
	)
	return names.filter((name) => !settled.has(name))
}

const settledStatuses = async (
	port: ConnectPort,
	names: string[],
): Promise<ServerStatus[]> => {
	const until = Date.now() + PENDING_WAIT
	let statuses = await port.status()
	while (stillPending(statuses, names) && Date.now() < until) {
		await delay(PENDING_POLL)
		statuses = await port.status()
	}
	return statuses
}

const reconnectFailure = async (
	port: ConnectPort,
	name: string,
): Promise<string | undefined> => {
	const thrown = await withinDeadline(
		port.reconnect(name).then(
			() => undefined,
			(error: unknown) => describeError(error),
		),
		RECONNECT_LIMIT,
	)
	return thrown === OUTLASTED ? undefined : thrown
}

const storedValues = ({ base, perServer }: ServerEnv): string[] =>
	[
		...Object.values(base ?? {}),
		...Object.values(perServer ?? {}).flatMap((scope) => Object.values(scope)),
	].filter((value) => value.length > 0)

const readable = (reason: string, secrets: string[]): string =>
	secrets
		.reduce((held, secret) => held.split(secret).join(REDACTED), reason)
		.slice(0, REASON_LIMIT)

const reportPass = async ({
	names,
	port,
	env = NO_ENV,
}: ConnectPass): Promise<string[]> => {
	const settled = await settledStatuses(port, names)
	const unconnected = notConnected(settled, names)
	if (unconnected.length === 0) {
		return []
	}
	const thrown = new Map(
		await Promise.all(
			unconnected.map(
				async (name) => [name, await reconnectFailure(port, name)] as const,
			),
		),
	)
	const after = await port.status()
	const secrets = storedValues(env)
	return notConnected(after, unconnected).map((name) => {
		const reason =
			after.find((held) => held.name === name)?.error ?? thrown.get(name)
		return leftOut(
			name,
			`${TWO_ATTEMPTS}, ${readable(reason ?? NO_REASON, secrets)}`,
		)
	})
}

export const unconnectedServers = async (
	pass: ConnectPass,
): Promise<string[]> => {
	if (pass.names.length === 0) {
		return []
	}
	try {
		const reported = await withinDeadline(reportPass(pass), PASS_LIMIT)
		return reported === OUTLASTED ? [] : reported
	} catch {
		return []
	}
}

export const sectionPrefixer = (details: string[]) => {
	let pending = details.length > 0
	return (text: string) => {
		if (!pending) {
			return text
		}
		pending = false
		return `${unavailableServersSection(details)}\n\n${text}`
	}
}
