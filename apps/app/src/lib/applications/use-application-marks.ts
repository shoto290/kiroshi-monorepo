import { useEffect } from "react"

import type { ApplicationsController } from "./applications-controller"

import type { BotMcpServer } from "../conversations/store-contract"

const NAME_SEPARATOR = "\n"

const isUnmarked = ({ title, logo, logoUrl }: BotMcpServer) =>
	title === undefined && logo === undefined && logoUrl === undefined

export const useApplicationMarks = (
	controller: ApplicationsController,
	servers: BotMcpServer[],
) => {
	const unmarkedNames = servers
		.filter(isUnmarked)
		.map((server) => server.name)
		.join(NAME_SEPARATOR)

	useEffect(() => {
		if (unmarkedNames === "") {
			return
		}
		controller.resolveMarks(unmarkedNames.split(NAME_SEPARATOR))
	}, [controller, unmarkedNames])
}
