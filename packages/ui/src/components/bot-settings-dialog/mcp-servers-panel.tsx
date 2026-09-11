"use client"

import { useTranslation } from "react-i18next"

import type {
	BotMcpConnectionState,
	BotMcpServerItem,
} from "@workspace/ui/components/bot-settings"
import { MCP_CONNECTION_DOT } from "@workspace/ui/components/bot-settings-dialog/mcp-connection"
import { readMcpServerLaunch } from "@workspace/ui/components/bot-settings-dialog/mcp-server-launch"
import { Icons } from "@workspace/ui/components/icons"
import { SETTINGS_EMPTY_CLASS } from "@workspace/ui/components/settings-styles"
import { Button } from "@workspace/ui/components/ui/button"
import { cn } from "@workspace/ui/lib/utils"

type McpRowAction = {
	key: "connect" | "retry"
	variant: "default" | "outline"
}

const MCP_ROW_ACTION = {
	connected: null,
	needsAuthorization: { key: "connect", variant: "default" },
	connecting: null,
	failed: { key: "retry", variant: "outline" },
} as const satisfies Record<BotMcpConnectionState, McpRowAction | null>

type McpServerRowProps = {
	server: BotMcpServerItem
	onOpen: () => void
	onConnect?: () => void
}

const McpServerRow = ({ server, onOpen, onConnect }: McpServerRowProps) => {
	const { t } = useTranslation("bots")
	const launch = readMcpServerLaunch(server.config)
	const state = server.connection
	const action = state ? MCP_ROW_ACTION[state] : null

	return (
		<li className="relative flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted">
			<button
				aria-label={t("connectors.open", { name: server.name })}
				className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onClick={onOpen}
				type="button"
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate font-medium text-foreground text-sm">
					{server.name}
				</span>
				<span className="truncate font-mono text-muted-foreground text-xs">
					{launch.command ?? launch.url ?? t("connectors.launch.unknown")}
				</span>
			</span>
			<span className="flex w-37 shrink-0 items-center gap-1.5">
				{state ? (
					<>
						<span
							aria-hidden="true"
							className={cn(
								"size-2 shrink-0 rounded-full",
								MCP_CONNECTION_DOT[state],
							)}
						/>
						<span
							className={cn(
								"truncate text-xs",
								state === "connecting"
									? "text-muted-foreground"
									: "text-foreground",
							)}
						>
							{t(`connectors.connection.state.${state}`)}
						</span>
					</>
				) : null}
			</span>
			<span className="relative flex h-6 w-20 shrink-0 items-center justify-end">
				{action && onConnect ? (
					<Button
						aria-label={t(`connectors.connection.row.${action.key}`, {
							name: server.name,
						})}
						onClick={onConnect}
						size="xs"
						variant={action.variant}
					>
						{t(`connectors.connection.${action.key}`)}
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

type McpServersPanelProps = {
	servers: BotMcpServerItem[]
	haveFailedToLoad?: boolean
	onOpen: (server: BotMcpServerItem) => void
	onAdd: () => void
	onConnect?: (server: BotMcpServerItem) => void
}

const McpServersPanel = ({
	servers,
	haveFailedToLoad = false,
	onOpen,
	onAdd,
	onConnect,
}: McpServersPanelProps) => {
	const { t } = useTranslation("bots")

	if (haveFailedToLoad) {
		return (
			<div className={SETTINGS_EMPTY_CLASS}>
				<Icons.Alert aria-hidden="true" className="size-8 text-destructive" />
				<p className="max-w-xs text-muted-foreground text-sm">
					{t("connectors.unavailable")}
				</p>
			</div>
		)
	}

	if (servers.length === 0) {
		return (
			<div className={SETTINGS_EMPTY_CLASS}>
				<Icons.Server
					aria-hidden="true"
					className="size-8 text-muted-foreground"
				/>
				<div className="flex flex-col gap-1">
					<span className="font-medium text-foreground text-sm">
						{t("connectors.empty.title")}
					</span>
					<p className="max-w-xs text-muted-foreground text-sm">
						{t("connectors.empty.description")}
					</p>
				</div>
				<Button onClick={onAdd} size="sm">
					<Icons.Add aria-hidden="true" className="size-3.5" />
					{t("connectors.add")}
				</Button>
			</div>
		)
	}

	return (
		<>
			<div className="flex shrink-0 items-center justify-between gap-3">
				<p className="text-muted-foreground text-xs">{t("connectors.intro")}</p>
				<Button onClick={onAdd} size="sm" variant="outline">
					<Icons.Add aria-hidden="true" className="size-3.5" />
					{t("connectors.add")}
				</Button>
			</div>
			<ul className="flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0">
				{servers.map((server) => (
					<McpServerRow
						key={server.name}
						onConnect={onConnect && (() => onConnect(server))}
						onOpen={() => onOpen(server)}
						server={server}
					/>
				))}
			</ul>
		</>
	)
}

export { McpServersPanel, type McpServersPanelProps }
