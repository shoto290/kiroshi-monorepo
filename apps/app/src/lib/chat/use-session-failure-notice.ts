import { type RefObject, useEffect, useRef } from "react"

import {
	endNotice,
	type NoticeMessage,
	raiseFailureNotice,
	raiseTransientNotice,
} from "@workspace/ui/components/notice-surface"
import { type ChatCopy, useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import { describeTransportError } from "@/lib/agent/messages"
import {
	type LeftOutApplication,
	useSessionApplication,
} from "@/lib/applications/use-session-application"
import type { ChatError } from "@/lib/chat/chat-state"
import {
	isSignedOut,
	needsFreshSession,
	noticeTitleFor,
} from "@/lib/chat/screen-model"

type SessionFailure = {
	error: ChatError | undefined
	speakerId: string | undefined
	onDismiss: (id: string) => void
	onRestart?: () => void
	onSignIn?: () => void
}

type FailureReading = {
	error: ChatError
	leftOut: LeftOutApplication | null
	onRestart?: () => void
	onSignIn?: () => void
}

type RaisedFailure = {
	key: string
	noticeId: string
}

const leftOutMessageOf = (
	t: ChatCopy,
	leftOut: LeftOutApplication,
): NoticeMessage => ({
	title: t("applications.connection.session.title", {
		ns: "bots",
		name: leftOut.name,
	}),
	description: t("applications.connection.session.description", { ns: "bots" }),
	action: {
		label: t("applications.connection.session.action", { ns: "bots" }),
		onPress: leftOut.open,
	},
})

const transportMessageOf = (
	t: ChatCopy,
	{ error, onRestart, onSignIn }: FailureReading,
): NoticeMessage => {
	const title = noticeTitleFor(t, error.error)

	if (isSignedOut(error.error) && onSignIn) {
		return {
			title,
			description: t("screen.transport.notConnected"),
			action: { label: t("emptyState.signIn"), onPress: onSignIn },
		}
	}
	return {
		title,
		description: describeTransportError(t, error.error),
		action:
			needsFreshSession(error.error) && onRestart
				? { label: t("screen.restart"), onPress: onRestart }
				: undefined,
	}
}

const failureMessageOf = (t: ChatCopy, reading: FailureReading) =>
	reading.leftOut
		? leftOutMessageOf(t, reading.leftOut)
		: transportMessageOf(t, reading)

const failureKeyOf = (
	error: ChatError | undefined,
	leftOut: LeftOutApplication | null,
) => (error ? `${error.id}:${leftOut?.name ?? ""}` : null)

let fadedFailureId: string | null = null

const isRefusedResume = (error: ChatError) =>
	error.error.kind === "resumeFailed"

const fadeRefusedResume = (
	t: ChatCopy,
	error: ChatError,
	onDismiss: (id: string) => void,
) => {
	if (fadedFailureId === error.id) {
		return
	}
	fadedFailureId = error.id
	raiseTransientNotice({
		type: "warning",
		title: noticeTitleFor(t, error.error),
		description: describeTransportError(t, error.error),
	})
	onDismiss(error.id)
}

const release = (raised: RefObject<RaisedFailure | null>) => {
	const current = raised.current
	raised.current = null
	if (current) {
		endNotice(current.noticeId)
	}
}

export const useSessionFailureNotice = ({
	error,
	speakerId,
	onDismiss,
	onRestart,
	onSignIn,
}: SessionFailure): void => {
	const t = useChatCopy()
	const leftOut = useSessionApplication(error, speakerId)
	const raised = useRef<RaisedFailure | null>(null)
	const key = failureKeyOf(error, leftOut)

	useEffect(() => {
		if (raised.current?.key === key) {
			return
		}
		release(raised)
		if (!error || !key) {
			return
		}
		if (isRefusedResume(error)) {
			fadeRefusedResume(t, error, onDismiss)
			return
		}
		const dismissUnlessReleased = () => {
			if (raised.current !== failure) {
				return
			}
			raised.current = null
			onDismiss(error.id)
		}
		const failure: RaisedFailure = {
			key,
			noticeId: raiseFailureNotice({
				...failureMessageOf(t, { error, leftOut, onRestart, onSignIn }),
				onClose: dismissUnlessReleased,
			}),
		}
		raised.current = failure
	}, [key, error, leftOut, onDismiss, onRestart, onSignIn, t])

	useEffect(() => () => release(raised), [])
}
