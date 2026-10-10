import { joinedHosts } from "./index"
import type { JoinedHostsState } from "./joined-hosts"

import { useControllerState } from "../use-controller"

export const LOCAL_HOST = "local"

const reachableHostOf = ({
	active,
	connections,
}: JoinedHostsState): string | null => {
	if (active === null) {
		return LOCAL_HOST
	}
	const status = connections[active]?.status
	return status === "down" || status === "refused" ? null : active
}

export const useReachableHost = (): string | null =>
	reachableHostOf(useControllerState(joinedHosts))
