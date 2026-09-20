import { ConversationSettingsDialog } from "@workspace/ui/components/conversation-settings-dialog"

import {
	leadOf,
	toConversationSettingsValue,
} from "@/lib/conversations/roster-conversations"
import type { RosterLines } from "@/lib/workspace/use-roster-lines"
import type { RosterLists } from "@/lib/workspace/use-roster-lists"
import type { RosterView } from "@/lib/workspace/use-roster-view"
import type { WorkspaceCore } from "@/lib/workspace/use-workspace-core"

type ConversationSettingsHostProps = {
	core: WorkspaceCore
	rosterLines: RosterLines
	rosterLists: RosterLists
	rosterView: RosterView
}

export const ConversationSettingsHost = ({
	core,
	rosterLines,
	rosterLists,
	rosterView,
}: ConversationSettingsHostProps) => {
	const { roster } = core
	const { sidebarActions } = rosterLines
	const { seatedBots } = rosterLists
	const { isEditingConversation, settingsConversation } = rosterView

	return settingsConversation ? (
		<ConversationSettingsDialog
			leadId={leadOf(settingsConversation) ?? ""}
			onClose={() => roster.controller.setConversationEditing(false)}
			onDelete={() => {
				void sidebarActions.onDeleteConversation(settingsConversation.id)
			}}
			onDismiss={(botId) => {
				void roster.controller.dismissFromConversation(
					settingsConversation.id,
					botId,
				)
			}}
			onLeadChange={(botId) => {
				void roster.controller.setConversationLead(
					settingsConversation.id,
					botId,
				)
			}}
			onValueChange={(value) =>
				roster.controller.describeConversation(settingsConversation.id, value)
			}
			open={isEditingConversation}
			participants={seatedBots}
			value={toConversationSettingsValue(settingsConversation)}
		/>
	) : null
}
