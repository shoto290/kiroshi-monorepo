import { type BotChat, spend } from "./bot-chat"
import type { CarriedContext } from "./carried-context"
import type { ChatContext } from "./chat-context"
import type { SessionRunner } from "./session-runner"

import { REDESCRIBED, type RotationReason, rotationFor } from "../rotation"

export type RunRotation = ReturnType<typeof createRunRotation>

export const createRunRotation = (
	{ bots, promptsPerRun, reportStore }: ChatContext,
	{ startFor }: SessionRunner,
	{ capture }: CarriedContext,
) => {
	const runRotation = async (bot: BotChat, reason: RotationReason) => {
		try {
			await capture(bot)
		} catch (refusal) {
			reportStore(bot, refusal)
			return null
		}
		return startFor(bot, undefined, reason)
	}

	const rotateFor = (bot: BotChat, reason: RotationReason) => {
		bot.pendingRotation ??= runRotation(bot, reason).finally(() => {
			bot.pendingRotation = null
		})
		return bot.pendingRotation
	}

	const rotateIfDue = async (bot: BotChat) => {
		const reason = rotationFor(bot.run, promptsPerRun)
		if (reason) {
			await rotateFor(bot, reason)
		}
	}

	const redescribe = (botId: string) => {
		const bot = bots.get(botId)
		if (!bot) {
			return
		}
		spend(bot, REDESCRIBED)
	}

	return { rotateIfDue, redescribe }
}
