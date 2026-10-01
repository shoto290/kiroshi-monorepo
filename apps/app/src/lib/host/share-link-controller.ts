import {
	type NoticeMessage,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { listen } from "./index"

import {
	commands,
	HOST_PRESENCE_EVENT,
	type HostPresence,
	type ShareLink,
} from "../bindings"
import { createStore } from "../store"

type ShareLinkState = {
	shareLink: string | null | undefined
	hasFailedToLoad: boolean
}

export type ShareLinkTransport = {
	read: () => Promise<ShareLink>
	onPresence: (listener: () => void) => Promise<() => void>
}

type ShareLinkController = {
	getState: () => ShareLinkState
	subscribe: (listener: () => void) => () => void
	watch: () => () => void
}

type ShareLinkControllerOptions = {
	transport?: ShareLinkTransport
	reportFailure?: (message: NoticeMessage) => void
}

const shareLinkTransport: ShareLinkTransport = {
	read: () => commands.hostShareLink(),
	onPresence: (listener) =>
		listen<HostPresence>(HOST_PRESENCE_EVENT, () => listener()),
}

const initialShareLinkState: ShareLinkState = {
	shareLink: undefined,
	hasFailedToLoad: false,
}

const linkOf = (shareLink: ShareLink): string | null =>
	shareLink.kind === "up" ? shareLink.link : null

export const createShareLinkController = ({
	transport = shareLinkTransport,
	reportFailure = raiseFailureNotice,
}: ShareLinkControllerOptions = {}): ShareLinkController => {
	const stateStore = createStore(initialShareLinkState)
	let latestRead = 0

	const noteFailedLoad = () => {
		stateStore.setState({ shareLink: null, hasFailedToLoad: true })
		reportFailure({ title: i18n.t("settings:space.share.hostDown") })
	}

	const read = () => {
		latestRead += 1
		const ticket = latestRead
		const isLatest = () => ticket === latestRead
		void transport.read().then(
			(shareLink) => {
				if (isLatest()) {
					stateStore.setState({
						shareLink: linkOf(shareLink),
						hasFailedToLoad: false,
					})
				}
			},
			() => {
				if (isLatest()) noteFailedLoad()
			},
		)
	}

	const watch = () => {
		read()
		const detach = transport.onPresence(read).catch(noteFailedLoad)
		return () => {
			latestRead += 1
			void detach.then((unlisten) => unlisten?.())
		}
	}

	return {
		getState: stateStore.getState,
		subscribe: stateStore.subscribe,
		watch,
	}
}
