import { transcriptEventsTransport } from "./store-transport"
import type { TranscriptMessage } from "./transcript-contract"

import { drivesRealHost, onHostReconnected } from "../host"

export type MessageStoredListener = (
	listener: (stored: TranscriptMessage) => void,
) => Promise<() => void>

export type ReconnectionListener = (listener: () => void) => () => void

export const createMessageStoredListener = (): MessageStoredListener =>
	drivesRealHost()
		? transcriptEventsTransport.onMessageStored
		: async () => () => undefined

export const createReconnectionListener = (): ReconnectionListener =>
	drivesRealHost() ? onHostReconnected : () => () => undefined
