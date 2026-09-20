import type { ComponentProps, ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotsIn } from "@workspace/storybook/story-utils"
import { BotSeal } from "@workspace/ui/components/bot-seal"
import {
	BOT_SEAL_STATES,
	type BotSealState,
} from "@workspace/ui/components/bot-seal-frame"

const CHIP_SIZE = 40
const HERO_SIZE = 200
const STILL_FRAMES = 6
const MATRIX_SEEDS = 8

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

const ChipRow = ({ seed }: { seed: string }) => (
	<div className="flex items-center gap-3">
		<span className="w-16 text-muted-foreground text-xs">{seed}</span>
		<BotSeal seed={seed} size={CHIP_SIZE} state={undefined} />
		{BOT_SEAL_STATES.map((state) => (
			<BotSeal key={state} seed={seed} size={CHIP_SIZE} state={state} />
		))}
	</div>
)

const StateRow = ({
	label,
	state,
}: {
	label: string
	state?: BotSealState
}) => (
	<div className="flex flex-col gap-3">
		<h3 className="font-medium text-muted-foreground text-sm">{label}</h3>
		<div className="flex flex-wrap items-end gap-6">
			{SEEDS.slice(0, MATRIX_SEEDS).map((seed) => (
				<StatePair key={seed} seed={seed} state={state} />
			))}
		</div>
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
					"Reach for this to audition one identity: type any seed and watch the mark it draws, then switch the state to see what that mark does while it works. The seed is the only input — the same string always draws the same mark, so a url carrying a typed seed reopens on it. Leave the state empty for the mark a companion wears when nothing is running. The ink is inherited from the text colour of whatever holds the seal, so set the page theme rather than a prop to recolour it. Open it in Storybook for the motion: the test browser forces reduced motion, which freezes every state on its still frame.",
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
					"Twenty identities at chip size and at hero size, the two slots a seal has to survive. Every mark is one flat profile extruded once and drawn in one ink: an edge shows only when a face it belongs to turns toward the reader, so the wall reads as a sliver along one edge of each arm instead of a box. Reach for this after touching the generator: check that no two marks read alike, that the tips are parted by a notch on all twenty, that each one stays inside its box, and that the chip row keeps its notches open. The path is authored in viewBox units, so a chip and its hero are the same string — the play asserts exactly that, and that the twenty differ from each other.",
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
					"Every state the seal can report, plus the mark it wears while nothing runs. It opens on the row a reader actually gets: eight identities, the eight marks side by side at 40px, in the order of the heading. Every state moves the silhouette rather than the thickness of the wall, because a wall a tenth of the width wide cannot be seen at that size — thinking turns the mark in its own plane one arm sector at a time, waiting sways it slowly, working draws every arm in and pushes it back out, writing extends one arm at a time in the plane, searching carries a wave around the arms while the tilt closes the walls to a line, blocked snaps one arm off its axis, done fills the notches back in and settles flat. Each moves in beats: a wind up, an eased move that carries past its mark and settles, then a hold. The blocks below repeat each state at 40px next to 200px, where the stroke carries the same weight on screen. Reach for this when touching the generator or the beats: check that every state is told apart from the resting mark in the first row, that no tip is ever missing, and that every mark is drawn in the one ink it inherits from the page.",
			},
		},
	},
	render: () => (
		<div className="flex flex-col gap-10">
			<div className="flex flex-col gap-2">
				<h3 className="font-medium text-muted-foreground text-sm">
					{["none", ...BOT_SEAL_STATES].join(" · ")}
				</h3>
				{SEEDS.slice(0, MATRIX_SEEDS).map((seed) => (
					<ChipRow key={seed} seed={seed} />
				))}
			</div>
			<StateRow label="none" state={undefined} />
			{BOT_SEAL_STATES.map((state) => (
				<StateRow key={state} label={state} state={state} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const seals = slotsIn(canvasElement, "bot-seal")
		const inks = seals.flatMap((seal) =>
			Array.from(seal.querySelectorAll("path")).map((path) =>
				path.getAttribute("stroke"),
			),
		)

		await expect(inks).toHaveLength(seals.length)
		await expect(new Set(inks)).toEqual(new Set(["currentColor"]))
	},
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
