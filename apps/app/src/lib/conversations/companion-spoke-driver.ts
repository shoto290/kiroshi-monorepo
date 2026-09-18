import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type { ConversationRuntimes } from "./conversation-runtimes"
import type { CompanionSpoke } from "./transcript-contract"

export type CompanionSpokeUnsubscribe = () => void

export type CompanionSpokePort = {
	onCompanionSpoke: (
		listener: (spoken: CompanionSpoke) => void,
	) => Promise<CompanionSpokeUnsubscribe>
}

export type CompanionSpokeDriverOptions = {
	runtimes: Pick<ConversationRuntimes, "runtimeFor">
	companions: CompanionSpokePort
	reportFailure: (notice: NoticeMessage) => void
}

const SEPARATOR = "\u0000"

const keyOf = ({ conversationId, authorBotId, text }: CompanionSpoke) =>
	[conversationId, authorBotId, text].join(SEPARATOR)

const detailOf = (thrown: unknown) =>
	thrown instanceof Error ? thrown.message : String(thrown)

export const startCompanionSpokeDriver = ({
	runtimes,
	companions,
	reportFailure,
}: CompanionSpokeDriverOptions): (() => void) => {
	const relayed = new Set<string>()
	let isStopped = false

	const raiseFailure = (thrown: unknown) => {
		console.error("companion spoke driver: the message was not written", thrown)
		reportFailure({
			title: i18n.t("chat:screen.error.writeFailed", {
				detail: detailOf(thrown),
			}),
		})
	}

	const relay = async (spoken: CompanionSpoke) => {
		try {
			await runtimes.runtimeFor(spoken.conversationId).relaySpoken(spoken)
		} catch (thrown) {
			raiseFailure(thrown)
		}
	}

	const take = (spoken: CompanionSpoke) => {
		const key = keyOf(spoken)

		if (isStopped || relayed.has(key)) {
			return
		}

		relayed.add(key)
		void relay(spoken)
	}

	const listening = companions.onCompanionSpoke(take).catch((reason) => {
		console.error(
			"companion spoke driver: companion messages could not be listened to",
			reason,
		)
		return () => undefined
	})

	return () => {
		isStopped = true
		void listening.then((stop) => stop())
	}
}
