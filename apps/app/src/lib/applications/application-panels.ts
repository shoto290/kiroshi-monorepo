import { type ReopenedScope, scopeOfOwner } from "./session-reopening"

import type { McpServersController } from "../bots/mcp-servers-controller"

export type ApplicationPanel = Pick<McpServersController, "getState" | "reload">

const keyOf = (scope: ReopenedScope) =>
	scope.kind === "user" ? scope.kind : `${scope.kind}:${scope.id}`

const holdsScope = (scope: ReopenedScope) => (panel: ApplicationPanel) => {
	const { owner } = panel.getState()
	return owner !== null && keyOf(scopeOfOwner(owner)) === keyOf(scope)
}

export const reloadPanelsHolding = (
	scope: ReopenedScope,
	panels: ApplicationPanel[],
) =>
	Promise.all(panels.filter(holdsScope(scope)).map((panel) => panel.reload()))
