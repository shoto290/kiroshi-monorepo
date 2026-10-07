import { useEffect } from "react"

import type { SpaceHosting } from "@workspace/ui/components/space-settings-dialog"

import { createHostingController, type HostedSpace } from "./hosting-controller"
import { isDesktopHost } from "./index"

import type { HostingState } from "../bindings"
import { useController } from "../use-controller"

export type HostingProps = {
	hosting: SpaceHosting
	onHost: () => void
	onStopHosting: () => void
}

const SPACE_HOSTING: Record<HostingState["kind"], SpaceHosting> = {
	off: "off",
	connecting: "connecting",
	online: "online",
	failed: "off",
	needsSignIn: "signed-out",
}

export const useHosting = (
	openSpace: HostedSpace | null,
): HostingProps | undefined => {
	const { state, controller } = useController(createHostingController)
	const watchedSpace = isDesktopHost() ? openSpace : null
	const watchedId = watchedSpace?.id
	const watchedName = watchedSpace?.name

	useEffect(
		() =>
			watchedId === undefined || watchedName === undefined
				? undefined
				: controller.watch({ id: watchedId, name: watchedName }),
		[controller, watchedId, watchedName],
	)

	if (!watchedSpace || !state.hosting) return undefined
	return {
		hosting: SPACE_HOSTING[state.hosting.kind],
		onHost: controller.start,
		onStopHosting: controller.stop,
	}
}
