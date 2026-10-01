import type { JoinSpaceState } from "@workspace/ui/components/join-space-dialog"
import {
	type NoticeMessage,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import type { Space as SwitcherSpace } from "@workspace/ui/components/space"
import type { SpaceRemote } from "@workspace/ui/components/space-switcher"
import { i18n } from "@workspace/ui/lib/i18n"

import type { SpacesController } from "./spaces-controller"

import { commands, type JoinedSpace, type JoinedSpaceError } from "../bindings"
import { joinedHosts, listen } from "../host"
import { createStore } from "../store"
import type { Space } from "../conversations/store-contract"
import {
	describeJoinError,
	JOINED_SPACE_CHANGED_EVENT,
	type JoinedHostState,
	type JoinedHosts,
} from "../host/joined-hosts"

export type JoinedSpacesState = {
	joinedSpaces: JoinedSpace[]
	hasFailedToLoad: boolean
	isJoinOpen: boolean
	joinLink: string
	joinState: JoinSpaceState
	isLeaveOpen: boolean
	leavingId: string | null
}

export type JoinedSpacesController = {
	getState: () => JoinedSpacesState
	subscribe: (listener: () => void) => () => void
	watch: () => () => void
	selectSpace: (id: string) => void
	openJoin: () => void
	setJoinOpen: (isJoinOpen: boolean) => void
	changeJoinLink: (link: string) => void
	join: () => Promise<void>
	askToLeave: () => void
	setLeaveOpen: (isLeaveOpen: boolean) => void
	leave: () => Promise<void>
}

export type JoinedSpacesTransport = {
	list: () => Promise<JoinedSpace[]>
	add: (link: string) => Promise<JoinedSpace>
	remove: (id: string) => Promise<void>
	onChanged: (listener: () => void) => Promise<() => void>
}

type JoinedSpacesHosts = Pick<
	JoinedHosts,
	"getState" | "subscribe" | "connect" | "activate" | "forget"
>

type JoinedSpacesControllerOptions = {
	spaces: Pick<SpacesController, "getState" | "select">
	hosts?: JoinedSpacesHosts
	transport?: JoinedSpacesTransport
	reportFailure?: (notice: NoticeMessage) => void
	probeTimeout?: number
}

type CommandResult<T> =
	| { status: "ok"; data: T }
	| { status: "error"; error: JoinedSpaceError }

const PROBE_TIMEOUT = 10_000

const dataOf = <T>(result: CommandResult<T>): T => {
	if (result.status === "error") {
		throw result.error
	}
	return result.data
}

const joinedSpacesTransport: JoinedSpacesTransport = {
	list: async () => dataOf(await commands.joinedSpacesList()),
	add: async (link) => dataOf(await commands.joinedSpaceAdd(link, null)),
	remove: async (id) => {
		dataOf(await commands.joinedSpaceRemove(id))
	},
	onChanged: (listener) => listen(JOINED_SPACE_CHANGED_EVENT, () => listener()),
}

const isJoinedSpaceError = (reason: unknown): reason is JoinedSpaceError =>
	typeof reason === "object" && reason !== null && "kind" in reason

const isRefusedLink = (reason: unknown) =>
	isJoinedSpaceError(reason) && reason.kind === "refusedLink"

const describeRefusal = (reason: unknown): string => {
	if (isJoinedSpaceError(reason)) {
		return describeJoinError(reason)
	}
	return reason instanceof Error ? reason.message : String(reason)
}

const rowIdOf = (joined: JoinedSpace): string =>
	joined.remoteSpaceId ?? joined.id

const isUnreachable = (connection: JoinedHostState | undefined) =>
	connection?.status === "down" || connection?.status === "refused"

export const switcherSpacesOf = (
	spaces: Space[],
	joinedSpaces: JoinedSpace[],
): SwitcherSpace[] => [
	...spaces,
	...joinedSpaces.map((joined) => ({ id: rowIdOf(joined), name: joined.name })),
]

export const remoteMarksOf = (
	joinedSpaces: JoinedSpace[],
	connections: Record<string, JoinedHostState>,
): Record<string, SpaceRemote> =>
	Object.fromEntries(
		joinedSpaces.map((joined) => [
			rowIdOf(joined),
			isUnreachable(connections[joined.id]) ? "unreachable" : "connected",
		]),
	)

export const rosterSpaceIdsOf = (
	spaces: Space[],
	joinedSpaces: JoinedSpace[],
	activeHostId: string | null,
): string[] => {
	const active = joinedSpaces.find((joined) => joined.id === activeHostId)
	return active ? [rowIdOf(active)] : spaces.map((space) => space.id)
}

const initialJoinedSpacesState: JoinedSpacesState = {
	joinedSpaces: [],
	hasFailedToLoad: false,
	isJoinOpen: false,
	joinLink: "",
	joinState: "idle",
	isLeaveOpen: false,
	leavingId: null,
}

export const createJoinedSpacesController = ({
	spaces,
	hosts = joinedHosts,
	transport = joinedSpacesTransport,
	reportFailure = raiseFailureNotice,
	probeTimeout = PROBE_TIMEOUT,
}: JoinedSpacesControllerOptions): JoinedSpacesController => {
	const stateStore = createStore(initialJoinedSpacesState)
	const current = stateStore.getState
	let latestRead = 0

	const set = (fields: Partial<JoinedSpacesState>) =>
		stateStore.setState({ ...current(), ...fields })

	const reportRefusal = (reason: unknown) =>
		reportFailure({
			title: i18n.t("chat:screen.notice.failed"),
			description: describeRefusal(reason),
		})

	const noteFailedLoad = (reason: unknown) => {
		set({ hasFailedToLoad: true })
		reportRefusal(reason)
	}

	const connectEach = (joinedSpaces: JoinedSpace[]) => {
		for (const joined of joinedSpaces) {
			void hosts.connect(joined.id)
		}
	}

	const read = async () => {
		latestRead += 1
		const ticket = latestRead
		try {
			const joinedSpaces = await transport.list()
			if (ticket === latestRead) {
				set({ joinedSpaces, hasFailedToLoad: false })
				connectEach(joinedSpaces)
			}
		} catch (reason) {
			if (ticket === latestRead) noteFailedLoad(reason)
		}
	}

	const watch = () => {
		void read()
		const detach = transport
			.onChanged(() => {
				void read()
			})
			.catch((reason: unknown) => {
				noteFailedLoad(reason)
				return undefined
			})
		return () => {
			void detach.then((unlisten) => unlisten?.())
		}
	}

	const heldWithout = (id: string) =>
		current().joinedSpaces.filter((held) => held.id !== id)

	const joinedOfRow = (rowId: string | null) =>
		current().joinedSpaces.find((joined) => rowIdOf(joined) === rowId)

	const selectSpace = (id: string) => {
		spaces.select(id)
		void hosts.activate(joinedOfRow(id)?.id ?? null)
	}

	const probe = (id: string) =>
		new Promise<boolean>((resolve) => {
			const settle = (isUp: boolean) => {
				clearTimeout(timer)
				unsubscribe()
				resolve(isUp)
			}
			const check = () => {
				const connection = hosts.getState().connections[id]
				if (connection?.status === "up") settle(true)
				if (isUnreachable(connection)) settle(false)
			}
			const unsubscribe = hosts.subscribe(check)
			const timer = setTimeout(() => settle(false), probeTimeout)
			void hosts.connect(id).then(check)
		})

	const welcome = (joined: JoinedSpace) => {
		set({
			joinedSpaces: [...heldWithout(joined.id), joined],
			isJoinOpen: false,
			joinLink: "",
			joinState: "idle",
		})
		selectSpace(rowIdOf(joined))
	}

	const withdraw = async (joined: JoinedSpace) => {
		hosts.forget(joined.id)
		set({
			joinedSpaces: heldWithout(joined.id),
			joinState: "hostUnreachable",
		})
		reportFailure({ title: i18n.t("common:spaces.join.hostUnreachable") })
		await transport.remove(joined.id).catch(reportRefusal)
	}

	const settleJoined = async (joined: JoinedSpace) =>
		(await probe(joined.id)) ? welcome(joined) : withdraw(joined)

	const refuseJoin = (reason: unknown) => {
		if (isRefusedLink(reason)) {
			set({ joinState: "invalidLink" })
			return
		}
		set({ joinState: "idle" })
		reportRefusal(reason)
	}

	const join = async () => {
		if (current().joinState === "joining") {
			return
		}
		set({ joinState: "joining" })
		await transport
			.add(current().joinLink.trim())
			.then(settleJoined, refuseJoin)
	}

	const leave = async () => {
		const leaving = current().joinedSpaces.find(
			(joined) => joined.id === current().leavingId,
		)
		if (!leaving) {
			return
		}
		await transport.remove(leaving.id).catch((reason: unknown) => {
			reportRefusal(reason)
			throw reason
		})
		hosts.forget(leaving.id)
		set({
			joinedSpaces: heldWithout(leaving.id),
		})
		const { spaces: localSpaces, selectedSpaceId } = spaces.getState()
		const [firstLocal] = localSpaces
		if (selectedSpaceId === rowIdOf(leaving) && firstLocal) {
			selectSpace(firstLocal.id)
		}
	}

	return {
		getState: current,
		subscribe: stateStore.subscribe,
		watch,
		selectSpace,
		openJoin: () => set({ isJoinOpen: true, joinLink: "", joinState: "idle" }),
		setJoinOpen: (isJoinOpen: boolean) => set({ isJoinOpen }),
		changeJoinLink: (joinLink: string) => set({ joinLink, joinState: "idle" }),
		join,
		askToLeave: () =>
			set({
				isLeaveOpen: true,
				leavingId: joinedOfRow(spaces.getState().selectedSpaceId)?.id ?? null,
			}),
		setLeaveOpen: (isLeaveOpen: boolean) => set({ isLeaveOpen }),
		leave,
	}
}
