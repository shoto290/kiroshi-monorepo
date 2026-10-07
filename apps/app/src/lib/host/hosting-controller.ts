import {
	type NoticeMessage,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { listen } from "./index"

import {
	commands,
	HOSTING_CHANGED_EVENT,
	type HostingChanged,
	type HostingState,
} from "../bindings"
import { createStore } from "../store"

type HostingControllerState = {
	hosting: HostingState | undefined
}

export type HostedSpace = {
	id: string
	name: string
}

export type HostingTransport = {
	read: (spaceId: string) => Promise<HostingState>
	start: (spaceId: string) => Promise<HostingState>
	stop: (spaceId: string) => Promise<HostingState>
	onChanged: (
		listener: (changed: HostingChanged) => void,
	) => Promise<() => void>
}

type HostingController = {
	getState: () => HostingControllerState
	subscribe: (listener: () => void) => () => void
	watch: (space: HostedSpace) => () => void
	start: () => void
	stop: () => void
}

type HostingControllerOptions = {
	transport?: HostingTransport
	reportFailure?: (message: NoticeMessage) => void
}

const answerOf = async (
	pending: ReturnType<typeof commands.hostingStart>,
): Promise<HostingState> => {
	const result = await pending
	if (result.status === "error") {
		throw new Error(result.error.kind)
	}
	return result.data
}

const hostingTransport: HostingTransport = {
	read: commands.hostingState,
	start: (spaceId) => answerOf(commands.hostingStart(spaceId)),
	stop: (spaceId) => answerOf(commands.hostingStop(spaceId)),
	onChanged: (listener) =>
		listen<HostingChanged>(HOSTING_CHANGED_EVENT, (event) =>
			listener(event.payload),
		),
}

const failureOf = (space: HostedSpace): NoticeMessage => ({
	title: i18n.t("settings:space.hosting.failed.title", { name: space.name }),
	description: i18n.t("settings:space.hosting.failed.description"),
})

export const createHostingController = ({
	transport = hostingTransport,
	reportFailure = raiseFailureNotice,
}: HostingControllerOptions = {}): HostingController => {
	const stateStore = createStore<HostingControllerState>({
		hosting: undefined,
	})
	let watched: HostedSpace | null = null
	let lastWatchedId: string | null = null

	const settle = (space: HostedSpace, hosting: HostingState) => {
		if (watched?.id !== space.id) return
		const wasFailed = stateStore.getState().hosting?.kind === "failed"
		stateStore.setState({ hosting })
		if (hosting.kind === "failed" && !wasFailed) {
			reportFailure(failureOf(space))
		}
	}

	const follow = (space: HostedSpace, pending: Promise<HostingState>) => {
		void pending.then(
			(hosting) => settle(space, hosting),
			() => {
				if (watched?.id === space.id) reportFailure(failureOf(space))
			},
		)
	}

	const watch = (space: HostedSpace) => {
		watched = space
		if (lastWatchedId !== space.id) {
			stateStore.setState({ hosting: undefined })
		}
		lastWatchedId = space.id
		follow(space, transport.read(space.id))
		const detach = transport
			.onChanged((changed) => {
				if (changed.spaceId === space.id) settle(space, changed.state)
			})
			.catch(() => reportFailure(failureOf(space)))
		return () => {
			if (watched === space) watched = null
			void detach.then((unlisten) => unlisten?.())
		}
	}

	const command = (run: (spaceId: string) => Promise<HostingState>) => () => {
		if (watched) follow(watched, run(watched.id))
	}

	return {
		getState: stateStore.getState,
		subscribe: stateStore.subscribe,
		watch,
		start: command(transport.start),
		stop: command(transport.stop),
	}
}
