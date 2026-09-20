import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import type { MissionState } from "@workspace/ui/components/mission"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"
import {
	MISSION_STATES,
	MISSION_STATES_WITHOUT_A_PILL,
} from "@workspace/ui/components/missions.fixtures"

const PILLS_THE_STATES_DRAW = 4

const holderOf = (canvasElement: HTMLElement, state: MissionState) => {
	const holder = canvasElement.querySelector(`[data-holds="${state}"]`)
	if (!holder) throw new Error(`Nothing holds the ${state} state`)
	return holder
}

const meta = preview.meta({
	title: "Conversation/Missions/MissionStatePill",
	component: MissionStatePill,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"Where a mission stands, said in words rather than in colour. It speaks for the four states a reader can act on; a mission being worked on or waiting for its companion is not a place it stands, so the pill draws nothing and the animated avatar carries that signal alone. Every label reads on the same badge, the colour sitting on the mark, so no state shouts louder than another. Reach for it inside `MissionHeader` and `MissionCard`.",
			},
		},
	},
	args: { state: "waiting_human" },
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The six states a mission can be in, exhaustively, each in its own holder. Check that four of them name themselves in words on the very same badge, that only the mark changes colour between them, and that `working` and `waiting_bot` leave their holder empty. Adding a state to `MissionState` without adding it here is a type error, so this list cannot drift from the contract. `packages/ui/src/components/mission-card.tsx:43` and `packages/ui/src/components/mission-header.tsx:84` each mount one pill for the state their mission is in.",
			},
		},
	},
	render: () => (
		<div className="flex flex-wrap items-center gap-2">
			{MISSION_STATES.map((state) => (
				<span data-holds={state} key={state}>
					<MissionStatePill state={state} />
				</span>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-state-pill")).toHaveLength(
			PILLS_THE_STATES_DRAW,
		)

		for (const state of MISSION_STATES_WITHOUT_A_PILL) {
			await expect(holderOf(canvasElement, state)).toBeEmptyDOMElement()
		}
	},
})
