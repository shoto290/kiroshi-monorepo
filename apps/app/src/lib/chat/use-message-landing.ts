import { useCallback, useEffect, useRef, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { TranscriptMessage } from "@/lib/conversations/transcript-contract"
import type { MessageLanding } from "@/lib/search/message-landing-controller"

export type MessageLandingRequest = {
	landing: MessageLanding | null
	conversationId: string | null
	messages: TranscriptMessage[]
	landOn: (seq: number) => Promise<void>
	onLand: (messageId: string) => boolean
	onTaken: () => void
}

export const useMessageLanding = ({
	landing,
	conversationId,
	messages,
	landOn,
	onLand,
	onTaken,
}: MessageLandingRequest) => {
	const t = useChatCopy()
	const requested = useRef<MessageLanding | null>(null)
	const [readMessageId, setReadMessageId] = useState<string | null>(null)

	const reportUnreachable = useCallback(() => {
		raiseFailureNotice({
			title: t("transcript.landing.unavailable.title"),
			description: t("transcript.landing.unavailable.description"),
		})
	}, [t])

	useEffect(() => {
		if (!landing || landing.conversationId !== conversationId) {
			return
		}
		if (requested.current === landing) {
			return
		}
		requested.current = landing
		landOn(landing.seq).then(
			() => setReadMessageId(landing.messageId),
			() => {
				onTaken()
				reportUnreachable()
			},
		)
	}, [landing, conversationId, landOn, onTaken, reportUnreachable])

	useEffect(() => {
		if (!landing || landing.conversationId !== conversationId) {
			return
		}
		return onTaken
	}, [landing, conversationId, onTaken])

	useEffect(() => {
		if (readMessageId === null) {
			return
		}
		if (!messages.some((message) => message.id === readMessageId)) {
			return
		}
		setReadMessageId(null)
		onTaken()
		if (!onLand(readMessageId)) {
			reportUnreachable()
		}
	}, [readMessageId, messages, onLand, onTaken, reportUnreachable])
}
