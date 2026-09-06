export const MISSION_RUN_OUTPUT_SCHEMA: Record<string, unknown> = {
	type: "object",
	properties: {
		outcome: {
			type: "string",
			enum: ["report"],
			description: "report, the only outcome this mission run may end on",
		},
		report: {
			type: "string",
			minLength: 1,
			description: "the report text of the mission run, never empty",
		},
	},
	required: ["outcome", "report"],
	additionalProperties: false,
}
