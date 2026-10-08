// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import {
	createInvitationsController,
	type InvitationsTransport,
} from "./invitations-controller"
import { createJoinedSpacesController } from "./joined-spaces-controller"
import { createSpacesController } from "./spaces-controller"
import { useSwitcherSpaces } from "./use-joined-spaces"

import type { Invitation } from "../bindings"
import { useController } from "../use-controller"
import { createFakeTranscriptStore } from "../conversations/fake-transcript-store"

afterEach(cleanup)

const STUDIO: Invitation = {
	instanceId: "instance-studio",
	instanceName: "Studio Nord",
	inviterEmail: "lea@example.com",
	invitedAt: "2026-10-08T09:00:00Z",
}

const transport = {
	list: vi.fn(async () => [STUDIO]),
	accept: vi.fn(async () => Promise.reject({ kind: "withdrawn" })),
	decline: vi.fn(async () => undefined),
	onChanged: vi.fn(async () => () => undefined),
} satisfies InvitationsTransport

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const renderSwitcher = async () => {
	const joinedController = createJoinedSpacesController({
		spaces: createSpacesController(createFakeTranscriptStore()),
	})
	const invitationsController = createInvitationsController({
		joinedSpaces: joinedController,
		transport,
		reportFailure: vi.fn(),
	})
	const { result } = renderHook(() => {
		const invitations = useController(() => invitationsController)
		return useSwitcherSpaces(
			{ spaces: [], selectedSpaceId: null },
			{
				state: joinedController.getState(),
				controller: joinedController,
				hosts: { active: null, connections: {} },
			},
			invitations,
		)
	})
	await act(async () => {
		invitationsController.watch()
		await settle()
	})
	await act(() => invitationsController.accept(STUDIO.instanceId))
	return result
}

const statesOf = (switcher: { invitations: { state: string }[] }) =>
	switcher.invitations.map((row) => row.state)

it("keeps the withdrawn row while the switcher opens", async () => {
	const switcher = await renderSwitcher()

	act(() => switcher.current.onSpaceSwitcherOpenChange(true))

	expect(statesOf(switcher.current)).toEqual(["withdrawn"])
})

it("drops the withdrawn row when the switcher closes", async () => {
	const switcher = await renderSwitcher()

	act(() => switcher.current.onSpaceSwitcherOpenChange(false))

	expect(statesOf(switcher.current)).toEqual([])
})
