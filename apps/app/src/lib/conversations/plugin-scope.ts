import type { EnvOwner, PluginScope } from "./store-contract"

export const pluginScopeOf = (owner: EnvOwner): PluginScope =>
	owner.kind === "user" ? owner : { kind: owner.kind, id: owner.id }
