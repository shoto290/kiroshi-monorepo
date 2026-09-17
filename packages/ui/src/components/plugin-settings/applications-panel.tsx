"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"

import type {
	BotMcpConnectionState,
	BotMcpServerItem,
} from "@workspace/ui/components/bot-settings"
import {
	MCP_CONNECTION_DOT,
	readMcpConnectionReason,
} from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import { Icons } from "@workspace/ui/components/icons"
import { ApplicationMark } from "@workspace/ui/components/plugin-settings/application-mark"
import { SETTINGS_EMPTY_CLASS } from "@workspace/ui/components/settings-styles"
import { Button } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"

type ApplicationsOwner =
	| { kind: "companion"; name: string }
	| { kind: "space"; name: string }
	| { kind: "profile" }

type OwnerCopy = {
	intro: string
	emptyTitle: string
	emptyDescription: string
	footnote: string | null
}

const useOwnerCopy = (owner: ApplicationsOwner): OwnerCopy => {
	const { t } = useTranslation("bots")

	if (owner.kind === "profile") {
		return {
			intro: t("applications.intro.profile"),
			emptyTitle: t("applications.empty.title.profile"),
			emptyDescription: t("applications.empty.description.profile"),
			footnote: t("applications.footnote.profile"),
		}
	}

	const { name } = owner

	if (owner.kind === "space") {
		return {
			intro: t("applications.intro.space", { name }),
			emptyTitle: t("applications.empty.title.space", { name }),
			emptyDescription: t("applications.empty.description.space"),
			footnote: t("applications.footnote.space"),
		}
	}

	return {
		intro: t("applications.intro.companion", { name }),
		emptyTitle: t("applications.empty.title.companion"),
		emptyDescription: t("applications.empty.description.companion"),
		footnote: null,
	}
}

type ApplicationsSearchRowProps = {
	onPaste: () => void
}

const ApplicationsSearchRow = ({ onPaste }: ApplicationsSearchRowProps) => {
	const { t } = useTranslation("bots")
	const [query, setQuery] = useState("")
	const placeholder = t("applications.search")

	return (
		<div className="flex shrink-0 items-center gap-2">
			<label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
				<Icons.Search
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<input
					aria-label={placeholder}
					className="min-w-0 flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground"
					onChange={(event) => setQuery(event.target.value)}
					placeholder={placeholder}
					type="text"
					value={query}
				/>
			</label>
			<button
				aria-label={t("applications.paste")}
				className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-input text-foreground outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
				onClick={onPaste}
				type="button"
			>
				<Icons.Add aria-hidden="true" className="size-4" />
			</button>
		</div>
	)
}

type ApplicationRowAction = {
	key: "connect" | "retry"
	variant: "default" | "outline"
}

const APPLICATION_ROW_ACTION = {
	connected: null,
	needsAuthorization: { key: "connect", variant: "default" },
	connecting: null,
	failed: { key: "retry", variant: "outline" },
} as const satisfies Record<BotMcpConnectionState, ApplicationRowAction | null>

type ApplicationRowProps = {
	server: BotMcpServerItem
	onOpen: () => void
	onConnect?: () => void
}

