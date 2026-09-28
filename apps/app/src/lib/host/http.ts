import type { InvokeArgs } from "@tauri-apps/api/core"
import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event"

import type { HostConnection } from "./connection"

export type HostSocket = Pick<
	WebSocket,
	"onclose" | "onmessage" | "onopen" | "close"
>

export type HttpHostOptions = HostConnection & {
	fetch: typeof fetch
	openSocket: (url: string) => HostSocket
	onDown: () => void
	onUp: () => void
}

export type HttpHost = {
	invoke: <T>(command: string, args?: InvokeArgs) => Promise<T>
	listen: <T>(event: string, handler: EventCallback<T>) => Promise<UnlistenFn>
	fileSrc: (path: string) => string
}

type Frame = {
	event: string
	payload: unknown
}

const FIRST_RECONNECT_DELAY = 500

const LONGEST_RECONNECT_DELAY = 30_000

const BYTES = "application/octet-stream"

const JSON_TYPE = "application/json"

const AVATARS_DIR = "avatars"

const ATTACHMENTS_DIR = "attachments"

const reconnectDelay = (attempt: number): number =>
	Math.min(FIRST_RECONNECT_DELAY * 2 ** attempt, LONGEST_RECONNECT_DELAY)

const encodeArgument = (_key: string, value: unknown): unknown =>
	value instanceof Uint8Array ? Array.from(value) : value

const parsedJson = (text: string): unknown =>
	text === "" ? undefined : JSON.parse(text)

const carries = (response: Response, type: string): boolean =>
	response.headers.get("content-type")?.startsWith(type) ?? false

const answerOf = (response: Response): Promise<unknown> =>
	carries(response, BYTES)
		? response.arrayBuffer()
		: response.text().then(parsedJson)

const refusalOf = async (response: Response): Promise<unknown> => {
	const text = await response.text()
	return carries(response, JSON_TYPE) ? parsedJson(text) : text
}

const isFrame = (value: unknown): value is Frame =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Frame).event === "string"

const segmentsOf = (path: string): string[] => path.split(/[\\/]/)

const fileRouteOf = (path: string): string[] | null => {
	const segments = segmentsOf(path)
	const [dir, file] = segments.slice(-2)
	if (dir === AVATARS_DIR && file) {
		return [AVATARS_DIR, file]
	}
	const [store, conversationId] = segments.slice(-3)
	if (store === ATTACHMENTS_DIR && conversationId && file) {
		return [ATTACHMENTS_DIR, conversationId, file]
	}
	return null
}

const eventsUrlOf = ({ host, token }: HostConnection): string => {
	const url = new URL("/api/events", host)
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
	url.searchParams.set("token", token)
	return url.href
}

export const createHttpHost = ({
	host,
	token,
	fetch,
	openSocket,
	onDown,
	onUp,
}: HttpHostOptions): HttpHost => {
	const listeners = new Map<string, Set<EventCallback<unknown>>>()
	let socket: HostSocket | null = null
	let failedAttempts = 0
	let isDown = false

	const invoke = async <T>(command: string, args: InvokeArgs = {}) => {
		const response = await fetch(
			new URL(`/api/invoke/${encodeURIComponent(command)}`, host),
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${token}`,
					"content-type": JSON_TYPE,
				},
				body: JSON.stringify(args, encodeArgument),
			},
		)
		if (!response.ok) {
			throw await refusalOf(response)
		}
		return (await answerOf(response)) as T
	}

	const deliver = (data: unknown) => {
		const frame: unknown = JSON.parse(String(data))
		if (!isFrame(frame)) {
			console.error("the host sent an event frame with no event name", frame)
			return
		}
		for (const handler of [...(listeners.get(frame.event) ?? [])]) {
			handler({ event: frame.event, id: 0, payload: frame.payload })
		}
	}

	const markUp = () => {
		failedAttempts = 0
		if (isDown) {
			isDown = false
			onUp()
		}
	}

	const markDown = () => {
		if (!isDown) {
			isDown = true
			onDown()
		}
	}

	const connect = () => {
		const opened = openSocket(eventsUrlOf({ host, token }))
		opened.onopen = markUp
		opened.onmessage = (message) => deliver(message.data)
		opened.onclose = () => {
			markDown()
			setTimeout(connect, reconnectDelay(failedAttempts))
			failedAttempts += 1
		}
		socket = opened
	}

	const listen = <T>(event: string, handler: EventCallback<T>) => {
		if (!socket) {
			connect()
		}
		const heard = listeners.get(event) ?? new Set()
		const listener = handler as EventCallback<unknown>
		heard.add(listener)
		listeners.set(event, heard)
		const unlisten = () => {
			heard.delete(listener)
			if (heard.size === 0 && listeners.get(event) === heard) {
				listeners.delete(event)
			}
		}
		return Promise.resolve(unlisten)
	}

	const fileSrc = (path: string): string => {
		const route = fileRouteOf(path)
		if (!route) {
			return path
		}
		const url = new URL(
			`/api/files/${route.map(encodeURIComponent).join("/")}`,
			host,
		)
		url.searchParams.set("token", token)
		return url.href
	}

	return { invoke, listen, fileSrc }
}
