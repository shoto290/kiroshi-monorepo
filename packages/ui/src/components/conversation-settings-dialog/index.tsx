"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useTranslation } from "react-i18next"

import { DangerZone } from "@workspace/ui/components/bot-settings-dialog/danger-zone"
import { ParticipantsPanel } from "@workspace/ui/components/conversation-settings-dialog/participants-panel"
import { Icons } from "@workspace/ui/components/icons"
import type { RosterBot } from "@workspace/ui/components/roster"
import { SettingsDialogShell } from "@workspace/ui/components/settings-dialog-shell"
import { SettingsField } from "@workspace/ui/components/settings-field"
import {
	DANGER_RAIL_ITEM_CLASS,
	SETTINGS_PANEL_CLASS,
	SettingsRailItem,
	SettingsRailSeparator,
	SettingsScrollingPanel,
} from "@workspace/ui/components/settings-rail"

const FIRST_TAB = "general"

const DANGER_TAB = "danger"

type ConversationSettingsValue = {
	name: string
	instructions: string
}

type ConversationSettingsDialogProps = {
	open: boolean
	onClose: () => void
	value: ConversationSettingsValue
	onValueChange: (value: ConversationSettingsValue) => void
	participants: RosterBot[]
	leadId: string
	onLeadChange: (id: string) => void
	onDismiss: (id: string) => void
	onDelete: () => void
	className?: string
}

const ConversationSettingsDialog = ({
	open,
	onClose,
	value,
	onValueChange,
	participants,
	leadId,
	onLeadChange,
	onDismiss,
	onDelete,
	className,
}: ConversationSettingsDialogProps) => {
	const { t } = useTranslation("chat")
	const conversationName =
		value.name.trim() || t("conversationSettings.untitled")

	const patch = (fields: Partial<ConversationSettingsValue>) =>
		onValueChange({ ...value, ...fields })

	return (
		<SettingsDialogShell
			breadcrumb={t("conversationSettings.breadcrumb")}
			className={className}
			mark={
				<Icons.Message
					aria-hidden="true"
					className="size-5 shrink-0 text-muted-foreground"
				/>
			}
			name={conversationName}
			onClose={onClose}
			open={open}
			rail={(iconsOnly) => (
				<>
					<SettingsRailItem
						icon={Icons.Settings}
						iconsOnly={iconsOnly}
						label={t("conversationSettings.tab.general")}
						value={FIRST_TAB}
					/>
					<SettingsRailItem
						icon={Icons.User}
						iconsOnly={iconsOnly}
						label={t("conversationSettings.tab.participants")}
						value="participants"
					/>
					<SettingsRailItem
						icon={Icons.Docs}
						iconsOnly={iconsOnly}
						label={t("conversationSettings.tab.instructions")}
						value="instructions"
					/>
					<SettingsRailSeparator />
					<SettingsRailItem
						className={DANGER_RAIL_ITEM_CLASS}
						icon={Icons.Alert}
						iconsOnly={iconsOnly}
						label={t("conversationSettings.tab.danger")}
						value={DANGER_TAB}
					/>
				</>
			)}
			tab={FIRST_TAB}
		>
			<SettingsScrollingPanel value={FIRST_TAB}>
				<SettingsField
					label={t("conversationSettings.name.label")}
					onValueChange={(name) => patch({ name })}
					placeholder={t("conversationSettings.name.placeholder")}
					value={value.name}
				/>
			</SettingsScrollingPanel>

			<SettingsScrollingPanel value="participants">
				<ParticipantsPanel
					leadId={leadId}
					onDismiss={onDismiss}
					onLeadChange={onLeadChange}
					participants={participants}
				/>
			</SettingsScrollingPanel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="instructions">
				<SettingsField
					fill
					label={t("conversationSettings.instructions.label")}
					onValueChange={(instructions) => patch({ instructions })}
					placeholder={t("conversationSettings.instructions.placeholder")}
					value={value.instructions}
				/>
			</Tabs.Panel>

			<SettingsScrollingPanel value={DANGER_TAB}>
				<DangerZone
					confirmTitle={t("conversationSettings.danger.confirm.title", {
						name: conversationName,
					})}
					deleteLabel={t("conversationSettings.danger.delete")}
					description={t("conversationSettings.danger.description")}
					onDelete={onDelete}
				/>
			</SettingsScrollingPanel>
		</SettingsDialogShell>
	)
}

export {
	ConversationSettingsDialog,
	type ConversationSettingsDialogProps,
	type ConversationSettingsValue,
	type RosterBot,
}