const ApplicationRow = ({ server, onOpen, onConnect }: ApplicationRowProps) => {
	const { t } = useTranslation("bots")
	const name = server.displayName ?? server.name
	const state = server.connection
	const action = state ? APPLICATION_ROW_ACTION[state] : null
	const reason = readMcpConnectionReason(t, server.reason)

	return (
		<li className="relative flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted">
			<button
				aria-label={t("applications.open", { name })}
				className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onClick={onOpen}
				type="button"
			/>
			<ApplicationMark mark={server.mark} />
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span
					className={cn(
						"truncate font-medium text-foreground text-sm",
						!server.displayName && "font-mono",
					)}
				>
					{name}
				</span>
				<span className="flex h-4 min-w-0 items-center gap-1.5">
					{state ? (
						<>
							<span
								aria-hidden="true"
								className={cn(
									"size-2 shrink-0 rounded-full",
									MCP_CONNECTION_DOT[state],
								)}
							/>
							<span className="truncate text-muted-foreground text-xs">
								{t(`applications.connection.state.${state}`)}
							</span>
						</>
					) : null}
				</span>
				{state === "failed" && reason ? (
					<span className="line-clamp-2 wrap-break-word text-muted-foreground text-xs">
						{reason}
					</span>
				) : null}
			</span>
			<span className="relative flex h-6 w-18 shrink-0 items-center justify-end">
				{action && onConnect ? (
					<Button
						aria-label={t(`applications.connection.row.${action.key}`, {
							name,
						})}
						onClick={onConnect}
						size="xs"
						variant={action.variant}
					>
						{t(`applications.connection.${action.key}`)}
					</Button>
				) : null}
			</span>
			<Icons.Next
				aria-hidden="true"
				className="size-4 shrink-0 text-muted-foreground"
			/>
		</li>
	)
}

type ApplicationsPanelProps = {
	owner: ApplicationsOwner
	servers: BotMcpServerItem[]
	haveFailedToLoad?: boolean
	onOpen: (server: BotMcpServerItem) => void
	onAdd: () => void
	onPaste: () => void
	onConnect?: (server: BotMcpServerItem) => void
}

const ApplicationsPanel = ({
	owner,
	servers,
	haveFailedToLoad = false,
	onOpen,
	onAdd,
	onPaste,
	onConnect,
}: ApplicationsPanelProps) => {
	const { t } = useTranslation("bots")
	const copy = useOwnerCopy(owner)

	if (haveFailedToLoad) {
		return (
			<div className={SETTINGS_EMPTY_CLASS}>
				<Icons.Alert aria-hidden="true" className="size-8 text-destructive" />
				<p className="max-w-xs text-muted-foreground text-sm">
					{t("applications.unavailable")}
				</p>
			</div>
		)
	}

	if (servers.length === 0) {
		return (
			<>
				<ApplicationsSearchRow onPaste={onPaste} />
				<div className={SETTINGS_EMPTY_CLASS}>
					<span className="flex items-center gap-2 opacity-45">
						<ApplicationMark isBlank size="sm" />
						<ApplicationMark />
						<ApplicationMark isBlank size="sm" />
					</span>
					<div className="flex flex-col items-center gap-1">
						<span className="wrap-break-word font-medium text-foreground text-sm">
							{copy.emptyTitle}
						</span>
						<p className="max-w-98 text-muted-foreground text-sm">
							{copy.emptyDescription}
						</p>
					</div>
					<Button onClick={onAdd} size="sm">
						<Icons.Add
							aria-hidden="true"
							className="size-3.5"
							data-icon="inline-start"
						/>
						{t("applications.add")}
					</Button>
				</div>
			</>
		)
	}

	return (
		<>
			<ApplicationsSearchRow onPaste={onPaste} />
			<div className="flex shrink-0 items-center justify-between gap-3">
				<p className="min-w-0 wrap-break-word text-muted-foreground text-xs">
					{copy.intro}
				</p>
				<Button onClick={onAdd} size="sm" variant="outline">
					<Icons.Add
						aria-hidden="true"
						className="size-3.5"
						data-icon="inline-start"
					/>
					{t("applications.add")}
				</Button>
			</div>
			<ul className="flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0">
				{servers.map((server) => (
					<ApplicationRow
						key={server.name}
						onConnect={onConnect && (() => onConnect(server))}
						onOpen={() => onOpen(server)}
						server={server}
					/>
				))}
			</ul>
			{copy.footnote ? (
				<p
					className="shrink-0 wrap-break-word border-border border-t pt-3 text-muted-foreground text-xs"
					data-slot="applications-footnote"
				>
					{copy.footnote}
				</p>
			) : null}
		</>
	)
}

export {
	type ApplicationsOwner,
	ApplicationsPanel,
	type ApplicationsPanelProps,
}
