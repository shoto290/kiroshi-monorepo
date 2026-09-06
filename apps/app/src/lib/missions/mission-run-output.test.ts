import { describe, expect, it } from "vitest"

import { MISSION_RUN_OUTPUT_SCHEMA } from "./mission-run-output"

describe("MISSION_RUN_OUTPUT_SCHEMA", () => {
	it("accepts a report and nothing else", () => {
		expect(MISSION_RUN_OUTPUT_SCHEMA).toMatchObject({
			properties: {
				outcome: { enum: ["report"] },
				report: { minLength: 1 },
			},
			required: ["outcome", "report"],
		})
	})

	it("names a mission run in every description it carries", () => {
		const described = JSON.stringify(MISSION_RUN_OUTPUT_SCHEMA)

		expect(described).not.toContain("routine")
		expect(described).toContain("mission run")
	})
})
