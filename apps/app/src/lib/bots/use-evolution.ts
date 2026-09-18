import { useEffect } from "react"

import {
	type EvolutionSourceOptions,
	startEvolutionSource,
} from "./evolution-source"

export const useEvolution = ({
	driver,
	roster,
	companionPlugin,
	userPlugin,
	spacePlugin,
}: EvolutionSourceOptions) => {
	useEffect(
		() =>
			startEvolutionSource({
				driver,
				roster,
				companionPlugin,
				userPlugin,
				spacePlugin,
			}),
		[driver, roster, companionPlugin, userPlugin, spacePlugin],
	)
}
