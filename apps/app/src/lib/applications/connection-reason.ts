import type { BotMcpConnectionReason } from "@workspace/ui/components/bot-settings"

type CarriedReasonKind = Exclude<BotMcpConnectionReason["kind"], "unknown">

const CARRIED_KIND_OF: Record<string, CarriedReasonKind> = {
	alreadyRunning: "alreadyRunning",
	store: "store",
	transport: "transport",
	refusedUrl: "refusedUrl",
	browserRefused: "browserRefused",
	timedOut: "timedOut",
	flowTimedOut: "timedOut",
}

const textIn = (refusal: unknown, field: string): string | null => {
	if (typeof refusal !== "object" || refusal === null || !(field in refusal)) {
		return null
	}
	const value = (refusal as Record<string, unknown>)[field]
	return typeof value === "string" ? value : null
}

export const toConnectionReason = (
	refusal: unknown,
): BotMcpConnectionReason => {
	const kind = textIn(refusal, "kind")
	if (!kind) {
		return {
			kind: "unknown",
			detail: refusal instanceof Error ? refusal.message : String(refusal),
		}
	}

	const carried = CARRIED_KIND_OF[kind]
	if (carried) {
		return { kind: carried }
	}

	const detail = textIn(refusal, "detail")
	return { kind: "unknown", detail: detail?.trim() ? detail : kind }
}
