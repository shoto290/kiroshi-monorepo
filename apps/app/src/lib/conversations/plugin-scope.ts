import type { EnvOwner, PluginScope } from "./store-contract"

export const USER_PLUGIN: PluginScope = { kind: "user" }

export const spacePlugin = (id: string): PluginScope => ({ kind: "space", id })

export const botPlugin = (id: string): PluginScope => ({ kind: "bot", id })

export const pluginScopeOf = (owner: EnvOwner): PluginScope =>
	owner.kind === "user" ? USER_PLUGIN : { kind: owner.kind, id: owner.id }

const pluginScopeId = (scope: PluginScope) =>
	scope.kind === "user" ? null : scope.id

export const isSamePluginScope = (
	left: PluginScope | null,
	right: PluginScope,
) =>
	left !== null &&
	left.kind === right.kind &&
	pluginScopeId(left) === pluginScopeId(right)
