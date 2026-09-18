import type { EvolvedBundle, RuntimeScope } from "../agent/contract"
import type { ChatDriver } from "../chat/driver"
import {
	botPlugin,
	isSamePluginScope,
	spacePlugin as spacePluginScope,
} from "../conversations/plugin-scope"
import type { PluginScope } from "../conversations/store-contract"

type PluginPanel = {
	getState: () => { scope: PluginScope | null }
	reload: () => void
}

type RosterPanel = {
	spaceOfConversation: (conversationId: string) => string | undefined
	reload: () => Promise<void>
}

export type EvolutionSourceOptions = {
	driver: Pick<ChatDriver, "subscribe">
	roster: RosterPanel
	companionPlugin: PluginPanel
	userPlugin: Pick<PluginPanel, "reload">
	spacePlugin: PluginPanel
}

export const startEvolutionSource = ({
	driver,
	roster,
	companionPlugin,
	userPlugin,
	spacePlugin,
}: EvolutionSourceOptions): (() => void) => {
	const readOpenPanel = (panel: PluginPanel, scope: PluginScope) => {
		if (isSamePluginScope(panel.getState().scope, scope)) {
			panel.reload()
		}
	}

	const readCompanionPanels = (botId: string) => {
		void roster.reload()
		readOpenPanel(companionPlugin, botPlugin(botId))
	}

	const readSpacePanel = (conversationId: string) => {
		const spaceId = roster.spaceOfConversation(conversationId)
		if (spaceId) {
			readOpenPanel(spacePlugin, spacePluginScope(spaceId))
		}
	}

	const readPanels = (scope: RuntimeScope, bundle: EvolvedBundle) => {
		if (bundle === "user") {
			return userPlugin.reload()
		}
		if (bundle === "space") {
			return readSpacePanel(scope.conversationId)
		}
		return readCompanionPanels(scope.botId)
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
