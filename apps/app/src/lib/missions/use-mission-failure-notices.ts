import { useEffect, useRef } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { RefusedMessage } from "@/lib/conversations/conversation-controller"

export const useMissionSendFailure = (refused: RefusedMessage | null): void => {
	const t = useChatCopy()
	const reportedId = useRef<string | null>(null)

	useEffect(() => {
		if (!refused || reportedId.current === refused.id) {
			return
		}
		reportedId.current = refused.id
		raiseFailureNotice({
			title: t("missions.failure.send.title"),
			description: t("missions.failure.send.description"),
		})
	}, [refused, t])
}

export const useMissionReadFailure = (hasFailedToRead: boolean): void => {
	const t = useChatCopy()
	const wasFailing = useRef(false)

	useEffect(() => {
		const wasReported = wasFailing.current
		wasFailing.current = hasFailedToRead

		if (!hasFailedToRead || wasReported) {
			return
		}
		raiseFailureNotice({
			title: t("missions.failure.read.title"),
			description: t("missions.failure.read.description"),
		})
	}, [hasFailedToRead, t])
}
