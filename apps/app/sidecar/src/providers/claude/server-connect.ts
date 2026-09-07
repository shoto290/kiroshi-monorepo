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
	bound?: number
}

type PassOutcome = {
	reported: string[]
	missing: string[]
}

type SettledReads = {
	statuses: ServerStatus[]
	waited: number
}

export const CONNECT_BUDGET_MS = 15_000

export const UNNAMED_GRACE_MS = 1_000

const PENDING_POLL = 250
const PENDING_POLLS = Math.ceil(CONNECT_BUDGET_MS / PENDING_POLL) + 1
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
	let unwatch = () => {}
	const bound = new Promise<typeof OUTLASTED>((resolve) => {
		if (signal?.aborted) {
			resolve(OUTLASTED)
			return
		}
		const abandon = () => resolve(OUTLASTED)
		timer = setTimeout(abandon, ms)
		signal?.addEventListener("abort", abandon, { once: true })
		unwatch = () => signal?.removeEventListener("abort", abandon)
	})
	try {
		return await Promise.race([work, bound])
	} finally {
		clearTimeout(timer)
		unwatch()
	}
}

const lastRead = (
	reads: ServerStatus[],
	name: string,
): ServerStatus | undefined => reads.findLast((read) => read.name === name)

const unsettled = (
	reads: ServerStatus[],
	names: string[],
	waited: number,
): boolean =>
	names.some((name) => {
		const read = lastRead(reads, name)
		return read ? read.status === "pending" : waited < UNNAMED_GRACE_MS
	})

const boundedRead = async (
	port: ConnectPort,
	bound: number,
	signal?: AbortSignal,
): Promise<ServerStatus[]> => {
	const statuses = await withinDeadline(port.status(), bound, signal)
	if (statuses === OUTLASTED) {
		throw new Error(`a status read outlasted its ${bound} ms bound`)
	}
	return statuses
}

const settledStatuses = async (
	read: () => Promise<ServerStatus[]>,
	names: string[],
	wait: (ms: number) => Promise<void>,
	signal?: AbortSignal,
): Promise<SettledReads> => {
	let statuses = await read()
	let waited = 0
	for (
		let poll = 0;
		poll < PENDING_POLLS &&
		unsettled(statuses, names, waited) &&
		!signal?.aborted;
		poll += 1
	) {
		await wait(PENDING_POLL)
		waited += PENDING_POLL
		statuses = await read()
	}
	return { statuses, waited }
}

const reconnectFailure = async (
	port: ConnectPort,
	name: string,
	bound: number,
	signal?: AbortSignal,
): Promise<string | undefined> => {
	const thrown = await withinDeadline(
		port.reconnect(name).then(
			() => undefined,
			(error: unknown) => describeError(error),
		),
		bound,
		signal,
	)
	return thrown === OUTLASTED
		? `the reconnection outlasted its ${bound} ms deadline`
		: thrown
}

const reconnectFailures = async (
	port: ConnectPort,
	names: string[],
	bound: number,
	signal?: AbortSignal,
): Promise<Map<string, string | undefined>> =>
	new Map(
		await Promise.all(
			names.map(
				async (name) =>
					[name, await reconnectFailure(port, name, bound, signal)] as const,
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

const statusReason = (
	status: ServerStatus["status"],
	waited: number,
): string =>
	status === "pending" && waited > 0
		? `it read pending after the ${waited} ms it was given`
		: `it read ${status}`

const lineFor = (
	name: string,
	read: ServerStatus,
	thrown: string | undefined,
	waited: number,
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
		`${TWO_ATTEMPTS}, ${statusReason(read.status, waited)}${answered}`,
	)
}

const reportPass = async (
	{
		names,
		port,
		signal,
		bound = CONNECT_BUDGET_MS,
		wait = (ms: number) => delay(ms, signal),
	}: ConnectPass,
	secrets: string[],
): Promise<PassOutcome> => {
	const read = () => boundedRead(port, bound, signal)
	const { statuses, waited } = await settledStatuses(read, names, wait, signal)
	const failing = names.filter((name) => {
		const status = lastRead(statuses, name)?.status
		return status === "failed" || status === "pending"
	})
	const thrown = await reconnectFailures(port, failing, bound, signal)
	const reads = [...statuses, ...(failing.length ? await read() : [])]
	const outcome: PassOutcome = { reported: [], missing: [] }
	for (const name of names) {
		const named = lastRead(reads, name)
		if (!named) {
			outcome.missing.push(name)
		} else if (REPORTABLE.includes(named.status)) {
			outcome.reported.push(
				lineFor(name, named, thrown.get(name), waited, secrets),
			)
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
		const outcome = await reportPass(pass, secrets)
		if (signal?.aborted) {
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
