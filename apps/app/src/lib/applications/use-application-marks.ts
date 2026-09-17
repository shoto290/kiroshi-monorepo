import { useEffect } from "react"

import type { ApplicationsController } from "./applications-controller"
import { hasKeptMark } from "./connection-settings"

import type { BotMcpServer } from "../conversations/store-contract"

const NAME_SEPARATOR = "\n"

export const useApplicationMarks = (
	controller: ApplicationsController,
	servers: BotMcpServer[],
) => {
	const unmarkedNames = servers
		.filter((server) => !hasKeptMark(server))
		.map((server) => server.name)
		.join(NAME_SEPARATOR)

	useEffect(() => {
		if (unmarkedNames === "") {
			return
		}
		controller.resolveMarks(unmarkedNames.split(NAME_SEPARATOR))
	}, [controller, unmarkedNames])
}
