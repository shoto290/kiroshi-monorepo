import type { TFunction } from "i18next"

const MCP_PREFIX = "mcp__"

const readableTool = (t: TFunction<"chat">, token: string) => {
	if (!token.startsWith(MCP_PREFIX)) return token
	const [server, ...tool] = token.slice(MCP_PREFIX.length).split("__")
	if (tool.length === 0) return token
	return t("working.mcp", { server, tool: tool.join("__") })
}

const readableLabel = (t: TFunction<"chat">, label: string) =>
	label
		.split(" ")
		.map((token) => readableTool(t, token))
		.join(" ")

export { readableLabel, readableTool }
