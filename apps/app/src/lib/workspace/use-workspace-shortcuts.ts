import { useCommandShortcut } from "@workspace/ui/hooks/use-command-shortcut"

export type WorkspaceShortcuts = {
	isEnabled: boolean
	onOpenUserSettings: () => void
	onStartConversation: () => void
}

export const useWorkspaceShortcuts = ({
	isEnabled,
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
		onPress: onStartConversation,
	})
}
