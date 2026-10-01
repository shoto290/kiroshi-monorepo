import { describe, expect, it, vi } from "vitest"

import type { NoticeMessage } from "@workspace/ui/components/notice-surface"
import "@workspace/ui/lib/i18n"

import {
	createShareLinkController,
	type ShareLinkTransport,
} from "./share-link-controller"

import type { ShareLink } from "../bindings"

const LINK = "kiroshi://join/host.local:4242?token=secret"

const createFakeTransport = (reads: Array<() => Promise<ShareLink>>) => {
	const presence: { announce: () => void } = { announce: () => undefined }
	const unlisten = vi.fn()
	const transport: ShareLinkTransport = {
		read: vi.fn(() => (reads.shift() ?? reads[0])()),
		onPresence: vi.fn(async (listener) => {
			presence.announce = listener
			return unlisten
		}),
	}
	return { transport, presence, unlisten }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createShareLinkController", () => {
	it("holds the link while the host is up", async () => {
		const { transport } = createFakeTransport([
			async () => ({ kind: "up", link: LINK }),
		])
		const controller = createShareLinkController({ transport })

		controller.watch()
		await settle()

		expect(controller.getState()).toEqual({
			shareLink: LINK,
			hasFailedToLoad: false,
		})
	})

	it("holds null while the host is down", async () => {
		const { transport } = createFakeTransport([async () => ({ kind: "down" })])
		const controller = createShareLinkController({ transport })

		controller.watch()
		await settle()

		expect(controller.getState().shareLink).toBeNull()
	})

	it("reads the link again when the host presence changes", async () => {
		const { transport, presence } = createFakeTransport([
			async () => ({ kind: "down" }),
			async () => ({ kind: "up", link: LINK }),
		])
		const controller = createShareLinkController({ transport })

		controller.watch()
		await settle()
		presence.announce()
		await settle()

		expect(transport.read).toHaveBeenCalledTimes(2)
		expect(controller.getState().shareLink).toBe(LINK)
	})

	it("keeps only the latest read when two overlap", async () => {
		let releaseFirst: (shareLink: ShareLink) => void = () => undefined
		const { transport, presence } = createFakeTransport([
			() =>
				new Promise<ShareLink>((resolve) => {
					releaseFirst = resolve
				}),
			async () => ({ kind: "down" }),
		])
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
		const { transport } = createFakeTransport([
			async () => {
				throw new Error("ipc closed")
			},
		])
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

	it("removes the presence listener when the watch stops", async () => {
		const { transport, unlisten } = createFakeTransport([
			async () => ({ kind: "down" }),
		])
		const controller = createShareLinkController({ transport })

		const stop = controller.watch()
		await settle()
		stop()
		await settle()

		expect(unlisten).toHaveBeenCalledOnce()
	})
})
