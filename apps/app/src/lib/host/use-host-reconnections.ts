import { useEffect } from "react"

import { joinedHosts } from "./index"

export const useHostReconnections = (reread: () => void) => {
	useEffect(() => joinedHosts.onReconnected(reread), [reread])
}
