import { routinesTransport } from "./routines-transport"
import type { ReportedRunsReader } from "./run-port"

import { isDesktopHost } from "../host"

export const createReportedRunsReader = (): ReportedRunsReader =>
	isDesktopHost() ? routinesTransport.reportedRuns : async () => []
