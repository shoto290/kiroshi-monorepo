import type { ReportedRun } from "./routine-contract"

export type ReportedRunsReader = (
	conversationId: string,
) => Promise<ReportedRun[]>
