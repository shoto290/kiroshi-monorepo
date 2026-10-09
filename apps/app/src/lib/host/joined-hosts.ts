import type { InvokeArgs, InvokeOptions } from "@tauri-apps/api/core"
import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event"

import { createHttpHost, type HostSocket, type HttpHost } from "./http"

import {
	type commands,
	INVITATION_CHANGED_EVENT,
	JOINED_SPACE_REMOVED_EVENT,
	type JoinedSpaceConnection,
	type JoinedSpaceError,
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
	"joined_space_connect",
	"joined_space_remove",
	"user_preferences",
	"user_set_preferences",
	"user_set_profile_picture",
	"window_declare_maximize_button",
	"hosting_state",
	"hosting_start",
	"hosting_stop",
	"notification_show",
	"companion_launch_outcome",
	"account_state",
	"account_sign_in",
	"account_sign_out",
	"invitations_list",
	"invitation_accept",
	"invitation_decline",
])

export const JOINED_SPACE_CHANGED_EVENT = "joined-space://changed"

const LOCAL_EVENTS: ReadonlySet<string> = new Set([
	"host://presence",
	"hosting://changed",
	JOINED_SPACE_CHANGED_EVENT,
	JOINED_SPACE_REMOVED_EVENT,
	INVITATION_CHANGED_EVENT,
	"window-maximize-button",
	"notification://activated",
	"user://first-run-done",
	"companion://created",
	"companion://seed-refused",
	"account://changed",
])

const TAURI_PLUGIN_PREFIX = "plugin:"

export type JoinedHostState =
	| { status: "connecting" }
	| { status: "up" }
	| { status: "down" }
	| { status: "refused"; failure: string }

export type JoinedHostsState = {
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
	reportHostDown: () => string
	endHostDown: (noticeId: string) => void
}

type Route = (event: string) => Listen

type Subscription = {
	event: string
	handler: EventCallback<unknown>
	route: Route
	source: Listen
	unlisten: UnlistenFn
}

const unheard: Listen = async () => () => undefined

const isLocalCommand = (command: string): boolean =>
	command.startsWith(TAURI_PLUGIN_PREFIX) || LOCAL_COMMANDS.has(command)

export const describeJoinError = (error: JoinedSpaceError): string =>
	"detail" in error ? error.detail : error.kind

const describeRejection = (reason: unknown): string =>
	reason instanceof Error ? reason.message : String(reason)

export const createJoinedHosts = ({
	local,
	join,
	fetch,
	openSocket,
	reportFailure,
	reportHostDown,
	endHostDown,
}: JoinedHostsOptions) => {
	const store = createStore<JoinedHostsState>({ active: null, connections: {} })
	const hosts = new Map<string, HttpHost>()
	const sharedSpaceIds = new Map<string, string>()
	const pendingJoins = new Map<string, Promise<HttpHost | null>>()
	const subscriptions = new Set<Subscription>()
	const downNotices = new Map<string, string>()
	const reconnectionListeners = new Set<() => void>()
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

	const isDown = (id: string) =>
		store.getState().connections[id]?.status === "down"

	const reportIfActiveDown = (id: string) => {
		if (store.getState().active === id && isDown(id) && !downNotices.has(id)) {
			downNotices.set(id, reportHostDown())
		}
	}

	const endDownNotice = (id: string) => {
		const noticeId = downNotices.get(id)
		if (noticeId) {
			endHostDown(noticeId)
			downNotices.delete(id)
		}
	}

	const announceReconnection = () => {
		for (const listener of [...reconnectionListeners]) {
			listener()
		}
	}

	const markUp = (id: string) => {
		const isReconnection = isDown(id) && store.getState().active === id
		record(id, { status: "up" })
		endDownNotice(id)
		if (isReconnection) {
			announceReconnection()
		}
	}

	const onReconnected = (listener: () => void) => {
		reconnectionListeners.add(listener)
		return () => {
			reconnectionListeners.delete(listener)
		}
	}

	const openHost = (
		id: string,
		{ hostUrl, token, remoteSpaceId }: JoinedSpaceConnection,
	) => {
		const host = createHttpHost({
			host: hostUrl,
			token,
			fetch,
			openSocket,
			onUp: () => markUp(id),
			onDown: () => {
				record(id, { status: "down" })
				reportIfActiveDown(id)
			},
			onRefused: reportFailure,
		})
		hosts.set(id, host)
		sharedSpaceIds.set(id, remoteSpaceId ?? id)
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

	const activeSpaceId = (): string | null => {
		const { active } = store.getState()
		return active ? (sharedSpaceIds.get(active) ?? null) : null
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
		const source = subscription.route(subscription.event)
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
		const previous = store.getState().active
		if (previous === active) {
			return
		}
		if (previous) {
			endDownNotice(previous)
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
			reportIfActiveDown(id)
		}
	}

	const forget = (id: string) => {
		hosts.get(id)?.close()
		hosts.delete(id)
		sharedSpaceIds.delete(id)
		endDownNotice(id)
		const { [id]: _forgotten, ...connections } = store.getState().connections
		store.setState({ ...store.getState(), connections })
		if (requested === id) {
			void activate(null)
		}
	}

	const invoke: Invoke = (...call) => {
		const [command, args] = call
		const joined = isLocalCommand(command) ? undefined : activeHost()
		return joined ? joined.invoke(command, args) : local.invoke(...call)
	}

	const routedListen =
		(route: Route): Listen =>
		async (event, handler) => {
			const source = route(event)
			const subscription: Subscription = {
				event,
				handler: handler as EventCallback<unknown>,
				route,
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

	const listen = routedListen(listenerFor)

	const listenToActiveHost = routedListen(() => activeHost()?.listen ?? unheard)

	const fileSrc = (path: string): string =>
		(activeHost() ?? local).fileSrc(path)

	return {
		getState: store.getState,
		subscribe: store.subscribe,
		connect: async (id: string) => {
			await openConnection(id)
		},
		activate,
		forget,
		invoke,
		activeSpaceId,
		listen,
		listenToActiveHost,
		onReconnected,
		fileSrc,
	}
}

export type JoinedHosts = ReturnType<typeof createJoinedHosts>
