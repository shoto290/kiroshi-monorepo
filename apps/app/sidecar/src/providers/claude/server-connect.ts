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
	now?: () => number
	bound?: number
}

type Take = {
	statuses: ServerStatus[]
	spent: number
}

type NamedRead = {
	status: ServerStatus["status"]
	spent: number
}

type GaveUp = {
	names: string[]
	cause: string
}

type PassOutcome = {
	reported: string[]
	giveUps: GaveUp[]
}

type PolledTakes = {
	takes: Take[]
	giveUp?: GaveUp
}

const REQUEST_BOUND_MS = 30_000

export const POLL_BUDGET_MS = 5_000

export const UNNAMED_GRACE_MS = 1_000

const PENDING_POLL = 250
const REASON_LIMIT = 300
const SECRET_FLOOR = 8
const REDACTED = "[redacted]"
const NO_READ = "no status read ever named it"
const AWAITING_AUTH = "it is waiting for you to authorize it"
export const STILL_CONNECTING = "is still connecting"
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

const readIn = (take: Take, name: string): ServerStatus | undefined =>
	take.statuses.find((status) => status.name === name)

const reversed = (takes: Take[]): Take[] => [...takes].reverse()

const namedRead = (takes: Take[], name: string): NamedRead | undefined =>
	reversed(takes)
		.flatMap((take) => {
			const read = readIn(take, name)
			return read ? [{ status: read.status, spent: take.spent }] : []
		})
		.at(0)

const unsettled = (takes: Take[], names: string[], spent: number): boolean =>
	names.some((name) => {
		const named = namedRead(takes, name)
		return named ? named.status === "pending" : spent < UNNAMED_GRACE_MS
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

const unreadable = (
	takes: Take[],
	names: string[],
	error: unknown,
): GaveUp | undefined => {
	const unread = names.filter((name) => !namedRead(takes, name))
	return unread.length
		? { names: unread, cause: describeError(error) }
		: undefined
}

const polledTakes = async (
	read: () => Promise<ServerStatus[]>,
	names: string[],
	wait: (ms: number) => Promise<void>,
	spent: () => number,
	signal?: AbortSignal,
): Promise<PolledTakes> => {
	const takes: Take[] = [{ statuses: await read(), spent: spent() }]
	while (
		unsettled(takes, names, spent()) &&
		spent() + PENDING_POLL < POLL_BUDGET_MS &&
		!signal?.aborted
	) {
		await wait(PENDING_POLL)
		try {
			takes.push({ statuses: await read(), spent: spent() })
		} catch (error) {
			return { takes, giveUp: unreadable(takes, names, error) }
		}
	}
	return { takes }
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

const lineFor = (
	name: string,
	{ status, spent }: NamedRead,
	thrown: string | undefined,
	secrets: string[],
): string => {
	if (status === "needs-auth") {
		return leftOut(name, AWAITING_AUTH)
	}
	const answered = thrown
		? `, and the reconnection answered: ${readable(thrown, secrets)}`
		: ""
	return status === "pending"
		? `the server "${name}" ${STILL_CONNECTING} after ${spent} ms${answered}`
		: leftOut(name, `it read ${status}${answered}`)
}

const linesFor = (
	takes: Take[],
	names: string[],
	thrown: Map<string, string | undefined>,
	secrets: string[],
): { reported: string[]; unread: string[] } => {
	const reported: string[] = []
	const unread: string[] = []
	for (const name of names) {
		const named = namedRead(takes, name)
		if (!named) {
			unread.push(name)
		} else if (REPORTABLE.includes(named.status)) {
			reported.push(lineFor(name, named, thrown.get(name), secrets))
		}
	}
	return { reported, unread }
}

const reportPass = async (
	{
		names,
		port,
		signal,
		bound = REQUEST_BOUND_MS,
		now = Date.now,
		wait = (ms: number) => delay(ms, signal),
	}: ConnectPass,
	secrets: string[],
): Promise<PassOutcome> => {
	const started = now()
	const spent = () => now() - started
	const read = (ms: number) => boundedRead(port, ms, signal)
	const pollBound = () => Math.max(Math.min(bound, POLL_BUDGET_MS - spent()), 1)
	const polling = () => read(pollBound())
	const { takes, giveUp } = await polledTakes(
		polling,
		names,
		wait,
		spent,
		signal,
	)
	const giveUps = giveUp ? [giveUp] : []
	const failing = names.filter(
		(name) => namedRead(takes, name)?.status === "failed",
	)
	const thrown = await reconnectFailures(port, failing, bound, signal)
	if (failing.length) {
		try {
			takes.push({ statuses: await read(bound), spent: spent() })
		} catch (error) {
			giveUps.push({ names: failing, cause: describeError(error) })
		}
	}
	const { reported, unread } = linesFor(takes, names, thrown, secrets)
	const missing = unread.filter(
		(name) => !giveUps.some((gone) => gone.names.includes(name)),
	)
	if (missing.length) {
		giveUps.push({ names: missing, cause: NO_READ })
	}
	return { reported, giveUps }
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
		for (const { names: abandoned, cause } of outcome.giveUps) {
			gaveUp(abandoned, cause, secrets)
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
