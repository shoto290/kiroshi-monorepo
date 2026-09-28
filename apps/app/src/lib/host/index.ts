import { getCurrentWindow } from "@tauri-apps/api/window"
import { platform } from "@tauri-apps/plugin-os"

import {
	endNotice,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { adoptHostConnection } from "./connection"
import { bridgeGeneratedBindings, createHttpHost, type HttpHost } from "./http"
import {
	convertFileSrc,
	invoke as tauriInvoke,
	listen as tauriListen,
} from "./tauri"

const hasTauriInternals = (): boolean =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

const raiseHostDownNotice = () =>
	raiseFailureNotice({ title: i18n.t("chat:screen.notice.unavailable") })

const raiseRefusalNotice = (message: string) => {
	raiseFailureNotice({
		title: i18n.t("chat:screen.notice.failed"),
		description: message,
	})
}

const connectHttpHost = (): HttpHost | null => {
	const connection = adoptHostConnection(window)
	if (!connection) {
		return null
	}
	let downNoticeId: string | null = null
	return createHttpHost({
		...connection,
		fetch: (input, init) => fetch(input, init),
		openSocket: (url) => new WebSocket(url),
		onDown: () => {
			downNoticeId = raiseHostDownNotice()
		},
		onUp: () => {
			if (downNoticeId) endNotice(downNoticeId)
			downNoticeId = null
		},
		onRefused: raiseRefusalNotice,
	})
}

const httpHost =
	typeof window === "undefined" || hasTauriInternals()
		? null
		: connectHttpHost()

if (httpHost) {
	bridgeGeneratedBindings(httpHost, window)
}

export const invoke: typeof tauriInvoke = httpHost?.invoke ?? tauriInvoke

export const listen: typeof tauriListen = httpHost?.listen ?? tauriListen

export function isDesktopHost(): boolean {
	return httpHost === null && hasTauriInternals()
}

export function drivesRealHost(): boolean {
	return isDesktopHost() || httpHost !== null
}

export function hasOverlayWindowControls(): boolean {
	return isDesktopHost() && platform() === "macos"
}

export function isSidebarResizable(): boolean {
	return !isDesktopHost() || platform() === "macos"
}

export function assetSrc(path: string): string {
	if (isDesktopHost()) {
		return convertFileSrc(path)
	}
	return httpHost ? httpHost.fileSrc(path) : path
}

export function avatarSrc(path: string | null): string | undefined {
	return path ? assetSrc(path) : undefined
}

export type WindowReveal = {
	withFocus?: boolean
}

export function revealWindow({ withFocus }: WindowReveal = {}): Promise<void> {
	if (!isDesktopHost()) {
		return Promise.resolve()
	}
	const current = getCurrentWindow()
	const shown = current.show()
	return withFocus ? shown.then(() => current.setFocus()) : shown
}

export function watchWindowFocus(
	report: (isFocused: boolean) => void,
): Promise<() => void> {
	if (!isDesktopHost()) {
		return Promise.resolve(() => undefined)
	}
	const current = getCurrentWindow()
	current.isFocused().then(report, () => report(true))
	return current.onFocusChanged(({ payload }) => report(payload))
}
