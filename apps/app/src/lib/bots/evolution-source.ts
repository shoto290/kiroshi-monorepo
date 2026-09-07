import type { EvolvedBundle, RuntimeScope } from "../agent/contract"
import type { ChatDriver } from "../chat/driver"

type BotPanel = {
	getState: () => { botId: string | null }
	reload: () => void
}

type PersonPanel = {
	reload: () => void
}

type SpacePanel = {
	getState: () => { spaceId: string | null }
	reload: () => void
}

type RosterPanel = {
	spaceOfConversation: (conversationId: string) => string | undefined
	reload: () => Promise<void>
}

export type EvolutionSourceOptions = {
	driver: Pick<ChatDriver, "subscribe">
	roster: RosterPanel
	skills: BotPanel
	history: BotPanel
	userPlugin: PersonPanel
	spacePlugin: SpacePanel
}

export const startEvolutionSource = ({
	driver,
	roster,
	skills,
	history,
	userPlugin,
	spacePlugin,
}: EvolutionSourceOptions): (() => void) => {
	const readBotPanels = (botId: string) => {
		void roster.reload()
		for (const panel of [skills, history]) {
			if (panel.getState().botId === botId) {
				panel.reload()
			}
		}
	}

	const readSpacePanel = (conversationId: string) => {
		const spaceId = roster.spaceOfConversation(conversationId)
		if (spaceId && spacePlugin.getState().spaceId === spaceId) {
			spacePlugin.reload()
		}
	}

	const readPanels = (scope: RuntimeScope, bundle: EvolvedBundle) => {
		if (bundle === "user") {
			return userPlugin.reload()
		}
		if (bundle === "space") {
			return readSpacePanel(scope.conversationId)
		}
		return readBotPanels(scope.botId)
	}

	const detach = driver
		.subscribe(({ scope, event }) => {
			if (scope && event.type === "botEvolved") {
				readPanels(scope, event.bundle)
			}
		})
		.catch(() => undefined)

	return () => {
		void detach.then((stop) => stop?.())
	}
}
