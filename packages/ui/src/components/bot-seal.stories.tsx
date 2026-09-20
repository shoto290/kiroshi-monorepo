import type { ComponentProps, ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { BotSeal } from "@workspace/ui/components/bot-seal"
import { BOT_SEAL_STATES } from "@workspace/ui/components/bot-seal-frame"

const CHIP_SIZE = 40
const HERO_SIZE = 200
const STILL_FRAMES = 6

const SEEDS = [
	"amber",
	"basalt",
	"cedar",
	"delta",
	"ember",
	"flint",
	"garnet",
	"harbor",
	"indigo",
	"jasper",
	"kelp",
	"lumen",
	"marble",
	"nimbus",
	"onyx",
	"pewter",
	"quartz",
	"ridge",
	"slate",
	"topaz",
]

const STATE_SEED = "nimbus"

const LabeledCell = ({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) => (
	<div className="flex flex-col items-center gap-1">
		{children}
		<span className="text-muted-foreground text-xs">{label}</span>
	</div>
)

const StatePair = (seal: ComponentProps<typeof BotSeal>) => (
	<div className="flex items-end gap-4">
		<BotSeal {...seal} size={CHIP_SIZE} />
		<BotSeal {...seal} size={HERO_SIZE} />
	</div>
)

const drawingOf = (seal: Element) =>
	Array.from(seal.querySelectorAll("path"))
		.map((path) => path.getAttribute("d"))
		.join("|")

const drawingsIn = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "bot-seal").map(drawingOf)

const afterFrames = (count: number) =>
	new Promise<void>((resolve) => {
		const step = (left: number) =>
			left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
		step(count)
	})

const meta = preview.meta({
	title: "Branding/Companion Seal",
	component: BotSeal,
	parameters: { layout: "centered" },
	args: { seed: STATE_SEED, size: HERO_SIZE, state: undefined },
	argTypes: {
		seed: { control: "text" },
		state: { control: "select", options: [undefined, ...BOT_SEAL_STATES] },
		size: { control: { type: "range", min: 24, max: 320, step: 8 } },
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this to audition one identity: type any seed and watch the solid it draws, then switch the state to see what that solid does while it works. The seed is the only input — the same string always draws the same solid, so a url carrying a typed seed reopens on the same mark. Leave the state empty for the mark a companion wears when nothing is running. Open it in Storybook for the motion: the test browser forces reduced motion, which freezes every state on its still frame.",
			},
		},
	},
})

export const Seeds = meta.story({
	parameters: {
		layout: "padded",
		docs: {
			description: {
				story:
					"Twenty identities at chip size and at hero size, the two slots a seal has to survive. An edge is drawn only when one of the two faces meeting on it turns toward the reader, so the mark reads as a solid rather than a wireframe tangle. Reach for this after touching the generator: check that no two marks read as the same solid, that none of them shows an edge that should sit behind the body, that each one stays inside its box, and that the 40px row still holds a one pixel line instead of thinning to a hairline. The path data is authored in viewBox units, so a chip and its hero are the same string — the play asserts exactly that, and that the twenty differ from each other.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-10">
			<div className="flex flex-wrap items-center gap-3">
				{SEEDS.map((seed) => (
					<BotSeal {...args} key={seed} seed={seed} size={CHIP_SIZE} />
				))}
			</div>
			<div className="grid grid-cols-5 gap-4">
				{SEEDS.map((seed) => (
					<LabeledCell key={seed} label={seed}>
						<BotSeal {...args} seed={seed} size={HERO_SIZE} />
					</LabeledCell>
				))}
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const drawings = drawingsIn(canvasElement)
		const chips = drawings.slice(0, SEEDS.length)
		const heroes = drawings.slice(SEEDS.length)

		await expect(chips).toEqual(heroes)
		await expect(new Set(chips).size).toBe(SEEDS.length)
	},
})

export const States = meta.story({
	parameters: {
		layout: "padded",
		docs: {
			description: {
				story:
					"One identity through the seven states it can report, plus the mark it wears while nothing runs, each state at the chip size next to the hero size so a state that reads at 200px but smears at 40px is caught here. Four of them move, and each moves in beats rather than at a constant rate: a short wind up, an eased move that carries past its mark and settles, then a hold before the next beat. Thinking turns the solid by one arm sector at a time, searching carries the cut across it in one eased pass and holds it clear, working compresses the extrusion before overshooting it, writing extrudes one arm at a time and holds the solid out before it retracts. This story shows the frame each one holds under reduced motion. The three that never move are the ones to judge here: waiting drops the companion colour for the attention token, blocked snaps one arm off its axis, done flattens the solid onto a single glyph.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-2 gap-6">
			<LabeledCell label="none">
				<StatePair {...args} state={undefined} />
			</LabeledCell>
			{BOT_SEAL_STATES.map((state) => (
				<LabeledCell key={state} label={state}>
					<StatePair {...args} state={state} />
				</LabeledCell>
			))}
		</div>
	),
})

export const ReducedMotion = meta.story({
	tags: ["test-only"],
	args: { state: "thinking" },
	parameters: {
		docs: {
			description: {
				story:
					"The state that turns the solid, rendered where the reader asked for reduced motion. Reach for this when touching the frame loop: the seal must hold the still frame of the state it is in and never ask for an animation frame. The play reads the path data, lets several frames pass, and reads it again.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const before = drawingsIn(canvasElement)

		await afterFrames(STILL_FRAMES)

		await expect(drawingsIn(canvasElement)).toEqual(before)
	},
})
