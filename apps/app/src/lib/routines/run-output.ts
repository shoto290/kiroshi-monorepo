export type RunReport =
	| { outcome: "report"; text: string }
	| { outcome: "nothing" }

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

export const readRunReport = (structuredOutput: unknown): RunReport | null => {
	if (!isRecord(structuredOutput)) {
		return null
	}
	const { outcome, report } = structuredOutput
	if (outcome === "nothing") {
		return { outcome: "nothing" }
	}
	if (outcome !== "report" || typeof report !== "string") {
		return null
	}
	const text = report.trim()
	return text.length > 0 ? { outcome: "report", text } : { outcome: "nothing" }
}
