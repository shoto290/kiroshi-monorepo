import { getCurrentWindow } from "@tauri-apps/api/window"
import { platform } from "@tauri-apps/plugin-os"

import {
	endNotice,
	raiseFailureNotice,
} from "@workspace/ui/components/notice-surface"
import { i18n } from "@workspace/ui/lib/i18n"

import { adoptHostConnection } from "./connection"
import {
	bridgeGeneratedBindings,
	createHttpHost,
	type HttpHost,
	raiseRefusalNotice,
} from "./http"
import {
	convertFileSrc,
	invoke as tauriInvoke,
	listen as tauriListen,
} from "./tauri"

import {
	commands,
	MAXIMIZE_BUTTON_EVENT,
	type MaximizeButtonPointer,
	type MaximizeButtonState,
} from "../bindings"

const hasTauriInternals = (): boolean =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

const raiseHostDownNotice = () =>
	raiseFailureNotice({ title: i18n.t("chat:screen.notice.unavailable") })

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

export const hasCaptionWindowControls = (): boolean =>
	isDesktopHost() && platform() === "windows"

export const minimizeWindow = (): Promise<void> => getCurrentWindow().minimize()

export const toggleMaximizeWindow = (): Promise<void> =>
	getCurrentWindow().toggleMaximize()

export const closeWindow = (): Promise<void> => getCurrentWindow().close()

export type MaximizedWatch = {
	report: (isMaximized: boolean) => void
	onError: (reason: unknown) => void
}

export const watchWindowMaximized = ({
	report,
	onError,
}: MaximizedWatch): Promise<() => void> => {
	const current = getCurrentWindow()
	const readMaximized = () => current.isMaximized().then(report, onError)
	readMaximized()
	return current.onResized(readMaximized)
}

export const watchMaximizeButton = (
	report: (state: MaximizeButtonState) => void,
): Promise<() => void> =>
	listen<MaximizeButtonPointer>(MAXIMIZE_BUTTON_EVENT, ({ payload }) =>
		report(payload.state),
	)

export type MaximizeButtonBounds = NonNullable<
	Parameters<typeof commands.windowDeclareMaximizeButton>[0]
>

export const declareMaximizeButton = async (
	bounds: MaximizeButtonBounds | null,
): Promise<void> => {
	const result = await commands.windowDeclareMaximizeButton(bounds)
	if (result.status === "error") {
		throw new Error(result.error.kind)
	}
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
