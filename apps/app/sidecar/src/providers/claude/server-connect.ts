import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk"

import { AWAITING_AUTH, leftOut } from "./server-env"
import type { ServerLine, ServerState } from "./system-layer"

import type { ServerEnv } from "../provider"
import { describeError } from "../../describe-error"

export type ServerStatus = Pick<McpServerStatus, "name" | "status">

export type ReportedLine = ServerLine & {
	notice: boolean
}

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
	report?: (line: ReportedLine) => void
}

type Take = {
	statuses: ServerStatus[]
	spent: number
}

type Answer = {
	source: string
	message: string
}

type Redialled = {
	name: string
	answer?: Answer
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
	reported: ReportedLine[]
	giveUps: GaveUp[]
	connecting: string[]
	failing: string[]
}

type PolledTakes = {
	takes: Take[]
	giveUp?: GaveUp
}

const REQUEST_BOUND_MS = 30_000

export const POLL_BUDGET_MS = 5_000

export const WATCH_POLL_MS = 1_000

export const WATCH_BOUND_MS = 60_000

export const UNNAMED_GRACE_MS = 1_000

const PENDING_POLL = 250
const REASON_LIMIT = 300
const SECRET_FLOOR = 8
const REDACTED = "[redacted]"
const NO_READ = "no status read ever named it"
const DISABLED = "it is disabled in this session"
const STILL_CONNECTING = "is still connecting"
const HOLDS_TOOLS = "holds its tools"
const UNSETTLED = "it never settled while it was watched"
const UNREADABLE = "the status of this session's servers could not be read"
const RECONNECTION_SAID = "and the reconnection answered"
const READ_SAID = "and the status read that followed it answered"
const RECONNECTION_UNDER_WAY = "a reconnection is under way"
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

const storedValues = ({ base, perServer }: ServerEnv): string[] =>
	[
		...Object.values(base ?? {}),
		...Object.values(perServer ?? {}).flatMap((scope) => Object.values(scope)),
	].filter((value) => value.length >= SECRET_FLOOR)

const readable = (reason: string, secrets: string[]): string =>
	secrets
		.reduce((held, secret) => held.split(secret).join(REDACTED), reason)
		.slice(0, REASON_LIMIT)

const reachedLine = (name: string): string =>
	`the server "${name}" connected, and ${HOLDS_TOOLS} for the rest of this session`

const answered = (answer: Answer | undefined, secrets: string[]): string =>
	answer ? `, ${answer.source}: ${readable(answer.message, secrets)}` : ""

const dialling = (name: string): string =>
	`the server "${name}" read failed, and ${RECONNECTION_UNDER_WAY}`

const openingLine = (
	name: string,
	named: NamedRead,
	secrets: string[],
): ReportedLine => {
	if (named.status === "failed") {
		return news(dialling(name), "reconnecting")
	}
	if (named.status === "needs-auth") {
		return awaitingAuth(name)
	}
	const detail = lineFor(name, named, undefined, secrets)
	return named.status === "pending"
		? news(detail, "connecting")
		: notice(detail)
}

const lineFor = (
	name: string,
	{ status, spent }: NamedRead,
	answer: Answer | undefined,
	secrets: string[],
): string => {
	if (status === "pending") {
		return `the server "${name}" ${STILL_CONNECTING} after ${spent} ms`
	}
	return leftOut(name, `it read ${status}${answered(answer, secrets)}`)
}

