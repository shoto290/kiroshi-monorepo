// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"

import type { ApplicationPort } from "./application-port"
import {
	type ConversationApplications,
	ConversationApplicationsContext,
	useConversationInstalls,
} from "./use-conversation-installs"

import { hostOfflineOf } from "../host/host-offline"

vi.mock("@workspace/ui/components/notice-surface", () => ({
	raiseFailureNotice: vi.fn(),
}))

type Provided = {
	children: ReactNode
}

const installsRefusedWith = (reason: unknown) => {
	const installs = vi.fn(() => Promise.reject(reason))
	const applications = {
		port: {
			installs,
			onInstalled: () => Promise.resolve(() => undefined),
		} as unknown as ApplicationPort,
		curated: [],
		spaces: [],
		onOpen: vi.fn(),
	} satisfies ConversationApplications
	const wrapper = ({ children }: Provided) =>
		createElement(
			ConversationApplicationsContext.Provider,
			{ value: applications },
			children,
		)
	renderHook(() => useConversationInstalls("conversation-1"), { wrapper })
	return installs
}

describe("reading the installs of a conversation", () => {
	beforeEach(() => {
		vi.mocked(raiseFailureNotice).mockClear()
		vi.spyOn(console, "error").mockImplementation(() => undefined)
	})

	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("raises its own notice when the installs cannot be read", async () => {
		installsRefusedWith(new Error("no installs"))

		await waitFor(() => expect(raiseFailureNotice).toHaveBeenCalledOnce())
	})

	it("raises no notice of its own when the host of the space is offline", async () => {
		const installs = installsRefusedWith(
			hostOfflineOf("the host of this space is offline"),
		)

		await waitFor(() => expect(installs).toHaveBeenCalled())
		await Promise.resolve()
		expect(raiseFailureNotice).not.toHaveBeenCalled()
	})
})
