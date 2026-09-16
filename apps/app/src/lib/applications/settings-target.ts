import type { ReopenedScope } from "./session-reopening"

export type SettingsTarget = {
	scope: ReopenedScope
	application: string
}

const idOf = (scope: ReopenedScope) => (scope.kind === "user" ? null : scope.id)

const isSameScope = (one: ReopenedScope, other: ReopenedScope) =>
	one.kind === other.kind && idOf(one) === idOf(other)

export const applicationToOpenIn = (
	scope: ReopenedScope,
	target: SettingsTarget | undefined,
) =>
	target && isSameScope(target.scope, scope) ? target.application : undefined
