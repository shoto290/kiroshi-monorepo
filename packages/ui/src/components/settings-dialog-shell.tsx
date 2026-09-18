"use client"

import { Tabs } from "@base-ui/react/tabs"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { DialogSurface } from "@workspace/ui/components/dialog-surface"
import { Icons } from "@workspace/ui/components/icons"
import type {
	SessionPages,
	SettingsPages,
} from "@workspace/ui/components/plugin-settings/settings-pages"
import {
	RAIL_LABELS_MIN_WIDTH,
	SettingsRail,
} from "@workspace/ui/components/settings-rail"
import { SETTINGS_HEADER_CLASS } from "@workspace/ui/components/settings-styles"
import { Dialog, DialogTitle } from "@workspace/ui/components/ui/dialog"
import { useIsNarrowerThan } from "@workspace/ui/hooks/use-is-narrower-than"
import { useSettingsShortcut } from "@workspace/ui/hooks/use-settings-shortcut"
import { useSettingsTab } from "@workspace/ui/hooks/use-settings-tab"
import { cn } from "@workspace/ui/lib/utils"

type SettingsSession = {
	pages: SessionPages
	isUnsaved?: boolean
	discard: () => void
}

type WordedSessionKind = "skills" | "applications"

type SettingsSessions = Partial<
	Record<WordedSessionKind | "history", SettingsSession>
>

type SettingsDialogShellProps = {
	open: boolean
	onClose: () => void
	tab: string
	mark: ReactNode
	name: string
	breadcrumb: string
	pages?: SettingsPages
	sessions?: SettingsSessions
	hasSettingsShortcut?: boolean
	rail: (iconsOnly: boolean) => ReactNode
	children: ReactNode
	className?: string
}

const isWorded = (kind: string): kind is WordedSessionKind =>
	kind === "skills" || kind === "applications"

const wordedKindOf = (sessions: SettingsSessions, pages?: SettingsPages) => {
	const worded = Object.keys(sessions).filter(isWorded)
	const top = pages?.top
	const holder = worded.find(
		(kind) => top && top in (sessions[kind]?.pages ?? {}),
	)
	return holder ?? worded[0] ?? "skills"
}

const SettingsDialogShell = ({
	open,
	onClose,
	tab,
	mark,
	name,
	breadcrumb,
	pages,
	sessions = {},
	hasSettingsShortcut = false,
	rail,
	children,
	className,
}: SettingsDialogShellProps) => {
	const { t } = useTranslation("bots")
	const [tabs, setTabs] = useState<HTMLDivElement | null>(null)
	const [isLeaving, setLeaving] = useState(false)
	const iconsOnly = useIsNarrowerThan(tabs, RAIL_LABELS_MIN_WIDTH)
	const activeTab = useSettingsTab(open, tab)
	const declared = Object.values(sessions)
	const wordedKind = wordedKindOf(sessions, pages)

	const leave = () => {
		for (const session of declared) session.discard()
		onClose()
	}

	const close = () =>
		declared.some((session) => session.isUnsaved) ? setLeaving(true) : leave()

	useSettingsShortcut({
		isEnabled: open && hasSettingsShortcut,
		onToggle: close,
	})

	return (
		<Dialog onOpenChange={(next) => !next && close()} open={open}>
			<DialogSurface
				className={cn(
					"h-[34rem] w-[52rem] gap-0 overflow-hidden p-0",
					className,
				)}
			>
				<header className={SETTINGS_HEADER_CLASS}>
					{mark}
					<DialogTitle className="flex min-w-0 items-center gap-1.5 pr-0">
						<span className="truncate">{name}</span>
						<Icons.Next
							aria-hidden="true"
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
						<span className="shrink-0 text-muted-foreground">{breadcrumb}</span>
					</DialogTitle>
				</header>

				{pages?.shown(
					declared.reduce<SessionPages>(
						(shown, session) => ({ ...shown, ...session.pages }),
						{},
					),
				) ?? (
					<Tabs.Root
						className="flex min-h-0 flex-1"
						onValueChange={activeTab.onValueChange}
						orientation="vertical"
						value={activeTab.value}
						ref={setTabs}
					>
						<SettingsRail iconsOnly={iconsOnly}>{rail(iconsOnly)}</SettingsRail>
						{children}
					</Tabs.Root>
				)}

				<ConfirmDialog
					confirmLabel={t(`${wordedKind}.leave.action`)}
					description={t(`${wordedKind}.leave.description`)}
					onConfirm={leave}
					onOpenChange={setLeaving}
					open={isLeaving}
					title={t(`${wordedKind}.leave.title`)}
				/>
			</DialogSurface>
		</Dialog>
	)
}

export { SettingsDialogShell, type SettingsDialogShellProps }
