import type { BotMcpConnectionState } from "@workspace/ui/components/bot-settings"

type McpConnectionSection = {
	state: BotMcpConnectionState
	host?: string
	authorizedAt?: string
	onConnect?: () => void
	onCancel?: () => void
	onReopen?: () => void
	onDisconnect?: () => void
}

const MCP_CONNECTION_DOT = {
	connected: "bg-emerald-500",
	needsAuthorization: "bg-bot-badge-attention",
	connecting: "bg-muted-foreground motion-safe:animate-pulse",
	failed: "bg-destructive",
} satisfies Record<BotMcpConnectionState, string>

export { MCP_CONNECTION_DOT, type McpConnectionSection }