const linesFor = (
	takes: Take[],
	names: string[],
	secrets: string[],
): { reported: ReportedLine[]; unread: string[] } => {
	const reported: ReportedLine[] = []
	const unread: string[] = []
	for (const name of names) {
		const named = namedRead(takes, name)
		if (!named) {
			unread.push(name)
		} else if (REPORTABLE.includes(named.status)) {
			reported.push(openingLine(name, named, secrets))
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
	const pollBound = () => Math.max(Math.min(bound, POLL_BUDGET_MS - spent()), 1)
	const polling = () => boundedRead(port, pollBound(), signal)
	const { takes, giveUp } = await polledTakes(
		polling,
		names,
		wait,
		spent,
		signal,
	)
	const giveUps = giveUp ? [giveUp] : []
	const { reported, unread } = linesFor(takes, names, secrets)
	const missing = unread.filter(
		(name) => !giveUps.some((gone) => gone.names.includes(name)),
	)
	if (missing.length) {
		giveUps.push({ names: missing, cause: NO_READ })
	}
	const settledAs = (status: ServerStatus["status"]) =>
		names.filter((name) => namedRead(takes, name)?.status === status)
	return {
		reported,
		giveUps,
		connecting: settledAs("pending"),
		failing: settledAs("failed"),
	}
}

const noteUnreadable = (cause: string, secrets: string[]) => {
	process.stderr.write(`${UNREADABLE}: ${readable(cause, secrets)}\n`)
}

const writeGiveUp = (names: string[], reason: string) => {
	process.stderr.write(`${GAVE_UP} ${names.join(", ")}: ${reason}\n`)
}

const gaveUp = (
	{ report }: ConnectPass,
	names: string[],
	cause: string,
	secrets: string[],
) => {
	const reason = readable(cause, secrets)
	writeGiveUp(names, reason)
	for (const name of names) {
		report?.(notice(leftOut(name, reason)))
	}
}

const notice = (detail: string): ReportedLine => ({
	detail,
	state: "left-out",
	notice: true,
})

const news = (detail: string, state: ServerState): ReportedLine => ({
	detail,
	state,
	notice: false,
})

const awaitingAuth = (name: string): ReportedLine => ({
	detail: leftOut(name, AWAITING_AUTH),
	state: "needs-auth",
	notice: true,
})

const SETTLED_LINE: Partial<
	Record<ServerStatus["status"], (name: string) => ReportedLine>
> = {
	connected: (name) => news(reachedLine(name), "holding"),
	disabled: (name) => notice(leftOut(name, DISABLED)),
	"needs-auth": awaitingAuth,
}

const readLine = (
	name: string,
	status: ServerStatus["status"],
	spent: number,
	answer: Answer | undefined,
	secrets: string[],
): ReportedLine => {
	const settled = SETTLED_LINE[status]
	if (settled) {
		return settled(name)
	}
	const line = lineFor(name, { status, spent }, answer, secrets)
	return status === "pending" ? news(line, "connecting") : notice(line)
}

const announce = async (
	{ port, signal, bound = REQUEST_BOUND_MS, report }: ConnectPass,
	name: string,
	status: ServerStatus["status"],
	spent: () => number,
	secrets: string[],
): Promise<Redialled | undefined> => {
	const settled = SETTLED_LINE[status]
	if (settled) {
		report?.(settled(name))
		return undefined
	}
	if (status !== "failed") {
		return undefined
	}
	const thrown = await reconnectFailure(port, name, bound, signal)
	if (signal?.aborted) {
		return undefined
	}
	const answer = thrown
		? { source: RECONNECTION_SAID, message: thrown }
		: undefined
	const dialled = (held: Answer | undefined) =>
		notice(lineFor(name, { status, spent: spent() }, held, secrets))
	let after: ServerStatus[]
	try {
		after = await boundedRead(port, bound, signal)
	} catch (error) {
		report?.(
			dialled(answer ?? { source: READ_SAID, message: describeError(error) }),
		)
		return undefined
	}
	if (signal?.aborted) {
		return undefined
	}
	const read = after.find((status) => status.name === name)?.status
	if (read === "pending") {
		return { name, ...(answer ? { answer } : {}) }
	}
	report?.(
		read ? readLine(name, read, spent(), answer, secrets) : dialled(answer),
	)
	return undefined
}

const takeSettled = (
	watched: string[],
	statuses: ServerStatus[],
): ServerStatus[] => {
	const settled = statuses.filter(
		({ name, status }) => watched.includes(name) && status !== "pending",
	)
	for (const { name } of settled) {
		watched.splice(watched.indexOf(name), 1)
	}
	return settled
}

const abandon = (
	{ report }: ConnectPass,
	watched: string[],
	redialled: Map<string, Answer | undefined>,
	secrets: string[],
) => {
	writeGiveUp(watched, UNSETTLED)
	for (const name of watched) {
		const reason = `${UNSETTLED}${answered(redialled.get(name), secrets)}`
		report?.(notice(leftOut(name, reason)))
	}
}

type Watch = {
	watched: string[]
	redialled: Map<string, Answer | undefined>
	dialling: Set<Promise<void>>
}

const closeWatch = async (
	pass: ConnectPass,
	{ watched, redialled, dialling }: Watch,
	secrets: string[],
) => {
	const unsettled = watched.splice(0)
	if (unsettled.length && !pass.signal?.aborted) {
		abandon(pass, unsettled, redialled, secrets)
	}
	await Promise.all(dialling)
	if (watched.length && !pass.signal?.aborted) {
		abandon(pass, watched, redialled, secrets)
	}
}

const watching = async (
	pass: ConnectPass,
	{ connecting, failing }: Pick<PassOutcome, "connecting" | "failing">,
	secrets: string[],
) => {
	const {
		port,
		signal,
		now = Date.now,
		bound = REQUEST_BOUND_MS,
		report,
		wait = (ms: number) => delay(ms, signal),
	} = pass
	const started = now()
	const spent = () => now() - started
	const watch: Watch = {
		watched: [...connecting],
		redialled: new Map(),
		dialling: new Set(),
	}
	const { watched, redialled, dialling } = watch

	const dial = (name: string, status: ServerStatus["status"]) => {
		const dialled = announce(pass, name, status, spent, secrets)
			.then((again) => {
				if (again) {
					redialled.set(again.name, again.answer)
					watched.push(again.name)
				}
			})
			.finally(() => dialling.delete(dialled))
		dialling.add(dialled)
	}

	for (const name of failing) {
		dial(name, "failed")
	}
	const until = now() + WATCH_BOUND_MS
	while (
		(watched.length || dialling.size) &&
		!signal?.aborted &&
		now() < until
	) {
		await wait(WATCH_POLL_MS)
		if (signal?.aborted) {
			await Promise.all(dialling)
			return
		}
		let statuses: ServerStatus[]
		try {
			statuses = await boundedRead(port, bound, signal)
		} catch (error) {
			noteUnreadable(describeError(error), secrets)
			continue
		}
		for (const { name, status } of takeSettled(watched, statuses)) {
			if (redialled.has(name)) {
				report?.(readLine(name, status, spent(), redialled.get(name), secrets))
				continue
			}
			dial(name, status)
		}
	}
	await closeWatch(pass, watch, secrets)
}

const unreadableStatus = (
	names: string[],
	cause: string,
	secrets: string[],
) => {
	writeGiveUp(names, readable(cause, secrets))
}

export const unconnectedServers = async ({
	env = {},
	...pass
}: ConnectPass): Promise<ReportedLine[]> => {
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
			gaveUp(pass, abandoned, cause, secrets)
		}
		const watched = [...outcome.connecting, ...outcome.failing]
		if (watched.length && pass.report) {
			void watching(pass, outcome, secrets).catch((thrown) => {
				gaveUp(pass, watched, describeError(thrown), secrets)
			})
		}
		return outcome.reported
	} catch (error) {
		if (signal?.aborted) {
			return []
		}
		unreadableStatus(names, describeError(error), secrets)
		return []
	}
}
