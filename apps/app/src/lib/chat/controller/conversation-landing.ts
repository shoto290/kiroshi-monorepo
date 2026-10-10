import type { BotChat } from "./bot-chat"
import type { ChatContext } from "./chat-context"

export type ConversationLanding = ReturnType<typeof createConversationLanding>

export const createConversationLanding = ({ transitions }: ChatContext) => {
	const isSuperseded = (bot: BotChat) => {
		const latest = transitions.get(bot.id)?.kind
		return latest !== undefined && latest !== bot.opening?.kind
	}

	const landedConversationOf = async (bot: BotChat) => {
		const opening = bot.opening
		await opening?.landed
		if (bot.opening !== opening || isSuperseded(bot)) {
			return null
		}
		return bot.state.conversationId
	}

	return { landedConversationOf }
}
