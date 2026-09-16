// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import {
	raiseFailureNotice,
	raiseTransientNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import type { ChatError } from "./chat-state"
import { useSessionFailureNotice } from "./use-session-failure-notice"

vi.mock("@workspace/ui/components/notice-surface", () => ({
	endNotice: vi.fn(),
	raiseFailureNotice: vi.fn(() => "notice-1"),
	raiseTransientNotice: vi.fn(() => "notice-2"),
}))

const failureNotice = vi.mocked(raiseFailureNotice)
const transientNotice = vi.mocked(raiseTransientNotice)

const refusedResume = (id: string): ChatError => ({
	id,
	error: { kind: "resumeFailed", forgotSessionId: true },
})

const crashed: ChatError = {
	id: "error-crashed",
	error: { kind: "crashed", code: null, detail: null },
}

const mountOn = (error: ChatError, onDismiss = vi.fn()) =>
	renderHook(() =>
		useSessionFailureNotice({ error, speakerId: "scribe", onDismiss }),
	)

beforeEach(() => {
	failureNotice.mockClear()
	transientNotice.mockClear()
})

afterEach(() => {
	cleanup()
})

it("fades the notice of a refused resume away on its own", () => {
	mountOn(refusedResume("error-refused"))

	expect(failureNotice).not.toHaveBeenCalled()
	expect(transientNotice).toHaveBeenCalledWith({
		type: "warning",
		title: i18n.t("chat:screen.notice.resumeFailed"),
		description: i18n.t("chat:screen.transport.resumeFailed"),
	})
})

it("dismisses the refused resume it faded away", () => {
	const onDismiss = vi.fn()

	mountOn(refusedResume("error-dismissed"), onDismiss)

	expect(onDismiss).toHaveBeenCalledWith("error-dismissed")
})

it("raises one notice for a refused resume however often the thread renders", () => {
	const error = refusedResume("error-once")
	const { rerender } = mountOn(error)

	rerender()
	rerender()
	mountOn(error)

	expect(transientNotice).toHaveBeenCalledTimes(1)
})

it("keeps the sticky notice of every other failure", () => {
	mountOn(crashed)

	expect(transientNotice).not.toHaveBeenCalled()
	expect(failureNotice).toHaveBeenCalledWith(
		expect.objectContaining({
			title: i18n.t("chat:screen.notice.crashed"),
		}),
	)
})
