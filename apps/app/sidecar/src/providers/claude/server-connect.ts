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
	wait?: (ms: number) => Promise<void>
}

export const CONNECT_BUDGET_MS = 15_000

const PENDING_POLL = 250
const PENDING_POLLS = Math.ceil(CONNECT_BUDGET_MS / PENDING_POLL)
const PENDING_WAIT = PENDING_POLLS * PENDING_POLL
const RECONNECT_LIMIT = 20_000
const PASS_LIMIT = PENDING_WAIT * 2 + RECONNECT_LIMIT
const REASON_LIMIT = 300
const REDACTED = "[redacted]"
const NO_REASON = "no reason given"
const TWO_ATTEMPTS = "two connection attempts failed"
const AWAITING_AUTH = "it is waiting for you to authorize it"
const GAVE_UP = "the connection pass gave up on"

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

const awaitingAuth = (statuses: ServerStatus[], names: string[]): string[] =>
	statuses
		.filter(
			({ name, status }) => names.includes(name) && status === "needs-auth",
		)
		.map(({ name }) => name)

const settledStatuses = async (
	port: ConnectPort,
	names: string[],
	wait: (ms: number) => Promise<void>,
): Promise<ServerStatus[]> => {
	let statuses = await port.status()
	for (
		let poll = 0;
		poll < PENDING_POLLS && stillPending(statuses, names);
		poll += 1
	) {
		await wait(PENDING_POLL)
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

const reconnectFailures = async (
	port: ConnectPort,
	names: string[],
): Promise<Map<string, string | undefined>> =>
	new Map(
		await Promise.all(
			names.map(
				async (name) => [name, await reconnectFailure(port, name)] as const,
			),
		),
	)

const lineFor = (
	name: string,
	read: ServerStatus | undefined,
	thrown: string | undefined,
	secrets: string[],
): string =>
	read?.status === "needs-auth"
		? leftOut(name, AWAITING_AUTH)
		: leftOut(
				name,
				`${TWO_ATTEMPTS}, ${readable(read?.error ?? thrown ?? NO_REASON, secrets)}`,
			)

const reportPass = async ({
	names,
	port,
	env = {},
	wait = delay,
}: ConnectPass): Promise<string[]> => {
	const settled = await settledStatuses(port, names, wait)
	const awaiting = awaitingAuth(settled, names)
	const failing = notConnected(settled, names).filter(
		(name) => !awaiting.includes(name),
	)
	const thrown = await reconnectFailures(port, failing)
	const after = failing.length ? await settledStatuses(port, failing, wait) : []
	const reported = new Set([...awaiting, ...notConnected(after, failing)])
	const secrets = storedValues(env)
	const reads = [...settled, ...after]
	return names
		.filter((name) => reported.has(name))
		.map((name) =>
			lineFor(
				name,
				reads.findLast((read) => read.name === name),
				thrown.get(name),
				secrets,
			),
		)
}

const gaveUp = ({ names, env = {} }: ConnectPass, cause: string) => {
	process.stderr.write(
		`${GAVE_UP} ${names.join(", ")}: ${readable(cause, storedValues(env))}\n`,
	)
}

export const unconnectedServers = async (
	pass: ConnectPass,
): Promise<string[]> => {
	if (pass.names.length === 0) {
		return []
	}
	try {
		const reported = await withinDeadline(reportPass(pass), PASS_LIMIT)
		if (reported !== OUTLASTED) {
			return reported
		}
		gaveUp(pass, `it outlasted ${PASS_LIMIT} ms`)
	} catch (error) {
		gaveUp(pass, describeError(error))
	}
	return []
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
