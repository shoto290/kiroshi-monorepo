import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { CompanionMenuProvider } from "@workspace/ui/components/companion-menu"
import { CompanionSelectProvider } from "@workspace/ui/components/companion-select"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"
import { probeRender } from "@workspace/ui/lib/render-probe"

import { AppDialogs } from "@/components/app-dialogs"
import { StartupScreen } from "@/components/startup-screen"
import { WorkspaceBody } from "@/components/workspace-body"
import { ConversationApplicationsContext } from "@/lib/applications/use-conversation-installs"
import { SessionApplicationsContext } from "@/lib/applications/use-session-application"
import { ConversationSeatingContext } from "@/lib/conversations/use-conversation-seating"
import { hasOverlayWindowControls, isSidebarResizable } from "@/lib/host"
import { useCompanionMenuLookup } from "@/lib/sidebar/companion-menu"
import { useCompanionSelectGuard } from "@/lib/sidebar/companion-select"
import { useApplicationScopes } from "@/lib/workspace/use-application-scopes"
import { useRosterLines } from "@/lib/workspace/use-roster-lines"
import { useRosterLists } from "@/lib/workspace/use-roster-lists"
import { useRosterView } from "@/lib/workspace/use-roster-view"
import { useSettingsPanels } from "@/lib/workspace/use-settings-panels"
import { useSpaceLoading } from "@/lib/workspace/use-space-loading"
import { useSpaceSections } from "@/lib/workspace/use-space-sections"
import { useWorkspaceCore } from "@/lib/workspace/use-workspace-core"
import { useWorkspaceDrivers } from "@/lib/workspace/use-workspace-drivers"
import { useWorkspaceOverlay } from "@/lib/workspace/use-workspace-overlay"
import { useWorkspaceSubscriptions } from "@/lib/workspace/use-workspace-subscriptions"

export function App() {
	probeRender("App")
	const core = useWorkspaceCore()
	const drivers = useWorkspaceDrivers(core)
	const rosterView = useRosterView({ core, drivers })
	const scopes = useApplicationScopes(core)
	const panels = useSettingsPanels({ core, rosterView, scopes })
	const loadSpaces = useSpaceLoading({ core, scopes })
	useWorkspaceSubscriptions({ core, drivers, rosterView, scopes })
	const rosterLines = useRosterLines({ core, drivers, rosterView })
	const collapsedSectionIds = useSpaceSections({ core, rosterLines })
	const rosterLists = useRosterLists({ core, drivers, rosterLines, rosterView })
	const overlay = useWorkspaceOverlay({ core, rosterLines, rosterView, scopes })
	const companionMenu = useCompanionMenuLookup({
		actions: rosterLines.sidebarActions,
		conversationRosters: core.roster.state.conversationRosters,
		openSpaceId: scopes.selectedSpaceId ?? null,
		rosters: core.roster.state.rosters,
		sectionsBySpaceId: core.sections.state.sections,
		spaces: core.spaces.state.spaces,
	})
	const selectCompanion = useCompanionSelectGuard({
		openSpaceId: scopes.selectedSpaceId ?? null,
		rosters: core.roster.state.rosters,
		select: core.roster.controller.select,
		leaveMission: core.openedMission.leave,
	})

	const { preferences, roster, spaces } = core

	if (!rosterView.hasLoaded) {
		return (
			<StartupScreen
				haveSpacesFailed={spaces.state.hasFailedToLoad}
				onRetrySpaces={loadSpaces}
			/>
		)
	}

	return (
		<>
			<WorkspaceShell
				defaultOpen
				spaceTint={scopes.selectedSpace?.colour}
				width={preferences.sidebarWidth ?? undefined}
				onWidthChange={overlay.changeSidebarWidth}
				isResizable={isSidebarResizable()}
				sidebar={
					<AppSidebar
						data-tauri-drag-region="deep"
						insetWindowControls={hasOverlayWindowControls()}
						bots={rosterLines.rosterBots}
						haveBotsFailedToLoad={roster.state.hasFailedToLoad}
						botsBySpaceId={rosterLists.rosterBotsBySpace}
						conversations={rosterLists.rosterConversations}
						conversationsBySpaceId={rosterLists.rosterConversationsBySpace}
						badgesBySpaceId={rosterLists.badgesBySpaceId}
						collapsedSectionIds={collapsedSectionIds}
						sectionsBySpaceId={core.sections.state.sections}
						footer={rosterLines.updateBadge}
						isSpaceSwitchingEnabled={!overlay.isOverlayOpen}
						onOpenSearch={overlay.search.open}
						{...rosterLines.sidebarActions}
						onCreateConversation={rosterLines.startConversation}
						selectedBotId={rosterView.selectedBotId ?? undefined}
						selectedConversationId={
							rosterView.selectedConversationId ?? undefined
						}
						selectedSpaceId={scopes.selectedSpaceId ?? undefined}
						spaces={spaces.state.spaces}
						user={overlay.userSettings}
					/>
				}
			>
				<ConversationSeatingContext.Provider
					value={rosterLines.conversationSeating}
				>
					<CompanionMenuProvider menuFor={companionMenu}>
						<CompanionSelectProvider onSelect={selectCompanion}>
							<SessionApplicationsContext.Provider
								value={panels.sessionApplications}
							>
								<ConversationApplicationsContext.Provider
									value={panels.conversationApplications}
								>
									<WorkspaceBody
										activityPanel={overlay.activityPanel}
										attachments={core.attachments}
										bot={rosterView.selected}
										bots={rosterView.bots}
										chat={core.chat}
										conversation={rosterView.selectedConversation}
										conversationRuntimes={core.conversationRuntimes}
										drafts={core.drafts}
										haveSpacesFailed={spaces.state.hasFailedToLoad}
										isConversationSettingsOpen={
											overlay.isThreadConversationSettingsOpen
										}
										isOverlayOpen={overlay.isOverlayOpen}
										isSettingsOpen={overlay.isThreadSettingsOpen}
										landings={core.messageLandings}
										missions={core.openedMission}
										onboarding={
											preferences.firstRunDone ? undefined : drivers.onboarding
										}
										onOpenConversationSettings={
											roster.controller.editConversation
										}
										onRetrySpaces={loadSpaces}
										onToggleSettings={overlay.toggleSettings}
										readerName={preferences.displayName}
										signIn={drivers.signIn}
									/>
								</ConversationApplicationsContext.Provider>
							</SessionApplicationsContext.Provider>
						</CompanionSelectProvider>
					</CompanionMenuProvider>
				</ConversationSeatingContext.Provider>
			</WorkspaceShell>
			<AppDialogs
				core={core}
				overlay={overlay}
				panels={panels}
				rosterLines={rosterLines}
				rosterLists={rosterLists}
				rosterView={rosterView}
				scopes={scopes}
			/>
		</>
	)
}
