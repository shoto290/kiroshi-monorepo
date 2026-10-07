import type { EnvironmentWrite } from "@workspace/ui/components/environment-panel"
import type { SpaceSettingsValue } from "@workspace/ui/components/space-settings"
import { SpaceSettingsDialog } from "@workspace/ui/components/space-settings-dialog"

import { toEnvironmentRows } from "@/lib/environment/environment-rows"
import { useHosting } from "@/lib/host/use-hosting"
import { useShareLink } from "@/lib/host/use-share-link"
import { joinedSpaceOfRow } from "@/lib/spaces/joined-spaces-controller"
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
	const { joinedSpaces, spaceEnvironment, spaceMcpServers, spaces } = core
	const {
		applicationToOpenOn,
		closeSettingsTab,
		openAccountSettings,
		spaceHistory,
		spaceSkills,
	} = panels
	const {
		isSpaceEditing,
		selectedSpace,
		selectedSpaceId,
		serverEnvironmentSection,
		setOpenedMcpServer,
		settingsTab,
		spaceApplications,
	} = scopes
	const shareLink = useShareLink(
		isSpaceEditing ? (selectedSpace?.id ?? null) : null,
	)
	const hosting = useHosting(
		isSpaceEditing && selectedSpace
			? { id: selectedSpace.id, name: selectedSpace.name }
			: null,
	)
	const joinedSpace = joinedSpaceOfRow(
		joinedSpaces.state.joinedSpaces,
		selectedSpaceId,
	)

	if (!selectedSpaceId) {
		return null
	}

	const close = () => {
		closeSettingsTab()
		spaces.controller.setSettingsOpen(false)
	}

	const closeIfDeleted = (spaceId: string) => {
		const isStillHeld = spaces.controller
			.getState()
			.spaces.some((space) => space.id === spaceId)
		if (!isStillHeld) {
			close()
		}
	}

	const signIn = () => {
		close()
		openAccountSettings()
	}

	const hostingProps = hosting ? { ...hosting, onSignIn: signIn } : {}

	const sharedProps = {
		environment: toEnvironmentRows(spaceEnvironment.state.entries),
		hasEnvironmentFailedToRead: spaceEnvironment.state.hasFailedToRead,
		haveMcpServersFailedToLoad: spaceMcpServers.state.hasFailedToLoad,
		...spaceApplications,
		mcpServerToOpen: applicationToOpenOn({
			kind: "space",
			id: selectedSpaceId,
		}),
		tab: settingsTab,
		onMcpServerOpen: (name: string | null) =>
			setOpenedMcpServer(
				name
					? {
							kind: "server",
							name,
							owner: { kind: "space", id: selectedSpaceId },
						}
					: null,
			),
		serverEnvironment: serverEnvironmentSection,
		history: spaceHistory,
		onClose: close,
		onEnvironmentDelete: spaceEnvironment.controller.remove,
		onEnvironmentSet: ({ name, value }: EnvironmentWrite) =>
			spaceEnvironment.controller.set(name, value),
		onValueChange: (value: SpaceSettingsValue) =>
			spaces.controller.describe(selectedSpaceId, value),
		open: isSpaceEditing,
		...spaceSkills,
	}

	if (selectedSpace) {
		return (
			<SpaceSettingsDialog
				{...sharedProps}
				{...hostingProps}
				isDeletable={spaces.state.spaces.length > 1}
				onDelete={() => {
					void spaces.controller
						.remove(selectedSpace.id)
						.then(() => closeIfDeleted(selectedSpace.id))
				}}
				onExport={() => {
					void spaces.controller.exportSpace(selectedSpace.id)
				}}
				onImport={() => {
					void spaces.controller.importSpace()
				}}
				shareLink={shareLink}
				value={toSpaceSettingsValue(selectedSpace)}
			/>
		)
	}

	return joinedSpace ? (
		<SpaceSettingsDialog
			{...sharedProps}
			host={joinedSpace.hostUrl}
			onLeave={() => joinedSpaces.controller.leave(joinedSpace.id).then(close)}
			value={{ name: joinedSpace.name }}
		/>
	) : null
}
