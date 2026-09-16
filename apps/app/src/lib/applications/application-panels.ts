import { type ReopenedScope, scopeOfOwner } from "./session-reopening"

import type { McpServersController } from "../bots/mcp-servers-controller"

export type ApplicationPanel = Pick<McpServersController, "getState" | "reload">

const idOf = (scope: ReopenedScope) => (scope.kind === "user" ? null : scope.id)

const isSameScope = (left: ReopenedScope, right: ReopenedScope) =>
	left.kind === right.kind && idOf(left) === idOf(right)

const holds = (panel: ApplicationPanel, scope: ReopenedScope) => {
	const { owner } = panel.getState()
	return owner !== null && isSameScope(scopeOfOwner(owner), scope)
}

export const reloadPanelsHolding = (
	scope: ReopenedScope,
	panels: ApplicationPanel[],
) =>
	Promise.all(
		panels
			.filter((panel) => holds(panel, scope))
			.map((panel) => panel.reload()),
	)
