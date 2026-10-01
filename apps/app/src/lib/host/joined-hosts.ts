import type { InvokeArgs, InvokeOptions } from "@tauri-apps/api/core"
import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event"

import { createHttpHost, type HostSocket, type HttpHost } from "./http"

import type {
	commands,
	JoinedSpaceConnection,
	JoinedSpaceError,
} from "../bindings"
import { createStore } from "../store"

export const LOCAL_COMMANDS: ReadonlySet<string> = new Set([
	"space_list",
	"space_create",
	"space_update",
	"space_reorder",
	"space_delete",
	"space_export",
	"space_import",
	"joined_spaces_list",
	"joined_space_add",
	"joined_space_connect",
	"joined_space_remove",
	"user_preferences",
	"user_set_preferences",
	"user_set_profile_picture",
	"window_declare_maximize_button",
	"host_share_link",
	"notification_show",
	"companion_launch_outcome",
])

const LOCAL_EVENTS: ReadonlySet<string> = new Set([
	"host://presence",
	"window-maximize-button",
	"notification://activated",
	"user://first-run-done",
	"companion://created",
	"companion://seed-refused",
])

const TAURI_PLUGIN_PREFIX = "plugin:"

type JoinedHostState =
	| { status: "connecting" }
	| { status: "up" }
	| { status: "down" }
	| { status: "refused"; failure: string }

type JoinedHostsState = {
	active: string | null
	connections: Record<string, JoinedHostState>
}

type Invoke = <T>(
	command: string,
	args?: InvokeArgs,
	options?: InvokeOptions,
) => Promise<T>

type Listen = HttpHost["listen"]

type LocalHost = {
	invoke: Invoke
	listen: Listen
	fileSrc: (path: string) => string
}

type JoinOutcome = Awaited<ReturnType<typeof commands.joinedSpaceConnect>>

export type JoinedHostsOptions = {
	local: LocalHost
	join: (id: string) => Promise<JoinOutcome>
	fetch: typeof fetch
	openSocket: (url: string) => HostSocket
	reportFailure: (message: string, status?: number) => void
}

type Subscription = {
	event: string
	handler: EventCallback<unknown>
	source: Listen
	unlisten: UnlistenFn
}

const isLocalCommand = (command: string): boolean =>
	command.startsWith(TAURI_PLUGIN_PREFIX) || LOCAL_COMMANDS.has(command)

const describeJoinError = (error: JoinedSpaceError): string => {
	if ("message" in error) {
		return error.message
	}
	return "detail" in error ? error.detail : error.kind
}

const describeRejection = (reason: unknown): string =>
	reason instanceof Error ? reason.message : String(reason)

export const createJoinedHosts = ({
	local,
	join,
	fetch,
	openSocket,
	reportFailure,
}: JoinedHostsOptions) => {
	const store = createStore<JoinedHostsState>({ active: null, connections: {} })
	const hosts = new Map<string, HttpHost>()
	const pendingJoins = new Map<string, Promise<HttpHost | null>>()
	const subscriptions = new Set<Subscription>()
	let requested: string | null = null

	const record = (id: string, state: JoinedHostState) => {
		const current = store.getState()
		store.setState({
			...current,
			connections: { ...current.connections, [id]: state },
		})
	}

	const refuse = (id: string, failure: string): null => {
		record(id, { status: "refused", failure })
		reportFailure(failure)
		return null
	}

	const openHost = (id: string, { hostUrl, token }: JoinedSpaceConnection) => {
		const host = createHttpHost({
			host: hostUrl,
			token,
			fetch,
			openSocket,
			onUp: () => record(id, { status: "up" }),
			onDown: () => record(id, { status: "down" }),
			onRefused: reportFailure,
		})
		hosts.set(id, host)
		host.openEvents()
		return host
	}

	const settleJoin = (id: string, outcome: JoinOutcome) =>
		outcome.status === "ok"
			? openHost(id, outcome.data)
			: refuse(id, describeJoinError(outcome.error))

	const startJoin = async (id: string): Promise<HttpHost | null> => {
		record(id, { status: "connecting" })
		try {
			return settleJoin(id, await join(id))
		} catch (reason) {
			return refuse(id, describeRejection(reason))
		} finally {
			pendingJoins.delete(id)
		}
	}

	const openConnection = (id: string): Promise<HttpHost | null> => {
		const opened = hosts.get(id)
		if (opened) {
			return Promise.resolve(opened)
		}
		const pending = pendingJoins.get(id) ?? startJoin(id)
		pendingJoins.set(id, pending)
		return pending
	}

	const activeHost = (): HttpHost | undefined => {
		const { active } = store.getState()
		return active ? hosts.get(active) : undefined
	}

	const listenerFor = (event: string): Listen => {
		const joined = LOCAL_EVENTS.has(event) ? undefined : activeHost()
		return joined ? joined.listen : local.listen
	}

	const reportListenFailure = (reason: unknown): UnlistenFn => {
		reportFailure(describeRejection(reason))
		return () => undefined
	}

	const relocate = (subscription: Subscription) => {
		const source = listenerFor(subscription.event)
		if (source === subscription.source) {
			return
		}
		subscription.unlisten()
		subscription.source = source
		const attached = source(subscription.event, subscription.handler).catch(
			reportListenFailure,
		)
		subscription.unlisten = () => {
			attached.then((unlisten) => unlisten())
		}
		attached.then((unlisten) => {
			if (subscription.source === source && subscriptions.has(subscription)) {
				subscription.unlisten = unlisten
			}
		})
	}

	const setActive = (active: string | null) => {
		if (store.getState().active === active) {
			return
		}
		store.setState({ ...store.getState(), active })
		for (const subscription of subscriptions) {
			relocate(subscription)
		}
	}

	const activate = async (id: string | null): Promise<void> => {
		requested = id
		if (id === null) {
			setActive(null)
			return
		}
		const host = await openConnection(id)
		if (host && requested === id) {
			setActive(id)
		}
	}

	const invoke: Invoke = (...call) => {
		const [command, args] = call
		const joined = isLocalCommand(command) ? undefined : activeHost()
		return joined ? joined.invoke(command, args) : local.invoke(...call)
	}

	const listen: Listen = async (event, handler) => {
		const source = listenerFor(event)
		const subscription: Subscription = {
			event,
			handler: handler as EventCallback<unknown>,
			source,
			unlisten: await source(event, handler),
		}
		subscriptions.add(subscription)
		relocate(subscription)
		return () => {
			subscriptions.delete(subscription)
			subscription.unlisten()
		}
	}

	const fileSrc = (path: string): string =>
		(activeHost() ?? local).fileSrc(path)

	return {
		getState: store.getState,
		subscribe: store.subscribe,
		connect: async (id: string) => {
			await openConnection(id)
		},
		activate,
		invoke,
		listen,
		fileSrc,
	}
}
