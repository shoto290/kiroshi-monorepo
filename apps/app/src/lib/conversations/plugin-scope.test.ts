import { describe, expect, it } from "vitest"

import { pluginScopeOf } from "./plugin-scope"

describe("pluginScopeOf", () => {
	it("names the plugin of each environment owner", () => {
		expect(pluginScopeOf({ kind: "user" })).toEqual({ kind: "user" })
		expect(pluginScopeOf({ kind: "space", id: "s-1" })).toEqual({
			kind: "space",
			id: "s-1",
		})
		expect(pluginScopeOf({ kind: "bot", id: "b-1", spaceId: "s-1" })).toEqual({
			kind: "bot",
			id: "b-1",
		})
	})
})
