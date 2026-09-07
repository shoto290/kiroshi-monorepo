import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { type ChatController, createChatController } from "./chat-controller"
import type { ChatState } from "./chat-state"
import type { ChatDriver } from "./driver"
import { type SidebarActivity, sidebarActivityFor } from "./screen-model"

import type { BotPreviews } from "../bots/roster-controller"
import { type RosterLine, runsIn, type SoloThreads } from "../bots/roster-line"
import type { TranscriptStore } from "../conversations/store-port"
import { type LastWord, lastWordIn } from "../conversations/transcript-state"

export type Chat = {
	state: ChatState
	controller: ChatController
}

export function useChat(driver: ChatDriver, store: TranscriptStore): Chat {
	const [controller] = useState(() => createChatController(driver, store))
	const state = useSyncExternalStore(controller.subscribe, controller.getState)

	useEffect(() => controller.attach(), [controller])

	return { state, controller }
}

type BotActivity = Record<string, SidebarActivity>

export type ActivityBySpaceId = Record<string, BotActivity>

const IDLE: SidebarActivity = { isWorking: false }

const NO_ACTIVITY: BotActivity = {}

export const activityIn = (
	working: ActivityBySpaceId,
	spaceId: string | null,
): BotActivity => (spaceId ? (working[spaceId] ?? NO_ACTIVITY) : NO_ACTIVITY)

export const activityOf = (
	working: ActivityBySpaceId,
	botId: string | null,
): SidebarActivity =>
	(botId === null
		? undefined
		: Object.values(working)
				.map((held) => held[botId])
				.find((activity) => activity?.isWorking)) ?? IDLE

export const busyBotCountIn = (working: ActivityBySpaceId): number =>
	Object.values(working)
		.flatMap((held) => Object.values(held))
		.filter((activity) => activity.isWorking).length

type ShownActivity = RosterLine & { activity: SidebarActivity }

const signatureOf = (shown: ShownActivity[]): string =>
	shown
		.map(
			({ spaceId, botId, activity }) =>
				`${spaceId}/${botId}:${activity.isWorking}:${activity.kind ?? ""}`,
		)
		.join("|")

const activityBySpaceId = (shown: ShownActivity[]): ActivityBySpaceId => {
	const working: ActivityBySpaceId = {}
	for (const { spaceId, botId, activity } of shown) {
		working[spaceId] = { ...working[spaceId], [botId]: activity }
	}
	return working
}

type ReadableChat = Pick<ChatController, "stateFor" | "subscribe">

export type LineActivityMount = {
	controller: ReadableChat
	lines: RosterLine[]
	soloThreads: SoloThreads
}

export function useBotActivity({
	controller,
	lines,
	soloThreads,
}: LineActivityMount): ActivityBySpaceId {
	const held = useRef<{
		signature: string
		working: ActivityBySpaceId
	} | null>(null)

	return useSyncExternalStore(controller.subscribe, () => {
		const shown = lines.map(({ spaceId, botId }) => {
			const state = controller.stateFor(botId)
			return {
				spaceId,
				botId,
				activity: runsIn(soloThreads, state.conversationId, spaceId)
					? sidebarActivityFor(state)
					: IDLE,
			}
		})
		const signature = signatureOf(shown)
		if (held.current?.signature !== signature) {
			held.current = { signature, working: activityBySpaceId(shown) }
		}
		return held.current.working
	})
}

export type PreviewsBySpaceId = Record<string, BotPreviews>

const NO_PREVIEWS: BotPreviews = {}

export const previewsIn = (
	previews: PreviewsBySpaceId,
	spaceId: string | null,
): BotPreviews => (spaceId ? (previews[spaceId] ?? NO_PREVIEWS) : NO_PREVIEWS)

type ShownPreview = RosterLine & { word: LastWord | undefined }

const previewSignatureOf = (shown: ShownPreview[]): string =>
	shown
		.map(
			({ spaceId, botId, word }) =>
				`${spaceId}/${botId}:${word?.at ?? ""}:${word?.text ?? ""}`,
		)
		.join("|")

const bySpaceId = (shown: ShownPreview[]): PreviewsBySpaceId => {
	const previews: PreviewsBySpaceId = {}
	for (const { spaceId, botId, word } of shown) {
		previews[spaceId] = { ...previews[spaceId], [botId]: word }
	}
	return previews
}

export type LinePreviewsMount = {
	controller: ChatController
	lines: RosterLine[]
	stored: PreviewsBySpaceId
	soloThreads: SoloThreads
}

export function useBotPreviews({
	controller,
	lines,
	stored,
	soloThreads,
}: LinePreviewsMount): PreviewsBySpaceId {
	const held = useRef<{
		signature: string
		previews: PreviewsBySpaceId
	} | null>(null)

	return useSyncExternalStore(controller.subscribe, () => {
		const shown = lines.map(({ spaceId, botId }) => {
			const state = controller.stateFor(botId)
			const live = runsIn(soloThreads, state.conversationId, spaceId)
				? lastWordIn(state.messages)
				: undefined
			return { spaceId, botId, word: live ?? stored[spaceId]?.[botId] }
		})
		const signature = previewSignatureOf(shown)
		if (held.current?.signature !== signature) {
			held.current = { signature, previews: bySpaceId(shown) }
		}
		return held.current.previews
	})
}
