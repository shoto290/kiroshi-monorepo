import { useCommandShortcut } from "@workspace/ui/hooks/use-command-shortcut"

export type WorkspaceShortcuts = {
	isEnabled: boolean
	onOpenUserSettings: () => void
	selectedBotId: string | null
	onStartConversation: (botIds: string[]) => void
}

export const useWorkspaceShortcuts = ({
	isEnabled,
	selectedBotId,
	onOpenUserSettings,
	onStartConversation,
}: WorkspaceShortcuts) => {
	useCommandShortcut({
		chordKey: ",",
		isEnabled,
		onPress: onOpenUserSettings,
	})

	useCommandShortcut({
		chordKey: "n",
		isEnabled,
		onPress: () => onStartConversation(selectedBotId ? [selectedBotId] : []),
	})
}
