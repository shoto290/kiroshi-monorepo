import { createContext, useCallback, useContext } from "react"

import { useChatCopy } from "@workspace/ui/hooks/use-chat-copy"

import type { TranscriptMessage } from "../conversations/transcript-contract"

export type SpaceHost = { kind: "hosted" } | { kind: "joined"; name: string }

export type ThreadAuthorship = {
	accountId: string | null
	host: SpaceHost
}

export type MessageAuthorship = Pick<
	TranscriptMessage,
	"authorAccountId" | "authorName"
>

export const HOSTED_SIGNED_OUT: ThreadAuthorship = {
	accountId: null,
	host: { kind: "hosted" },
}

export const ThreadAuthorshipContext =
	createContext<ThreadAuthorship>(HOSTED_SIGNED_OUT)

const hostNameOf = (host: SpaceHost): string | null =>
	host.kind === "joined" ? host.name : null

const isWrittenBySelf = (
	{ accountId, host }: ThreadAuthorship,
	{ authorAccountId }: MessageAuthorship,
): boolean =>
	authorAccountId === null
		? host.kind === "hosted"
		: authorAccountId === accountId

const personNameOf = (
	authorship: ThreadAuthorship,
	author: MessageAuthorship,
	unnamed: string,
): string | undefined => {
	if (isWrittenBySelf(authorship, author)) {
		return undefined
	}
	const name =
		author.authorAccountId === null
			? hostNameOf(authorship.host)
			: author.authorName
	return name || unnamed
}

export type PersonOf = (author: MessageAuthorship) => string | undefined

export const usePersonOf = (): PersonOf => {
	const authorship = useContext(ThreadAuthorshipContext)
	const unnamed = useChatCopy()("working.name")
	return useCallback(
		(author: MessageAuthorship) => personNameOf(authorship, author, unnamed),
		[authorship, unnamed],
	)
}
