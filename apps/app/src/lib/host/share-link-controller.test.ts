import { describe, expect, it, vi } from "vitest"

import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import {
	createShareLinkController,
	type ShareLinkTransport,
} from "./share-link-controller"

import type { ShareLink } from "../bindings"

const LINK = "kiroshi://join/host.local:4242?token=secret"

const createFakeTransport = (read: ShareLinkTransport["read"]) => {
	const presence: { announce: () => void } = { announce: () => undefined }
	const transport: ShareLinkTransport = {
		read,
		onPresence: async (listener) => {
			presence.announce = listener
			return () => undefined
		},
	}
	return { transport, presence }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createShareLinkController", () => {
	it("keeps only the latest read when two overlap", async () => {
		let releaseFirst: (shareLink: ShareLink) => void = () => undefined
		const { transport, presence } = createFakeTransport(
			vi
				.fn<ShareLinkTransport["read"]>()
				.mockReturnValueOnce(
					new Promise((resolve) => {
						releaseFirst = resolve
					}),
				)
				.mockResolvedValue({ kind: "down" }),
		)
		const controller = createShareLinkController({ transport })

		controller.watch()
		await settle()
		presence.announce()
		await settle()
		releaseFirst({ kind: "up", link: LINK })
		await settle()

		expect(controller.getState().shareLink).toBeNull()
	})

	it("notes the failure, raises a notice and holds null when the read rejects", async () => {
		const { transport } = createFakeTransport(() =>
			Promise.reject(new Error("ipc closed")),
		)
		const reportFailure = vi.fn<(message: NoticeMessage) => void>()
		const controller = createShareLinkController({ transport, reportFailure })

		controller.watch()
		await settle()

		expect(controller.getState()).toEqual({
			shareLink: null,
			hasFailedToLoad: true,
		})
		expect(reportFailure).toHaveBeenCalledWith({
			title:
				"The host isn’t running, so there’s no link yet. Restart Kiroshi to start it.",
		})
	})
})
