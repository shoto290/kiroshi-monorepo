import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import {
	MissionActivityLine,
	type MissionActivityLineProps,
} from "@workspace/ui/components/mission-activity-line"
import {
	MISSION_PULL_REQUEST,
	MISSION_TOOL_CALL_SLOTS,
} from "@workspace/ui/components/missions.fixtures"

const LINE: MissionActivityLineProps = {
	commitsAhead: 1,
	pullRequest: MISSION_PULL_REQUEST,
}

const meta = preview.meta({
	title: "Conversation/Missions/MissionActivityLine",
	component: MissionActivityLine,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"How far a mission's branch is ahead and where its pull request is, as one muted line. `MissionRow` draws it under its ticket line and `MissionHeader` under its ticket band; reach for those rather than this line on its own.",
			},
		},
	},
	args: LINE,
	render: (args) => (
		<div className="w-96 max-w-full">
			<MissionActivityLine {...args} />
		</div>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every part of the line at once. Check that the parts read in order, separated by the dot the mission rows use, and that the count reads in the singular for one commit.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [commits] = slotsIn(canvasElement, "mission-commits-ahead")
		await expect(commits).toHaveTextContent("1 commit ahead")
		for (const slot of MISSION_TOOL_CALL_SLOTS) {
			await expect(slotsIn(canvasElement, slot)).toHaveLength(0)
		}
	},
})
