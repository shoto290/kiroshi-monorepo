import { useEffect, useMemo } from "react"

import { applicationTransport } from "../applications/application-transport"
import { connectionTransport } from "../applications/connection-transport"
import { useApplications } from "../applications/use-applications"
import { useConnections } from "../applications/use-connections"
import { useMcpServers } from "../bots/use-mcp-servers"
import { useModelCatalogue } from "../bots/use-model-catalogue"
import { useRoster } from "../bots/use-roster"
import { createAttachmentsController } from "../chat/attachments-controller"
import { createAttachmentsPort } from "../chat/attachments-port"
import { createChatDriver } from "../chat/create-driver"
import { createDraftsController } from "../chat/drafts-controller"
import { useChat } from "../chat/use-chat"
import { createConversationRuntimes } from "../conversations/conversation-runtimes"
import { createTranscriptStore } from "../conversations/create-store"
import { createSpokenWords } from "../conversations/spoken-words"
import { useEnvironment } from "../environment/use-environment"
import { createOpenedMissionController } from "../missions/opened-mission-controller"
import { usePlugin } from "../plugins/use-plugin"
import { createOpenedRoutineController } from "../routines/opened-routine-controller"
import { createMessageLandingController } from "../search/message-landing-controller"
import { useCollapsedSections } from "../sections/use-collapsed-sections"
import { useSections } from "../sections/use-sections"
import { useSpaces } from "../spaces/use-spaces"
import { useUser } from "../user/use-user"

export const useWorkspaceCore = () => {
	const driver = useMemo(createChatDriver, [])
	const store = useMemo(createTranscriptStore, [])
	const chat = useChat(driver, store)
	const roster = useRoster(store)
	const conversationRuntimes = useMemo(
		() =>
			createConversationRuntimes(driver, store, {
				onNamed: roster.controller.nameConversation,
			}),
		[driver, store, roster.controller],
	)

	useEffect(
		() => () => {
			void conversationRuntimes.shutdown()
		},
		[conversationRuntimes],
	)

	const attachments = useMemo(
		() =>
			createAttachmentsController(
				createAttachmentsPort({
					chat: chat.controller,
					driver,
					runtimes: conversationRuntimes,
				}),
			),
		[chat.controller, driver, conversationRuntimes],
	)
	const drafts = useMemo(createDraftsController, [])
	const spokenWords = useMemo(createSpokenWords, [])
	const openedMission = useMemo(
		() => createOpenedMissionController(roster.controller),
		[roster.controller],
	)
	const openedRoutine = useMemo(createOpenedRoutineController, [])
	const messageLandings = useMemo(createMessageLandingController, [])
	const sections = useSections(store, {
		move: roster.controller.moveToSection,
		clear: roster.controller.clearSection,
		pin: roster.controller.pin,
	})
	const collapsedSections = useCollapsedSections(store)
	const companionPlugin = usePlugin(store)
	const botMcpServers = useMcpServers(store)
	const spaceMcpServers = useMcpServers(store)
	const botEnvironment = useEnvironment(store)
	const spaceEnvironment = useEnvironment(store)
	const serverEnvironment = useEnvironment(store)
	const userMcpServers = useMcpServers(store)
	const botConnections = useConnections(connectionTransport)
	const spaceConnections = useConnections(connectionTransport)
	const userConnections = useConnections(connectionTransport)
	const applications = useApplications(applicationTransport, store)
	const catalogue = useModelCatalogue()
	const user = useUser()
	const userPlugin = usePlugin(store)
	const spaces = useSpaces(store)
	const spacePlugin = usePlugin(store)
	const preferences = user.state.preferences

	return {
		applications,
		attachments,
		botConnections,
		botEnvironment,
		botMcpServers,
		catalogue,
		chat,
		collapsedSections,
		companionPlugin,
		conversationRuntimes,
		drafts,
		driver,
		messageLandings,
		openedMission,
		openedRoutine,
		preferences,
		roster,
		sections,
		serverEnvironment,
		spaceConnections,
		spaceEnvironment,
		spaceMcpServers,
		spacePlugin,
		spaces,
		spokenWords,
		store,
		user,
		userConnections,
		userMcpServers,
		userPlugin,
	}
}

export type WorkspaceCore = ReturnType<typeof useWorkspaceCore>
