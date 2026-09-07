import { useCallback, useEffect, useRef, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { TranscriptMessage } from "@/lib/conversations/transcript-contract"
import type { MessageLanding } from "@/lib/search/message-landing-controller"

export type MessageLandingRequest = {
	landing: MessageLanding | null
	conversationId: string | null
	messages: TranscriptMessage[]
	landOn: (seq: number) => Promise<TranscriptMessage[]>
	onLand: (messageId: string) => boolean
	onTaken: (landing: MessageLanding) => void
}

const holds = (messages: TranscriptMessage[], messageId: string) =>
	messages.some((message) => message.id === messageId)

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
	const [read, setRead] = useState<MessageLanding | null>(null)

	const giveUp = useCallback(
		(taken: MessageLanding) => {
			onTaken(taken)
			raiseFailureNotice({
				title: t("transcript.landing.unavailable.title"),
				description: t("transcript.landing.unavailable.description"),
			})
		},
		[onTaken, t],
	)

	useEffect(() => {
		if (!landing || landing.conversationId !== conversationId) {
			return
		}
		if (requested.current === landing) {
			return
		}
		requested.current = landing
		landOn(landing.seq).then(
			(window) =>
				holds(window, landing.messageId) ? setRead(landing) : giveUp(landing),
			() => giveUp(landing),
		)
	}, [landing, conversationId, landOn, giveUp])

	useEffect(() => {
		if (!landing || landing.conversationId !== conversationId) {
			return
		}
		return () => onTaken(landing)
	}, [landing, conversationId, onTaken])

	useEffect(() => {
		if (!read || !holds(messages, read.messageId)) {
			return
		}
		setRead(null)
		onTaken(read)
		if (!onLand(read.messageId)) {
			giveUp(read)
		}
	}, [read, messages, onLand, onTaken, giveUp])
}
