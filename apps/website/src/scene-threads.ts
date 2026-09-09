import type { RosterBot } from "@workspace/ui/components/roster"

import { SCENE_COPY } from "./copy"
import { HAPPY, ICHI, NI, REI, SAN } from "./scene-cast"

type BotThreadCopy = {
	ask: string
	preview: string
}

type SceneThread = {
	bot: RosterBot
	ask: string
	answer: string
}

const botThread = (bot: RosterBot, copy: BotThreadCopy): SceneThread => ({
	bot,
	ask: copy.ask,
	answer: copy.preview,
})

const BOT_THREADS: Record<string, SceneThread> = {
	[ICHI.id]: botThread(ICHI, SCENE_COPY.ichi),
	[NI.id]: botThread(NI, SCENE_COPY.ni),
	[SAN.id]: botThread(SAN, SCENE_COPY.san),
	[REI.id]: botThread(REI, SCENE_COPY.rei),
	[HAPPY.id]: botThread(HAPPY, SCENE_COPY.happy),
}

const threadOf = (botId: string): SceneThread | undefined => BOT_THREADS[botId]

export { type SceneThread, threadOf }
