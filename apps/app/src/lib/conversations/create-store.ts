import { createFakeTranscriptStore } from "./fake-transcript-store"
import type { TranscriptStore } from "./store-port"
import { conversationStore } from "./store-transport"

import { drivesRealHost } from "../host"

export function createTranscriptStore(): TranscriptStore {
	return drivesRealHost() ? conversationStore : createFakeTranscriptStore()
}
