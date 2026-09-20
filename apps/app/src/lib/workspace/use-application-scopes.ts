import { useMemo, useState } from "react"

import type { WorkspaceCore } from "./use-workspace-core"

import { reloadPanelsHolding } from "../applications/application-panels"
import {
	applicationTitleOf,
	toApplicationScope,
	toServerEnvironmentSection,
} from "../applications/application-settings"
import { applicationTransport } from "../applications/application-transport"
import { createSessionReopener } from "../applications/session-reopening"
import type { SettingsTarget } from "../applications/settings-target"
import { useApplicationInstalls } from "../applications/use-application-installs"
import { useApplicationMarks } from "../applications/use-application-marks"
import type { EnvScope } from "../conversations/store-contract"

export const useApplicationScopes = (core: WorkspaceCore) => {
	const {
		applications,
		botConnections,
		botMcpServers,
		chat,
		roster,
		serverEnvironment,
		spaceConnections,
		spaceMcpServers,
		spaces,
		userConnections,
		userMcpServers,
	} = core

	const [openedMcpServer, setOpenedMcpServer] = useState<EnvScope | null>(null)
	const [settingsTab, setSettingsTab] = useState<string>()
	const [settingsApplication, setSettingsApplication] =
		useState<SettingsTarget>()
	const openedServerName =
		openedMcpServer?.kind === "server" ? openedMcpServer.name : null

	const { selectedSpaceId, isSettingsOpen: isSpaceEditing } = spaces.state
	const selectedSpace = spaces.state.spaces.find(
		(space) => space.id === selectedSpaceId,
	)

	const reopenSessions = useMemo(
		() =>
			createSessionReopener({
				chat: chat.controller,
				rosters: () => roster.controller.getState().rosters,
			}),
		[chat.controller, roster.controller],
	)

	useApplicationInstalls(applicationTransport, ({ application, scope }) => {
		void reloadPanelsHolding(scope, [
			botMcpServers.controller,
			spaceMcpServers.controller,
			userMcpServers.controller,
		])
		void reopenSessions({
			scope,
			application: applicationTitleOf(
				applications.controller.getState().curated,
				application,
			),
		})
	})

	useApplicationMarks(applications.controller, [
		...userMcpServers.state.servers,
		...spaceMcpServers.state.servers,
		...botMcpServers.state.servers,
	])

	const serverEnvironmentSection = toServerEnvironmentSection({
		environment: serverEnvironment,
		opened: openedMcpServer,
		curated: applications.state.curated,
		reopen: reopenSessions,
	})

	const userApplications = toApplicationScope({
		applications,
		servers: userMcpServers,
		connections: userConnections,
		openedName: openedServerName,
		reopen: reopenSessions,
	})

	const spaceApplications = toApplicationScope({
		applications,
		servers: spaceMcpServers,
		connections: spaceConnections,
		openedName: openedServerName,
		reopen: reopenSessions,
	})

	const botApplications = toApplicationScope({
		applications,
		servers: botMcpServers,
		connections: botConnections,
		openedName: openedServerName,
		reopen: reopenSessions,
	})

	return {
		botApplications,
		isSpaceEditing,
		openedMcpServer,
		selectedSpace,
		selectedSpaceId,
		serverEnvironmentSection,
		setOpenedMcpServer,
		setSettingsApplication,
		setSettingsTab,
		settingsApplication,
		settingsTab,
		spaceApplications,
		userApplications,
	}
}

export type ApplicationScopes = ReturnType<typeof useApplicationScopes>
