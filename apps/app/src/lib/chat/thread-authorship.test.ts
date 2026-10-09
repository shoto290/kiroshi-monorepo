// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { describe, expect, it } from "vitest"

import "@workspace/ui/lib/i18n"

import {
	type MessageAuthorship,
	type ThreadAuthorship,
	ThreadAuthorshipContext,
	usePersonOf,
} from "./thread-authorship"

const HOST = "account-host"
const GUEST = "account-guest"

const HOST_ROW: MessageAuthorship = {
	authorAccountId: HOST,
	authorName: "Steve",
}
const GUEST_ROW: MessageAuthorship = {
	authorAccountId: GUEST,
	authorName: "Tom",
}
const TYPED_SIGNED_OUT_ROW: MessageAuthorship = {
	authorAccountId: null,
	authorName: null,
}
const HOSTED_TRANSCRIPT = [HOST_ROW, GUEST_ROW, TYPED_SIGNED_OUT_ROW]

const hostedBy = (accountId: string | null): ThreadAuthorship => ({
	accountId,
	host: { kind: "hosted", ownAccountIds: [HOST] },
})

const JOINED_AS_GUEST: ThreadAuthorship = {
	accountId: GUEST,
	host: { kind: "joined", name: "steve@example.com" },
}

const authorsShownWith = (
	authorship: ThreadAuthorship,
	rows: MessageAuthorship[] = HOSTED_TRANSCRIPT,
) => {
	const wrapper = ({ children }: { children: ReactNode }) =>
		createElement(
			ThreadAuthorshipContext.Provider,
			{ value: authorship },
			children,
		)
	const { result } = renderHook(() => usePersonOf(), { wrapper })
	return rows.map((row) => result.current(row) ?? "mine")
}

describe("who wrote a message in a hosted space", () => {
	it("keeps every message the host typed as mine once signed out", () => {
		expect(authorsShownWith(hostedBy(null))).toEqual(["mine", "Tom", "mine"])
	})

	it("names the guest whether the host is signed in or out", () => {
		expect(authorsShownWith(hostedBy(HOST))).toEqual(["mine", "Tom", "mine"])
		expect(authorsShownWith(hostedBy(null))[1]).toBe("Tom")
	})

	it("draws nothing differently after signing out and back in", () => {
		const before = authorsShownWith(hostedBy(HOST))
		const signedOut = authorsShownWith(hostedBy(null))
		const after = authorsShownWith(hostedBy(HOST))

		expect(signedOut).toEqual(before)
		expect(after).toEqual(before)
	})
})

describe("who wrote a message in a joined space", () => {
	it("keeps the rule: mine by account, the host when unattributed", () => {
		expect(authorsShownWith(JOINED_AS_GUEST)).toEqual([
			"Steve",
			"mine",
			"steve@example.com",
		])
	})
})
