"use client"

import { Tabs } from "@base-ui/react/tabs"
import { useTranslation } from "react-i18next"

import { DangerZone } from "@workspace/ui/components/bot-settings-dialog/danger-zone"
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
import { Button } from "@workspace/ui/components/ui/button"

const FIRST_TAB = "space"

const DANGER_TAB = "danger"

type SpaceSettingsDialogProps = PluginSessionsProps & {
	open: boolean
	onClose: () => void
	value: SpaceSettingsValue
	onValueChange: (value: SpaceSettingsValue) => void
	environment: EnvironmentEntry[]
	hasEnvironmentFailedToRead?: boolean
	onEnvironmentSet: (write: EnvironmentWrite) => void | Promise<void>
	onEnvironmentDelete: (name: string) => void | Promise<void>
	tab?: string
	history: PluginHistory
	onDelete: () => void
	isDeletable?: boolean
	onExport?: () => void
	onImport?: () => void
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
	tab,
	history,
	onDelete,
	isDeletable = true,
	onExport,
	onImport,
	className,
	...sessionProps
}: SpaceSettingsDialogProps) => {
	const { t } = useTranslation("settings")
	const spaceName = value.name.trim() || t("space.untitled")
	const { pages, sessions } = usePluginSessions({
		...sessionProps,
		owner: { kind: "space", name: spaceName },
		isSettingsOpen: open,
		history,
		historyCompanionName: t("plugin.author.bot"),
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
			sessions={sessions}
			tab={tab ?? FIRST_TAB}
		>
			<SettingsScrollingPanel value={FIRST_TAB}>
				<SpaceFields onValueChange={onValueChange} value={value} />
				{onExport || onImport ? (
					<div className="flex flex-wrap gap-2" data-slot="space-transfer">
						{onExport ? (
							<Button onClick={() => onExport()} size="sm" variant="outline">
								{t("space.transfer.export")}
							</Button>
						) : null}
						{onImport ? (
							<Button onClick={() => onImport()} size="sm" variant="outline">
								{t("space.transfer.import")}
							</Button>
						) : null}
					</div>
				) : null}
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
				{sessions.skills.panel}
			</Tabs.Panel>

			<Tabs.Panel className={SETTINGS_PANEL_CLASS} value="mcp">
				{sessions.applications.panel}
			</Tabs.Panel>

			<SettingsScrollingPanel isFlush value={HISTORY_TAB}>
				{sessions.history.panel}
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
