import { useEffect } from "react"

import { isDesktopHost } from "./index"
import { createShareLinkController } from "./share-link-controller"

import { useController } from "../use-controller"

export const useShareLink = (
	openSpaceId: string | null,
): string | null | undefined => {
	const { state, controller } = useController(createShareLinkController)
	const isShared = isDesktopHost()
	const watchedSpaceId = isShared ? openSpaceId : null

	useEffect(
		() => (watchedSpaceId ? controller.watch(watchedSpaceId) : undefined),
		[controller, watchedSpaceId],
	)

	return isShared ? state.shareLink : undefined
}
