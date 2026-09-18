import { useEffect } from "react"

import { createUpdater } from "./create-updater"
import {
	createUpdaterController,
	type UpdaterController,
	type UpdaterState,
} from "./updater-controller"

import { useController } from "../use-controller"

export type Updater = {
	state: UpdaterState
	controller: UpdaterController
}

export const useUpdater = (): Updater => {
	const { state, controller } = useController(() =>
		createUpdaterController(createUpdater()),
	)

	useEffect(() => controller.start(), [controller])

	return { state, controller }
}
