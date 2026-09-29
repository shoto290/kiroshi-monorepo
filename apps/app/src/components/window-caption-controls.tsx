import { useEffect, useState } from "react"

import { raiseFailureNotice } from "@workspace/ui/components/notice-surface"
import { WindowControls } from "@workspace/ui/components/window-controls"
import { i18n } from "@workspace/ui/lib/i18n"

import {
	closeWindow,
	declareMaximizeButton,
	hasCaptionWindowControls,
	type MaximizeButtonBounds,
	minimizeWindow,
	toggleMaximizeWindow,
	watchWindowMaximized,
} from "@/lib/host"

type WindowAction = "minimize" | "maximize" | "close" | "state" | "snap"

const raiseWindowFailure = (action: WindowAction) => () => {
	raiseFailureNotice({
		title: i18n.t(`common:windowControls.failure.${action}`),
	})
}

const runWindowAction =
	(action: WindowAction, call: () => Promise<void>) => () => {
		call().catch(raiseWindowFailure(action))
	}

const boundsOf = (button: HTMLButtonElement): MaximizeButtonBounds => {
	const { x, y, width, height } = button.getBoundingClientRect()
	return { x, y, width, height }
}

const createSnapDeclaration = () => {
	let hasFailed = false
	const raiseOnce = () => {
		if (hasFailed) return
		hasFailed = true
		raiseWindowFailure("snap")()
	}
	return (bounds: MaximizeButtonBounds | null) => {
		declareMaximizeButton(bounds).catch(raiseOnce)
	}
}

const observeMaximizeButton = (button: HTMLButtonElement | null) => {
	if (!button) return
	const declare = createSnapDeclaration()
	const declareCurrentBounds = () => declare(boundsOf(button))
	const observer = new ResizeObserver(declareCurrentBounds)
	observer.observe(button)
	window.addEventListener("resize", declareCurrentBounds)
	return () => {
		observer.disconnect()
		window.removeEventListener("resize", declareCurrentBounds)
		declare(null)
	}
}

const useWindowMaximized = (): boolean => {
	const [isMaximized, setIsMaximized] = useState(false)

	useEffect(() => {
		const raiseStateFailure = raiseWindowFailure("state")
		const watch = watchWindowMaximized({
			report: setIsMaximized,
			onError: raiseStateFailure,
		}).catch(raiseStateFailure)
		return () => {
			watch.then((stop) => stop?.())
		}
	}, [])

	return isMaximized
}

const WindowCaptionControls = () => {
	const isMaximized = useWindowMaximized()

	return (
		<WindowControls
			maximizeButtonRef={observeMaximizeButton}
			maximized={isMaximized}
			onClose={runWindowAction("close", closeWindow)}
			onMinimize={runWindowAction("minimize", minimizeWindow)}
			onToggleMaximize={runWindowAction("maximize", toggleMaximizeWindow)}
		/>
	)
}

export const titleBarWindowControls = () =>
	hasCaptionWindowControls() ? <WindowCaptionControls /> : undefined
