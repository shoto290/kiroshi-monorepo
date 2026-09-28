import type { CompanionArrivalListener } from "./conversation-controller"
import { arrivalsTransport } from "./store-transport"

import { drivesRealHost } from "../host"

export const createArrivalsListener = (): CompanionArrivalListener =>
	drivesRealHost()
		? arrivalsTransport.onCompanionArrived
		: async () => () => undefined
