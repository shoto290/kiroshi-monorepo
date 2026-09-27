import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type { ChatMessage, RuntimeScope, ScopedEvent } from "../agent/contract"
import type { ChatDriver } from "../chat/driver"
import type { ConversationRuntimes } from "../conversations/conversation-runtimes"
import type { TranscriptStore } from "../conversations/store-port"

export type ReportRelayOptions = {
	driver: Pick<ChatDriver, "subscribe">
	store: Pick<TranscriptStore, "mainChat">
	runtimes: Pick<ConversationRuntimes, "runtimeFor">
	reportFailure: (notice: NoticeMessage) => void
}

const SEPARATOR = "\u0000"

const scopeKeyOf = ({
	conversationId,
	botId,
	runtimeSessionId,
}: RuntimeScope) => [conversationId, botId, runtimeSessionId].join(SEPARATOR)

export const startReportRelay = ({
	driver,
	store,
	runtimes,
	reportFailure,
}: ReportRelayOptions): (() => void) => {
	const endedRuns = new Set<string>()

	const raiseFailure = (thrown: unknown) => {
		console.error("report relay:", thrown)
		reportFailure({
			title: i18n.t("chat:transcript.mention.unresolved.title", { count: 1 }),
		})
	}

	const isMainChat = async ({ conversationId, botId }: RuntimeScope) =>
		(await store.mainChat(botId)).id === conversationId

	const relay = async (scope: RuntimeScope, message: ChatMessage) => {
		try {
			if (await isMainChat(scope)) {
				return
			}
			await runtimes
				.runtimeFor(scope.conversationId)
				.relayRunReport(scope, message)
		} catch (thrown) {
			raiseFailure(thrown)
		}
	}

	const noteRunEnded = (scope: RuntimeScope, event: ScopedEvent["event"]) => {
		if (event.type === "turnEnded" && event.ended.structuredOutput) {
			endedRuns.add(scopeKeyOf(scope))
		}
	}

	const take = ({ scope, event }: ScopedEvent) => {
		if (!scope) {
			return
		}
		noteRunEnded(scope, event)
		const key = scopeKeyOf(scope)
		if (event.type !== "messageCompleted" || !endedRuns.has(key)) {
			return
		}
		endedRuns.delete(key)
		void relay(scope, event.message)
	}

	const listening = driver.subscribe(take).catch((reason) => {
		raiseFailure(reason)
		return () => undefined
	})

	return () => {
		void listening.then((stop) => stop())
	}
}
