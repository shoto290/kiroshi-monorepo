// @vitest-environment happy-dom

import {
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
} from "@testing-library/react"
import { createElement, Fragment } from "react"
import { afterEach, expect, it, vi } from "vitest"

import "@workspace/ui/lib/i18n"

import { useSpaceAccess } from "@/components/space-access"
import type { OpenJoinedHost } from "@/lib/spaces/open-joined-host"

afterEach(cleanup)

const STUDIO_HOST: OpenJoinedHost = {
	spaceName: "Studio Nord",
	hostEmail: "lea@example.com",
	isOnline: true,
}

type Access = Parameters<typeof useSpaceAccess>[0]

const renderAccess = (access: Access) => {
	const { result } = renderHook(() => useSpaceAccess(access))
	render(createElement(Fragment, null, result.current))
}

it("shows Share on a space the reader hosts and hands the click to onShare", () => {
	const onShare = vi.fn()
	renderAccess({ joinedHost: null, isOwnSpace: true, onShare })

	fireEvent.click(screen.getByRole("button", { name: "Share" }))

	expect(onShare).toHaveBeenCalledOnce()
})

it("shows the host pill with the inviter email and no Share on a joined space", () => {
	renderAccess({ joinedHost: STUDIO_HOST, isOwnSpace: false, onShare: vi.fn() })

	expect(
		screen.getByRole("button", { name: "Hosted by lea@example.com, online" }),
	).toBeTruthy()
	expect(screen.queryByRole("button", { name: "Share" })).toBeNull()
})

it("marks the host pill offline while the host is offline", () => {
	renderAccess({
		joinedHost: { ...STUDIO_HOST, isOnline: false },
		isOwnSpace: false,
		onShare: vi.fn(),
	})

	expect(
		screen.getByRole("button", { name: "lea@example.com’s Mac is offline" }),
	).toBeTruthy()
})

it("shows nothing while no space is open", () => {
	const { result } = renderHook(() =>
		useSpaceAccess({ joinedHost: null, isOwnSpace: false, onShare: vi.fn() }),
	)

	expect(result.current).toBeUndefined()
})
