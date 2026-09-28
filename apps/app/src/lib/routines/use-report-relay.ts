import { useEffect } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"

import { startReportRelay } from "./report-relay"

import type { ChatDriver } from "../chat/driver"
import type { ConversationRuntimes } from "../conversations/conversation-runtimes"
import type { TranscriptStore } from "../conversations/store-port"

export type ReportRelayMount = {
	driver: ChatDriver
	store: TranscriptStore
	runtimes: ConversationRuntimes
}

export const useReportRelay = ({
	driver,
	store,
	runtimes,
}: ReportRelayMount) => {
	useEffect(
		() =>
			startReportRelay({
				driver,
				store,
				runtimes,
				reportFailure: raiseFailureNotice,
			}),
		[driver, store, runtimes],
	)
}
