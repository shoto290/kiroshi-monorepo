import { routinesTransport } from "./routines-transport"
import type { ReportedRunsReader } from "./run-port"

import { drivesRealHost } from "../host"

export const createReportedRunsReader = (): ReportedRunsReader =>
	drivesRealHost() ? routinesTransport.reportedRuns : async () => []
