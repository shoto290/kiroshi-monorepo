import type {
	TranscriptCursor,
	TranscriptPage,
	TranscriptWindow,
} from "./transcript-contract"

export type TranscriptPort = {
	loadPage: (
		conversationId: string,
		cursor: TranscriptCursor | null,
	) => Promise<TranscriptPage>
	loadWindow: (conversationId: string, seq: number) => Promise<TranscriptWindow>
}
