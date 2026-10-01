import { SpaceSettingsDialog } from "@workspace/ui/components/space-settings-dialog"

import { toEnvironmentRows } from "@/lib/environment/environment-rows"
import { useShareLink } from "@/lib/host/use-share-link"
import { toSpaceSettingsValue } from "@/lib/spaces/space-settings"
import type { ApplicationScopes } from "@/lib/workspace/use-application-scopes"
import type { SettingsPanels } from "@/lib/workspace/use-settings-panels"
import type { WorkspaceCore } from "@/lib/workspace/use-workspace-core"

type SpaceSettingsHostProps = {
	core: WorkspaceCore
	panels: SettingsPanels
	scopes: ApplicationScopes
}

export const SpaceSettingsHost = ({
	core,
	panels,
	scopes,
}: SpaceSettingsHostProps) => {
	const { spaceEnvironment, spaceMcpServers, spaces } = core
	const { applicationToOpenOn, closeSettingsTab, spaceHistory, spaceSkills } =
		panels
	const {
		isSpaceEditing,
		selectedSpace,
		serverEnvironmentSection,
		setOpenedMcpServer,
		settingsTab,
		spaceApplications,
	} = scopes
	const shareLink = useShareLink(isSpaceEditing)

	return selectedSpace ? (
		<SpaceSettingsDialog
			environment={toEnvironmentRows(spaceEnvironment.state.entries)}
			hasEnvironmentFailedToRead={spaceEnvironment.state.hasFailedToRead}
			haveMcpServersFailedToLoad={spaceMcpServers.state.hasFailedToLoad}
			{...spaceApplications}
			mcpServerToOpen={applicationToOpenOn({
				kind: "space",
				id: selectedSpace.id,
			})}
			tab={settingsTab}
			onMcpServerOpen={(name) =>
				setOpenedMcpServer(
					name
						? {
								kind: "server",
								name,
								owner: { kind: "space", id: selectedSpace.id },
							}
						: null,
				)
			}
			serverEnvironment={serverEnvironmentSection}
			history={spaceHistory}
			isDeletable={spaces.state.spaces.length > 1}
			onClose={() => {
				closeSettingsTab()
				spaces.controller.setSettingsOpen(false)
			}}
			onDelete={() => {
				void spaces.controller.remove(selectedSpace.id)
			}}
			onExport={() => {
				void spaces.controller.exportSpace(selectedSpace.id)
			}}
			onImport={() => {
				void spaces.controller.importSpace()
			}}
			onEnvironmentDelete={spaceEnvironment.controller.remove}
			onEnvironmentSet={({ name, value }) =>
				spaceEnvironment.controller.set(name, value)
			}
			onValueChange={(value) =>
				spaces.controller.describe(selectedSpace.id, value)
			}
			open={isSpaceEditing}
			shareLink={shareLink}
			{...spaceSkills}
			value={toSpaceSettingsValue(selectedSpace)}
		/>
	) : null
}
