import { describe, expect, it } from "vitest"

import { adoptHostConnection, type HostPage } from "./connection"

type PageSeed = {
	hash: string
	stored?: Record<string, string>
}

const pageOf = ({ hash, stored = {} }: PageSeed) => {
	const storage = new Map(Object.entries(stored))
	const addresses: string[] = []
	const page: HostPage = {
		location: { hash, pathname: "/", search: "" },
		history: {
			state: null,
			replaceState: (_state, _unused, url) => {
				addresses.push(String(url))
			},
		},
		sessionStorage: {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => {
				storage.set(key, value)
			},
		},
	}
	return { page, storage, addresses }
}

const LINK_FRAGMENT = "#host=http://127.0.0.1:45367&token=abc"

describe("adoptHostConnection", () => {
	it("stores the host and token from the fragment and clears the address bar", () => {
		const { page, storage, addresses } = pageOf({ hash: LINK_FRAGMENT })

		expect(adoptHostConnection(page)).toEqual({
			host: "http://127.0.0.1:45367",
			token: "abc",
		})
		expect([...storage.values()]).toEqual(["http://127.0.0.1:45367", "abc"])
		expect(addresses).toEqual(["/"])
	})

	it("keeps driving the stored host when a reload carries no fragment", () => {
		const first = pageOf({ hash: LINK_FRAGMENT })
		adoptHostConnection(first.page)
		const reloaded = pageOf({
			hash: "",
			stored: Object.fromEntries(first.storage),
		})

		expect(adoptHostConnection(reloaded.page)).toEqual({
			host: "http://127.0.0.1:45367",
			token: "abc",
		})
		expect(reloaded.addresses).toEqual([])
	})

	it("holds no host when neither the fragment nor the storage names one", () => {
		expect(adoptHostConnection(pageOf({ hash: "" }).page)).toBeNull()
	})

	it("refuses a host that is not an http address", () => {
		const { page, storage } = pageOf({
			hash: "#host=javascript:alert(1)&token=abc",
		})

		expect(adoptHostConnection(page)).toBeNull()
		expect(storage.size).toBe(0)
	})

	it("refuses a fragment with no token", () => {
		expect(
			adoptHostConnection(pageOf({ hash: "#host=http://127.0.0.1:1" }).page),
		).toBeNull()
	})
})
