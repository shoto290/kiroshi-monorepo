"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useTranslation } from "react-i18next"

import {
	type ActivityIndicatorKind,
	BotIdentityAvatar,
} from "@workspace/ui/components/bot-identity-avatar"
import { BotIdentityFields } from "@workspace/ui/components/bot-identity-fields"
import type {
	BotIdentity,
	BotMcpServerItem,
	BotModelOption,
	BotOutputStyle,
	BotPermissions,
	BotSettingsValue,
	BotSkillDraft,
	BotSkillItem,
} from "@workspace/ui/components/bot-settings"
import { DangerZone } from "@workspace/ui/components/bot-settings-dialog/danger-zone"
import { MemoryPanel } from "@workspace/ui/components/bot-settings-dialog/memory-panel"
import { PermissionsPanel } from "@workspace/ui/components/bot-settings-dialog/permissions-panel"
import { RuntimeFields } from "@workspace/ui/components/bot-settings-dialog/runtime-fields"
import {
	type EnvironmentEntry,
	EnvironmentPanel,
	type EnvironmentWrite,
} from "@workspace/ui/components/environment-panel"
import { Icons } from "@workspace/ui/components/icons"
import type { PluginHistory } from "@workspace/ui/components/plugin-settings/history-panel"
import { HISTORY_TAB } from "@workspace/ui/components/plugin-settings/use-history-session"
import type { PluginSessionsProps } from "@workspace/ui/components/plugin-settings/use-plugin-sessions"
import { usePluginSessions } from "@workspace/ui/components/plugin-settings/use-plugin-sessions"
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

type BotSettingsDialogProps = PluginSessionsProps & {
	open: boolean
	onClose: () => void
	value: BotSettingsValue
	onValueChange: (value: BotSettingsValue) => void
	models: BotModelOption[]
	outputStyle?: BotOutputStyle
	onOutputStyleChange?: (outputStyle: BotOutputStyle) => void
	memory?: string
	onMemoryChange?: (memory: string) => void
	onAvatarUpload: (file: File) => void
	onBrowseWorkingDirectory: () => void
	environment: EnvironmentEntry[]
	hasEnvironmentFailedToRead?: boolean
	onEnvironmentSet: (write: EnvironmentWrite) => void | Promise<void>
	onEnvironmentDelete: (name: string) => void | Promise<void>
	tab?: string
	history?: PluginHistory
	seed?: string
	shufflable?: boolean
	onDelete: () => void
	showDanger?: boolean
	working?: boolean
	workingKind?: ActivityIndicatorKind
	className?: string
}

