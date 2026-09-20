import { useMemo } from "react"

import type { WorkspaceCore } from "./use-workspace-core"

import { useEvolution } from "../bots/use-evolution"
import { useBotBadges } from "../chat/use-bot-badges"
import { useCompanionSpokeDriver } from "../conversations/use-companion-spoke-driver"
import { useConversationBadges } from "../conversations/use-conversation-badges"
import { useExternalLinks } from "../links/use-external-links"
import { useMissionBoard } from "../missions/use-mission-board"
import { useMissionRunDriver } from "../missions/use-mission-run-driver"
import { useWaitingMissions } from "../missions/use-waiting-missions"
import { useNotifications } from "../notifications/use-notifications"
import { onboardingTransport } from "../onboarding/onboarding-transport"
import { signInWorldOf } from "../onboarding/sign-in-controller"
import { useOnboarding } from "../onboarding/use-onboarding"
import { useSignIn } from "../onboarding/use-sign-in"
import { useRunDriver } from "../routines/use-run-driver"
import { useUpdater } from "../updater/use-updater"

export const useWorkspaceDrivers = (core: WorkspaceCore) => {
	const {
		chat,
		companionPlugin,
		conversationRuntimes,
		driver,
		openedMission,
		roster,
		spacePlugin,
		spaces,
		spokenWords,
		store,
		user,
		userPlugin,
	} = core

	const onboarding = useOnboarding(onboardingTransport, {
		homeBotId: () => roster.controller.getState().selectedBotId,
		send: chat.controller.send,
		greet: async (botId, text) => {
			await chat.controller.openAside(
				botId,
				roster.controller.getState().spaceId,
			)
			await chat.controller.sendTo(botId, text)
		},
		markFirstRunDone: user.controller.markFirstRunDone,
	})
	const signIn = useSignIn(
		onboardingTransport,
		signInWorldOf({
			chat: chat.controller,
			selectedBotId: () => roster.controller.getState().selectedBotId,
		}),
	)

	const updater = useUpdater()

	useExternalLinks()

	useRunDriver({
		driver,
		store,
		runtimes: conversationRuntimes,
		chat: chat.controller,
	})

	useMissionRunDriver({
		driver,
		store,
		runtimes: conversationRuntimes,
		chat: chat.controller,
	})

	useCompanionSpokeDriver({
		runtimes: conversationRuntimes,
		roster: roster.controller,
		spokenWords,
	})

	useNotifications({
		chat: chat.controller,
		runtimes: conversationRuntimes,
		roster: roster.controller,
		spaces: spaces.controller,
		missions: openedMission,
		spokenWords,
		user: user.controller,
	})

	useEvolution({
		driver,
		roster: roster.controller,
		companionPlugin: companionPlugin.controller,
		userPlugin: userPlugin.controller,
		spacePlugin: spacePlugin.controller,
	})

	const badges = useBotBadges({
		chat: chat.controller,
		roster: roster.controller,
	})

	const missionBoard = useMissionBoard()
	const openMissions = useMemo(
		() => missionBoard.map(({ mission }) => mission),
		[missionBoard],
	)
	const waitingMissionIds = useWaitingMissions(
		conversationRuntimes,
		openMissions,
	)

	const conversationBadges = useConversationBadges({
		runtimes: conversationRuntimes,
		roster: roster.controller,
		spokenWords,
	})

	return {
		badges,
		conversationBadges,
		missionBoard,
		onboarding,
		signIn,
		updater,
		waitingMissionIds,
	}
}

export type WorkspaceDrivers = ReturnType<typeof useWorkspaceDrivers>
