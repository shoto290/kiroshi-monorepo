"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useTranslation } from "react-i18next"

import type {
	BotMcpServerItem,
	BotSkillDraft,
	BotSkillItem,
} from "@workspace/ui/components/bot-settings"
import { DangerZone } from "@workspace/ui/components/bot-settings-dialog/danger-zone"
import type { McpConnectionSection } from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import {
	type EnvironmentEntry,
	EnvironmentPanel,
	type EnvironmentSection,
	type EnvironmentWrite,
} from "@workspace/ui/components/environment-panel"
import { Icons } from "@workspace/ui/components/icons"
import type { PluginHistory } from "@workspace/ui/components/plugin-settings/history-panel"
import type { SettingsPage } from "@workspace/ui/components/plugin-settings/settings-pages"
import type { PluginSkillFiles } from "@workspace/ui/components/plugin-settings/skill-files-panel"
import {
	HISTORY_TAB,
	useHistorySession,
} from "@workspace/ui/components/plugin-settings/use-history-session"
import {
	type ApplicationsCatalogueSection,
	useMcpSession,
} from "@workspace/ui/components/plugin-settings/use-mcp-session"
import { useSkillSession } from "@workspace/ui/components/plugin-settings/use-skill-session"
import { SettingsDialogShell } from "@workspace/ui/components/settings-dialog-shell"
import {
	DANGER_RAIL_ITEM_CLASS,
	SETTINGS_PANEL_CLASS,
	SettingsRailItem,
	SettingsRailSeparator,
	SettingsScrollingPanel,
} from "@workspace/ui/components/settings-rail"
import type { SpaceSettingsValue } from "@workspace/ui/components/space-settings"
import { SpaceFields } from "@workspace/ui/components/space-settings-dialog/space-fields"
import { SpaceTint } from "@workspace/ui/components/space-tint"
import { usePushedPages } from "@workspace/ui/hooks/use-pushed-pages"

const FIRST_TAB = "space"

const DANGER_TAB = "danger"

type SpaceSettingsDialogProps = {
	open: boolean
	onClose: () => void
	value: SpaceSettingsValue
	onValueChange: (value: SpaceSettingsValue) => void
	environment: EnvironmentEntry[]
	hasEnvironmentFailedToRead?: boolean
	onEnvironmentSet: (write: EnvironmentWrite) => void | Promise<void>
	onEnvironmentDelete: (name: string) => void | Promise<void>
	skills: BotSkillItem[]
	onSkillCreate: (draft: BotSkillDraft, isPreloaded: boolean) => void
	onSkillChange: (id: string, draft: BotSkillDraft) => void
	onSkillPreloadedChange: (id: string, isPreloaded: boolean) => void
	onSkillDelete: (id: string) => void
	skillFiles?: PluginSkillFiles
	mcpServers: BotMcpServerItem[]
	haveMcpServersFailedToLoad?: boolean
	onMcpServerCreate: (name: string, config: Record<string, unknown>) => void
	onMcpServerChange: (
		openedName: string,
		name: string,
		config: Record<string, unknown>,
	) => void
	onMcpServerDelete: (name: string) => void
	mcpCatalogue?: ApplicationsCatalogueSection
	onMcpServerOpen?: (name: string | null) => void
	onServerConnect?: (server: BotMcpServerItem) => void
	serverConnection?: McpConnectionSection
	serverEnvironment?: EnvironmentSection
	mcpServerToOpen?: string
	tab?: string
	history: PluginHistory
	onDelete: () => void
	isDeletable?: boolean
	className?: string
}