const BotSettingsDialog = ({
	open,
	onClose,
	value,
	onValueChange,
	models,
	outputStyle,
	onOutputStyleChange,
	memory,
	onMemoryChange,
	onAvatarUpload,
	onBrowseWorkingDirectory,
	environment,
	hasEnvironmentFailedToRead,
	onEnvironmentSet,
	onEnvironmentDelete,
	tab,
	history,
	seed,
	shufflable,
	onDelete,
	showDanger,
	working = false,
	workingKind,
	className,
	...sessionProps
}: BotSettingsDialogProps) => {
	const { t } = useTranslation("bots")
	const botName = value.name.trim() || t("dialog.untitled")
	const { pages, sessions } = usePluginSessions({
		...sessionProps,
		owner: { kind: "companion", name: botName },
		isSettingsOpen: open,
		history,
		historyCompanion: value.identity,
		historyCompanionName: botName,
	})

	const patch = (fields: Partial<BotSettingsValue>) =>
		onValueChange({ ...value, ...fields })

	return (
		<SettingsDialogShell
			breadcrumb={t("dialog.breadcrumb")}
			className={className}
			hasSettingsShortcut
			mark={
				<BotIdentityAvatar
					animal={value.identity.animal}
					blot={value.identity.blot}
					image={value.identity.image}
					kind={workingKind}
					name={botName}
					seed={value.identity.seed ?? seed}
					size={32}
					working={working}
				/>
			}
			name={botName}
			onClose={onClose}
			open={open}
			pages={pages}
			rail={(iconsOnly) => (
				<>
					<SettingsRailItem
						icon={Icons.Settings}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.general")}
						value={FIRST_TAB}
					/>
					<SettingsRailItem
						icon={Icons.Image}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.appearance")}
						value="appearance"
					/>
					<SettingsRailItem
						icon={Icons.Docs}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.instructions")}
						value="instructions"
					/>
					<SettingsRailItem
						icon={Icons.Skill}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.skills")}
						value="skills"
					/>
					<SettingsRailItem
						icon={Icons.Server}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.applications")}
						value="mcp"
					/>
					<SettingsRailItem
						icon={Icons.Json}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.secrets")}
						value="environment"
					/>
					{history ? (
						<SettingsRailItem
							icon={Icons.History}
							iconsOnly={iconsOnly}
							label={t("dialog.tab.history")}
							value={HISTORY_TAB}
						/>
					) : null}
					<SettingsRailItem
						icon={Icons.Shield}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.approvals")}
						value="permissions"
					/>
					<SettingsRailItem
						icon={Icons.Terminal}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.runtime")}
						value="runtime"
					/>
					<SettingsRailSeparator />
					<SettingsRailItem
						className={DANGER_RAIL_ITEM_CLASS}
						icon={Icons.Alert}
						iconsOnly={iconsOnly}
						label={t("dialog.tab.danger")}
						value={DANGER_TAB}
					/>
				</>
			)}
			sessions={sessions}
			tab={showDanger ? DANGER_TAB : (tab ?? FIRST_TAB)}
		>
			<SettingsScrollingPanel value={FIRST_TAB}>
				<SettingsField
					label={t("dialog.name.label")}
					onValueChange={(name) => patch({ name })}
					placeholder={t("dialog.name.placeholder")}
					value={value.name}
				/>
				<SettingsField
					label={t("dialog.title.label")}
					onValueChange={(title) => patch({ title })}
					placeholder={t("dialog.title.placeholder")}
					value={value.title}
				/>
			</SettingsScrollingPanel>

			<SettingsScrollingPanel value="appearance">
				<BotIdentityFields
					identity={value.identity}
					name={botName}
					onAvatarUpload={onAvatarUpload}
					onIdentityChange={(identity: BotIdentity) => patch({ identity })}
					seed={seed}
					shufflable={shufflable}
					working={working}
					workingKind={workingKind}
				/>
			</SettingsScrollingPanel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="instructions">
				<SettingsField
					fill
					label={t("dialog.instructions.label")}
					onValueChange={(instructions) => patch({ instructions })}
					placeholder={t("dialog.instructions.placeholder")}
					value={value.instructions}
				/>
				{memory !== undefined ? (
					<MemoryPanel
						memory={memory}
						onSave={(next) => onMemoryChange?.(next)}
					/>
				) : null}
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="skills">
				{sessions.skills.panel}
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="mcp">
				{sessions.applications.panel}
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="environment">
				<EnvironmentPanel
					entries={environment}
					hasFailedToRead={hasEnvironmentFailedToRead}
					onDelete={onEnvironmentDelete}
					onSet={onEnvironmentSet}
					scope="bot"
				/>
			</Tabs.Panel>

			{history ? (
				<SettingsScrollingPanel isFlush value={HISTORY_TAB}>
					{sessions.history.panel}
				</SettingsScrollingPanel>
			) : null}

			<SettingsScrollingPanel value="permissions">
				<PermissionsPanel
					onPermissionsChange={(permissions: BotPermissions) =>
						patch({ permissions })
					}
					permissions={value.permissions}
				/>
			</SettingsScrollingPanel>

			<SettingsScrollingPanel value="runtime">
				<RuntimeFields
					model={value.model}
					models={models}
					onBrowseWorkingDirectory={onBrowseWorkingDirectory}
					onModelChange={(model) => patch({ model })}
					onOutputStyleChange={onOutputStyleChange}
					outputStyle={outputStyle}
					workingDirectory={value.workingDirectory}
				/>
			</SettingsScrollingPanel>

			<SettingsScrollingPanel value={DANGER_TAB}>
				<DangerZone
					confirmTitle={t("danger.confirm.title", { name: botName })}
					deleteLabel={t("danger.delete")}
					description={t("danger.description")}
					onDelete={onDelete}
				/>
			</SettingsScrollingPanel>
		</SettingsDialogShell>
	)
}

export {
	type BotMcpServerItem,
	type BotModelOption,
	type BotOutputStyle,
	type BotPermissions,
	BotSettingsDialog,
	type BotSettingsDialogProps,
	type BotSettingsValue,
	type BotSkillDraft,
	type BotSkillItem,
	type PluginHistory,
}
