import type {
	TranscriptCursor,
	TranscriptDraft,
	TranscriptMessage,
} from "./transcript-contract"
import type { TranscriptPort } from "./transcript-port"
import {
	initialTranscriptState,
	selectHasMore,
	selectHasNewer,
	selectNewestSeq,
	selectOldestSeq,
	type TranscriptAction,
	type TranscriptDelta,
	type TranscriptSettlement,
	type TranscriptState,
	transcriptReducer,
} from "./transcript-state"

export type TranscriptController = {
	getState: () => TranscriptState
	subscribe: (listener: () => void) => () => void
	load: (conversationId: string) => Promise<void>
	loadOlder: (conversationId: string) => Promise<void>
	loadNewer: (conversationId: string) => Promise<void>
	loadLatest: (conversationId: string) => Promise<void>
	landOn: (conversationId: string, seq: number) => Promise<TranscriptMessage[]>
	follow: (conversationId: string, isAtLiveEdge: boolean) => void
	leave: (conversationId: string) => void
	append: (draft: TranscriptDraft) => void
	stream: (delta: TranscriptDelta) => void
	settle: (settlement: TranscriptSettlement) => void
}

export const createTranscriptController = (
	port: TranscriptPort,
): TranscriptController => {
	let state = initialTranscriptState
	const listeners = new Set<() => void>()
	const liveEdges = new Map<string, boolean>()
	const openLandings = new Map<string, number>()
	let landingsAsked = 0

	const dispatch = (action: TranscriptAction) => {
		const next = transcriptReducer(state, action)
		if (next === state) {
			return
		}
		state = next
		for (const listener of listeners) {
			listener()
		}
	}

	const readPage = async (
		conversationId: string,
		cursor: TranscriptCursor | null,
	) => {
		const page = await port.loadPage(conversationId, cursor)
		dispatch({ type: "pageLoaded", page })
	}

	const load = (conversationId: string) => readPage(conversationId, null)

	const loadOlder = async (conversationId: string) => {
		const beforeSeq = selectOldestSeq(state, conversationId)
		if (beforeSeq === null || !selectHasMore(state, conversationId)) {
			return
		}
		await readPage(conversationId, { beforeSeq })
	}

	const loadNewer = async (conversationId: string) => {
		const seq = selectNewestSeq(state, conversationId)
		if (seq === null || !selectHasNewer(state, conversationId)) {
			return
		}
		const window = await port.loadWindow(conversationId, seq)
		dispatch({ type: "newerLoaded", window })
	}

	const loadLatest = async (conversationId: string) => {
		if (!selectHasNewer(state, conversationId)) {
			return
		}
		const page = await port.loadPage(conversationId, null)
		dispatch({ type: "latestLoaded", page })
	}

	const landOn = async (conversationId: string, seq: number) => {
		landingsAsked += 1
		const asked = landingsAsked
		openLandings.set(conversationId, asked)
		const window = await port.loadWindow(conversationId, seq)
		if (openLandings.get(conversationId) === asked) {
			openLandings.delete(conversationId)
			dispatch({ type: "windowLanded", window })
		}
		return window.messages
	}

	return {
		getState: () => state,
		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		load,
		loadOlder,
		loadNewer,
		loadLatest,
		landOn,
		follow: (conversationId, isAtLiveEdge) => {
			liveEdges.set(conversationId, isAtLiveEdge)
		},
		leave: (conversationId) => {
			openLandings.delete(conversationId)
			dispatch({ type: "threadLeft", conversationId })
		},
		append: (draft) =>
			dispatch({
				type: "messageAppended",
				draft,
				isAtLiveEdge: liveEdges.get(draft.conversationId) ?? true,
			}),
		stream: (delta) => dispatch({ type: "messageStreamed", delta }),
		settle: (settlement) => dispatch({ type: "messageSettled", settlement }),
	}
}
