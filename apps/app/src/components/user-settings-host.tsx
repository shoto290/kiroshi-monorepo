import { UserSettingsDialog } from "@workspace/ui/components/user-settings-dialog"

import { openedServerScope } from "@/lib/applications/application-settings"
import { toNotificationChange } from "@/lib/user/user-settings"
import type { ApplicationScopes } from "@/lib/workspace/use-application-scopes"
import type { SettingsPanels } from "@/lib/workspace/use-settings-panels"
import type { WorkspaceCore } from "@/lib/workspace/use-workspace-core"
import type { WorkspaceOverlay } from "@/lib/workspace/use-workspace-overlay"
import { USER_OWNER } from "@/lib/workspace/user-owner"

type UserSettingsHostProps = {
	core: WorkspaceCore
	overlay: WorkspaceOverlay
	panels: SettingsPanels
	scopes: ApplicationScopes
}

export const UserSettingsHost = ({
	core,
	overlay,
	panels,
	scopes,
}: UserSettingsHostProps) => {
	const { preferences, user, userMcpServers } = core
	const { userSettings } = overlay
	const { applicationToOpenOn, closeSettingsTab, personSkills, userHistory } =
		panels
	const {
		serverEnvironmentSection,
		setOpenedMcpServer,
		settingsTab,
		userApplications,
	} = scopes

	return (
		<UserSettingsDialog
			applications={{
				servers: userApplications.mcpServers,
				haveFailedToLoad: userMcpServers.state.hasFailedToLoad,
				onServerCreate: userApplications.onMcpServerCreate,
				onServerChange: userApplications.onMcpServerChange,
				onServerDelete: userApplications.onMcpServerDelete,
				onServerConnect: userApplications.onServerConnect,
				onServerOpen: (name) =>
					setOpenedMcpServer(openedServerScope(name, USER_OWNER)),
				serverConnection: userApplications.serverConnection,
				serverEnvironment: serverEnvironmentSection,
				catalogue: userApplications.mcpCatalogue,
				serverToOpen: applicationToOpenOn({ kind: "user" }),
			}}
			history={userHistory}
			tab={settingsTab}
			onClose={() => {
				closeSettingsTab()
				user.controller.setSettingsOpen(false)
			}}
			language={preferences.language}
			onLanguageChange={(next) => {
				void user.controller.setLanguage(next)
			}}
			onPictureRemove={() => {
				void user.controller.removePicture()
			}}
			onPictureUpload={(file) => {
				void user.controller.uploadPicture(file)
			}}
			onValueChange={(value) => {
				if (value.name !== userSettings.name) {
					user.controller.rename(value.name)
				}
				if (value.colorScheme !== userSettings.colorScheme) {
					void user.controller.setColorScheme(value.colorScheme)
				}
				const notification = toNotificationChange(value, userSettings)
				if (notification) {
					void user.controller.setNotification(notification)
				}
			}}
			open={user.state.isSettingsOpen}
			{...personSkills}
			value={userSettings}
		/>
	)
}