const SpaceSettingsDialog = ({
	open,
	onClose,
	value,
	onValueChange,
	environment,
	hasEnvironmentFailedToRead,
	onEnvironmentSet,
	onEnvironmentDelete,
	skills,
	onSkillCreate,
	onSkillChange,
	onSkillPreloadedChange,
	onSkillDelete,
	skillFiles,
	mcpServers,
	haveMcpServersFailedToLoad,
	onMcpServerCreate,
	onMcpServerChange,
	onMcpServerDelete,
	mcpCatalogue,
	onMcpServerOpen,
	onServerConnect,
	serverConnection,
	serverEnvironment,
	mcpServerToOpen,
	tab,
	history,
	onDelete,
	isDeletable = true,
	className,
}: SpaceSettingsDialogProps) => {
	const { t } = useTranslation("settings")
	const spaceName = value.name.trim() || t("space.untitled")
	const pages = usePushedPages<SettingsPage>()
	const skillSession = useSkillSession({
		pages,
		files: skillFiles,
		onSkillChange,
		onSkillCreate,
		onSkillDelete,
		onSkillPreloadedChange,
		skills,
	})
	const mcpSession = useMcpSession({
		pages,
		owner: { kind: "space", name: spaceName },
		catalogue: mcpCatalogue,
		servers: mcpServers,
		haveFailedToLoad: haveMcpServersFailedToLoad,
		onServerChange: onMcpServerChange,
		onServerCreate: onMcpServerCreate,
		onServerDelete: onMcpServerDelete,
		onServerOpen: onMcpServerOpen,
		onServerConnect,
		serverConnection,
		serverEnvironment,
		serverToOpen: mcpServerToOpen,
		isSettingsOpen: open,
	})
	const historySession = useHistorySession({
		pages,
		history,
		companionName: t("plugin.author.bot"),
	})

	return (
		<SettingsDialogShell
			breadcrumb={t("breadcrumb.title")}
			className={className}
			mark={<SpaceTint className="size-5" tint={value.colour} />}
			name={spaceName}
			onClose={onClose}
			open={open}
			pages={pages}
			rail={(iconsOnly) => (
				<>
					<SettingsRailItem
						icon={Icons.Folder}
						iconsOnly={iconsOnly}
						label={t("rail.space")}
						value={FIRST_TAB}
					/>
					<SettingsRailItem
						icon={Icons.Json}
						iconsOnly={iconsOnly}
						label={t("rail.secrets")}
						value="environment"
					/>
					<SettingsRailItem
						icon={Icons.Skill}
						iconsOnly={iconsOnly}
						label={t("rail.skills")}
						value="skills"
					/>
					<SettingsRailItem
						icon={Icons.Server}
						iconsOnly={iconsOnly}
						label={t("rail.applications")}
						value="mcp"
					/>
					<SettingsRailItem
						icon={Icons.History}
						iconsOnly={iconsOnly}
						label={t("rail.history")}
						value={HISTORY_TAB}
					/>
					<SettingsRailSeparator />
					<SettingsRailItem
						className={DANGER_RAIL_ITEM_CLASS}
						icon={Icons.Alert}
						iconsOnly={iconsOnly}
						label={t("rail.danger")}
						value={DANGER_TAB}
					/>
				</>
			)}
			sessions={{
				skills: skillSession,
				applications: mcpSession,
				history: historySession,
			}}
			tab={tab ?? FIRST_TAB}
		>
			<SettingsScrollingPanel value={FIRST_TAB}>
				<SpaceFields onValueChange={onValueChange} value={value} />
			</SettingsScrollingPanel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="environment">
				<EnvironmentPanel
					entries={environment}
					hasFailedToRead={hasEnvironmentFailedToRead}
					onDelete={onEnvironmentDelete}
					onSet={onEnvironmentSet}
					scope="space"
				/>
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="skills">
				{skillSession.panel}
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="mcp">
				{mcpSession.panel}
			</Tabs.Panel>

			<SettingsScrollingPanel isFlush value={HISTORY_TAB}>
				{historySession.panel}
			</SettingsScrollingPanel>

			<SettingsScrollingPanel value={DANGER_TAB}>
				<DangerZone
					confirmTitle={t("space.danger.confirm.title", {
						name: spaceName,
					})}
					deleteLabel={t("space.danger.delete")}
					description={t("space.danger.description")}
					disabledReason={isDeletable ? undefined : t("space.danger.last")}
					onDelete={onDelete}
				/>
			</SettingsScrollingPanel>
		</SettingsDialogShell>
	)
}

export {
	SpaceSettingsDialog,
	type SpaceSettingsDialogProps,
	type SpaceSettingsValue,
}
