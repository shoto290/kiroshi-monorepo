import type { TranscriptCursor, TranscriptDraft } from "./transcript-contract"
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
	landOn: (conversationId: string, seq: number) => Promise<void>
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

	const landOn = async (conversationId: string, seq: number) => {
		const window = await port.loadWindow(conversationId, seq)
		dispatch({ type: "windowLanded", window })
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
		landOn,
		follow: (conversationId, isAtLiveEdge) => {
			liveEdges.set(conversationId, isAtLiveEdge)
		},
		leave: (conversationId) => dispatch({ type: "threadLeft", conversationId }),
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
