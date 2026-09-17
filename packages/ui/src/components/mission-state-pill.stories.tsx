import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	listExhaustively,
} from "@workspace/storybook/story-utils"
import type { MissionState } from "@workspace/ui/components/mission"
import { MissionStatePill } from "@workspace/ui/components/mission-state-pill"

const MISSION_STATES = listExhaustively<MissionState>({
	working: true,
	waiting_bot: true,
	waiting_human: true,
	ready_to_merge: true,
	failed: true,
	done: true,
})

const meta = preview.meta({
	title: "Conversation/Missions/MissionStatePill",
	component: MissionStatePill,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"Where a mission stands, said in words rather than in colour. Every surface that shows a mission reads its state from this one pill, so a reader who cannot tell the marks apart still reads the state from the label. Reach for it inside `MissionHeader` and `MissionCard`; on its own it is only useful to compare the six states side by side.",
			},
		},
	},
	args: { state: "working" },
})

export const States = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The six states a mission can be in, exhaustively. Check that each one names itself in words, that only `waiting_human` and `failed` carry a colour that pulls the eye, and that `working` is the only mark that turns. Adding a state to `MISSION_STATES` without adding it here is a type error, so this list cannot drift from the contract. `packages/ui/src/components/mission-card.tsx:32` and `packages/ui/src/components/mission-header.tsx:80` each mount one pill for the state their mission is in; the six are gathered here because every one of them reaches a reader, and the list is exhaustive so the contract cannot drift.",
			},
		},
	},
	render: () => (
		<div className="flex flex-wrap items-center gap-2">
			{MISSION_STATES.map((state) => (
				<MissionStatePill key={state} state={state} />
			))}
		</div>
	),
})
