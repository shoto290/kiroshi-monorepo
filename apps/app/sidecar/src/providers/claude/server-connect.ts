import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk"

import { leftOut } from "./server-env"

import type { ServerEnv } from "../provider"
import { describeError } from "../../describe-error"

export type ServerStatus = Pick<McpServerStatus, "name" | "status">

export type ConnectPort = {
	status: () => Promise<ServerStatus[]>
	reconnect: (name: string) => Promise<void>
}

export type ConnectPass = {
	names: string[]
	port: ConnectPort
	env?: ServerEnv
	signal?: AbortSignal
	wait?: (ms: number) => Promise<void>
}

type PassOutcome = {
	reported: string[]
	missing: string[]
}

export const CONNECT_BUDGET_MS = 15_000

const PENDING_POLL = 250
const PENDING_POLLS = Math.ceil(CONNECT_BUDGET_MS / PENDING_POLL) + 1
const PENDING_WAIT = PENDING_POLLS * PENDING_POLL
const RECONNECT_LIMIT = CONNECT_BUDGET_MS
const PASS_LIMIT = PENDING_WAIT + RECONNECT_LIMIT
const REASON_LIMIT = 300
const SECRET_FLOOR = 8
const REDACTED = "[redacted]"
const NO_READ = "no status read ever named it"
const TWO_ATTEMPTS = "two connection attempts failed"
const AWAITING_AUTH = "it is waiting for you to authorize it"
const GAVE_UP = "the connection pass gave up on"
const REPORTABLE = ["pending", "failed", "needs-auth"]

const OUTLASTED = Symbol("outlasted")

export const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		if (signal?.aborted) {
			resolve()
			return
		}
		const settle = () => {
			clearTimeout(timer)
			signal?.removeEventListener("abort", settle)
			resolve()
		}
		const timer = setTimeout(settle, ms)
		signal?.addEventListener("abort", settle)
	})

const withinDeadline = async <T>(
	work: Promise<T>,
	ms: number,
	signal?: AbortSignal,
): Promise<T | typeof OUTLASTED> => {
	let timer: ReturnType<typeof setTimeout> | undefined
	const bound = new Promise<typeof OUTLASTED>((resolve) => {
		timer = setTimeout(() => resolve(OUTLASTED), ms)
		signal?.addEventListener("abort", () => resolve(OUTLASTED), { once: true })
	})
	try {
		return await Promise.race([work, bound])
	} finally {
		clearTimeout(timer)
	}
}

const lastRead = (
	reads: ServerStatus[],
	name: string,
): ServerStatus | undefined => reads.findLast((read) => read.name === name)

const unsettled = (reads: ServerStatus[], names: string[]): boolean =>
	names.some((name) => {
		const read = lastRead(reads, name)
		return !read || read.status === "pending"
	})

const settledStatuses = async (
	port: ConnectPort,
	names: string[],
	wait: (ms: number) => Promise<void>,
	signal?: AbortSignal,
): Promise<ServerStatus[]> => {
	let statuses = await port.status()
	for (
		let poll = 0;
		poll < PENDING_POLLS && unsettled(statuses, names) && !signal?.aborted;
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
	signal?: AbortSignal,
): Promise<string | undefined> => {
	const thrown = await withinDeadline(
		port.reconnect(name).then(
			() => undefined,
			(error: unknown) => describeError(error),
		),
		RECONNECT_LIMIT,
		signal,
	)
	return thrown === OUTLASTED
		? `the reconnection outlasted its ${RECONNECT_LIMIT} ms deadline`
		: thrown
}

const reconnectFailures = async (
	port: ConnectPort,
	names: string[],
	signal?: AbortSignal,
): Promise<Map<string, string | undefined>> =>
	new Map(
		await Promise.all(
			names.map(
				async (name) =>
					[name, await reconnectFailure(port, name, signal)] as const,
			),
		),
	)

const storedValues = ({ base, perServer }: ServerEnv): string[] =>
	[
		...Object.values(base ?? {}),
		...Object.values(perServer ?? {}).flatMap((scope) => Object.values(scope)),
	].filter((value) => value.length >= SECRET_FLOOR)

const readable = (reason: string, secrets: string[]): string =>
	secrets
		.reduce((held, secret) => held.split(secret).join(REDACTED), reason)
		.slice(0, REASON_LIMIT)

const statusReason = (status: ServerStatus["status"]): string =>
	status === "pending"
		? `it read pending after the ${PENDING_WAIT} ms it was given`
		: `it read ${status}`

const lineFor = (
	name: string,
	read: ServerStatus,
	thrown: string | undefined,
	secrets: string[],
): string => {
	if (read.status === "needs-auth") {
		return leftOut(name, AWAITING_AUTH)
	}
	const answered = thrown
		? `, and the reconnection answered: ${readable(thrown, secrets)}`
		: ""
	return leftOut(
		name,
		`${TWO_ATTEMPTS}, ${statusReason(read.status)}${answered}`,
	)
}

const reportPass = async (
	{
		names,
		port,
		signal,
		wait = (ms: number) => delay(ms, signal),
	}: ConnectPass,
	secrets: string[],
): Promise<PassOutcome> => {
	const settled = await settledStatuses(port, names, wait, signal)
	const failing = names.filter((name) => {
		const status = lastRead(settled, name)?.status
		return status === "failed" || status === "pending"
	})
	const thrown = await reconnectFailures(port, failing, signal)
	const after = failing.length ? await port.status() : []
	const reads = [...settled, ...after]
	const outcome: PassOutcome = { reported: [], missing: [] }
	for (const name of names) {
		const read = lastRead(reads, name)
		if (!read) {
			outcome.missing.push(name)
		} else if (REPORTABLE.includes(read.status)) {
			outcome.reported.push(lineFor(name, read, thrown.get(name), secrets))
		}
	}
	return outcome
}

const gaveUp = (names: string[], cause: string, secrets: string[]) => {
	process.stderr.write(
		`${GAVE_UP} ${names.join(", ")}: ${readable(cause, secrets)}\n`,
	)
}

export const unconnectedServers = async ({
	env = {},
	...pass
}: ConnectPass): Promise<string[]> => {
	const { names, signal } = pass
	if (names.length === 0) {
		return []
	}
	const secrets = storedValues(env)
	try {
		const outcome = await withinDeadline(
			reportPass(pass, secrets),
			PASS_LIMIT,
			signal,
		)
		if (signal?.aborted) {
			return []
		}
		if (outcome === OUTLASTED) {
			gaveUp(names, `it outlasted ${PASS_LIMIT} ms`, secrets)
			return []
		}
		if (outcome.missing.length) {
			gaveUp(outcome.missing, NO_READ, secrets)
		}
		return outcome.reported
	} catch (error) {
		if (signal?.aborted) {
			return []
		}
		gaveUp(names, describeError(error), secrets)
		return []
	}
}
