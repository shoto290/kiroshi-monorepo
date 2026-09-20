import { NoticeSurface } from "@workspace/ui/components/notice-surface"
import { SearchPalette } from "@workspace/ui/components/search-palette"

import { BotSettingsHost } from "@/components/bot-settings-host"
import { ConversationSettingsHost } from "@/components/conversation-settings-host"
import { SpaceSettingsHost } from "@/components/space-settings-host"
import { UserSettingsHost } from "@/components/user-settings-host"
import type { ApplicationScopes } from "@/lib/workspace/use-application-scopes"
import type { RosterLines } from "@/lib/workspace/use-roster-lines"
import type { RosterLists } from "@/lib/workspace/use-roster-lists"
import type { RosterView } from "@/lib/workspace/use-roster-view"
import type { SettingsPanels } from "@/lib/workspace/use-settings-panels"
import type { WorkspaceCore } from "@/lib/workspace/use-workspace-core"
import type { WorkspaceOverlay } from "@/lib/workspace/use-workspace-overlay"

type AppDialogsProps = {
	core: WorkspaceCore
	overlay: WorkspaceOverlay
	panels: SettingsPanels
	rosterLines: RosterLines
	rosterLists: RosterLists
	rosterView: RosterView
	scopes: ApplicationScopes
}

export const AppDialogs = ({
	core,
	overlay,
	panels,
	rosterLines,
	rosterLists,
	rosterView,
	scopes,
}: AppDialogsProps) => (
	<>
		<BotSettingsHost
			core={core}
			panels={panels}
			rosterLines={rosterLines}
			rosterView={rosterView}
			scopes={scopes}
		/>
		<ConversationSettingsHost
			core={core}
			rosterLines={rosterLines}
			rosterLists={rosterLists}
			rosterView={rosterView}
		/>
		<SpaceSettingsHost core={core} panels={panels} scopes={scopes} />
		<UserSettingsHost
			core={core}
			overlay={overlay}
			panels={panels}
			scopes={scopes}
		/>
		<SearchPalette {...overlay.search.palette} />
		<NoticeSurface />
	</>
)
