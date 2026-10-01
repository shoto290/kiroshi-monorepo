import { useEffect } from "react"

import { isDesktopHost } from "./index"
import { createShareLinkController } from "./share-link-controller"

import { useController } from "../use-controller"

export const useShareLink = (isOpen: boolean): string | null | undefined => {
	const { state, controller } = useController(createShareLinkController)
	const isShared = isDesktopHost()
	const isWatched = isOpen && isShared

	useEffect(
		() => (isWatched ? controller.watch() : undefined),
		[controller, isWatched],
	)

	return isShared ? state.shareLink : undefined
}
