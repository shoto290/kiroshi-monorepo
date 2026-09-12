const NOT_RUNNING = "notRunning"

const NO_DETAIL = "the turn ended with no reason"

const fieldIn = (reason: unknown, field: string): string | null => {
	if (typeof reason !== "object" || reason === null || !(field in reason)) {
		return null
	}
	const value = (reason as Record<string, unknown>)[field]
	return typeof value === "string" ? value : null
}

export const isNotRunning = (reason: unknown): boolean =>
	fieldIn(reason, "kind") === NOT_RUNNING

export const exitDetailOf = (reason: unknown): string => {
	if (reason === undefined || reason === null) {
		return NO_DETAIL
	}
	const named = fieldIn(reason, "detail") ?? fieldIn(reason, "kind")
	if (named) {
		return named
	}
	return reason instanceof Error ? reason.message : String(reason)
}
