import type { BotChat } from "./bot-chat"
import type { ChatContext } from "./chat-context"

export type CarriedContext = ReturnType<typeof createCarriedContext>

export const createCarriedContext = ({
	store,
	now,
	reportStore,
}: ChatContext) => {
	const capture = async (bot: BotChat) => {
		const conversationId = bot.state.conversationId
		const runtime = bot.state.runtime
		if (!conversationId || !runtime) {
			return
		}
		await store.captureCheckpoint(
			conversationId,
			bot.id,
			runtime.runtimeSessionId,
			now(),
		)
	}

	const contextFor = async (bot: BotChat, promptId: string, text: string) => {
		const conversationId = bot.state.conversationId
		const runtime = bot.state.runtime
		if (bot.run.carried || !conversationId || !runtime) {
			return text
		}
		await capture(bot).catch((refusal) => reportStore(bot, refusal))
		return store.boundedContext(
			conversationId,
			bot.id,
			runtime.runtimeSessionId,
			promptId,
		)
	}

	return { capture, contextFor }
}
