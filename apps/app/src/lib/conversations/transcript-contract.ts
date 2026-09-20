import type { TranscriptMessage } from "@/lib/bindings"

export type {
	CompanionArrival,
	TerminalCompletion,
	TranscriptCompletion,
	TranscriptMessage,
	TranscriptPage,
	TranscriptRole,
	TranscriptWindow,
} from "@/lib/bindings"

export type TranscriptDraft = Omit<TranscriptMessage, "seq">

export type TranscriptCursor = {
	beforeSeq: number
}

export const TRANSCRIPT_PAGE_SIZE = 20

export const TRANSCRIPT_WINDOW_SIZE = 60

export const COMPANION_ARRIVED_EVENT = "conversation://companion-arrived"

// read as text by the_companion_spoke_event_is_named_and_shaped_like_its_mirror
// in apps/app/src-tauri/src/conversations/contract.rs, which matches both spellings literally
export const COMPANION_SPOKE_EVENT = "conversation://companion-spoke"

export type CompanionSpoke = {
	conversationId: string
	authorBotId: string
	text: string
}
