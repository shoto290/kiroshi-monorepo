import type { ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row, slotsIn } from "@workspace/storybook/story-utils"
import { BLOT_TINTS, BotAvatar } from "@workspace/ui/components/bot-avatar"
import {
	ABSTRACT_SHAPES,
	BotTile,
	CHARACTER_SHAPES,
} from "@workspace/ui/components/bot-tile"
import {
	CONVERSATION_BOTS,
	TILE_ROSTER_IDS,
} from "@workspace/ui/components/bots.fixtures"

const SIZES = [28, 40, 64, 240]
const STATES = ["default", "working", "sleeping"] as const
const SHADINGS = ["plastic", "flat"] as const
const VARIANTS = ["neutral", "tinted"] as const
const SHOWCASE_SIZE = 96
const GRID_SIZE = 48
const SIDE_BY_SIDE_BOT = CONVERSATION_BOTS[0]

type LabeledCellProps = { label: string; children: ReactNode }

const LabeledCell = ({ label, children }: LabeledCellProps) => (
	<div className="flex flex-col items-center gap-1">
		{children}
		<span className="text-muted-foreground text-xs">{label}</span>
	</div>
)

const expectTilesRender = async (canvasElement: HTMLElement, count: number) => {
	const tiles = slotsIn(canvasElement, "bot-tile")
	await expect(tiles).toHaveLength(count)
	for (const tile of tiles) {
		await expect(tile.querySelector("canvas")).not.toBeNull()
	}
}

const meta = preview.meta({
	title: "Branding/BotTile",
	component: BotTile,
	parameters: { layout: "centered" },
	args: {
		seed: "bot-atlas",
		size: SHOWCASE_SIZE,
	},
	argTypes: {
		seed: { control: "text" },
		shape: {
			control: "select",
			options: [undefined, ...ABSTRACT_SHAPES, ...CHARACTER_SHAPES],
		},
		blot: { control: "select", options: [undefined, ...BLOT_TINTS] },
		size: { control: { type: "range", min: 24, max: 320, step: 4 } },
		state: { control: "inline-radio", options: STATES },
		shading: {
			control: "inline-radio",
			options: ["plastic", "crisp", "smooth", "flat"],
		},
		variant: { control: "inline-radio", options: VARIANTS },
		includeCharacters: { control: "boolean" },
	},
})

export const Playground = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Audition one tile. With no shape and no blot, both come from the seed, so the same id always draws the same tile. Check that the shape sits centred at about 70 percent of the tile and that only the working state moves.",
			},
		},
	},
	play: async ({ canvasElement }) => expectTilesRender(canvasElement, 1),
})

export const ShapesByBlot = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The nine abstract shapes the seed picks from, across the eight blots. Check that every shape reads on every tint and that no tint collapses into the neutral slab.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-3">
			{BLOT_TINTS.map((blot) => (
				<Row key={blot}>
					{ABSTRACT_SHAPES.map((shape) => (
						<BotTile
							{...args}
							key={shape}
							blot={blot}
							shape={shape}
							size={GRID_SIZE}
						/>
					))}
				</Row>
			))}
		</div>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(
			canvasElement,
			ABSTRACT_SHAPES.length * BLOT_TINTS.length,
		),
})

export const TileStyles = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The neutral slab on the muted surface next to the tile tinted from the bot's own blot. Pick one for the product.",
			},
		},
	},
	render: (args) => (
		<Row>
			{VARIANTS.map((variant) => (
				<LabeledCell key={variant} label={variant}>
					<BotTile {...args} variant={variant} />
				</LabeledCell>
			))}
		</Row>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(canvasElement, VARIANTS.length),
})

export const Shading = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The library's plastic lighting next to flat cel shading, on the same seed. Pick one for the product.",
			},
		},
	},
	render: (args) => (
		<Row>
			{SHADINGS.map((shading) => (
				<LabeledCell key={shading} label={shading}>
					<BotTile {...args} shading={shading} />
				</LabeledCell>
			))}
		</Row>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(canvasElement, SHADINGS.length),
})

export const Sizes = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"From chip to hero. The corner radius is a quarter of the side at every size, so the tile keeps one silhouette.",
			},
		},
	},
	render: (args) => (
		<div className="flex items-end gap-6">
			{SIZES.map((size) => (
				<LabeledCell key={size} label={`${size}px`}>
					<BotTile {...args} size={size} />
				</LabeledCell>
			))}
		</div>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(canvasElement, SIZES.length),
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Idle is a still image, working animates, sleeping is the library's sleeping pose held still.",
			},
		},
	},
	render: (args) => (
		<Row>
			{STATES.map((state) => (
				<LabeledCell key={state} label={state}>
					<BotTile {...args} state={state} />
				</LabeledCell>
			))}
		</Row>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(canvasElement, STATES.length),
})

export const Roster = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Twelve bots seeded from their ids alone, as a roster would draw them. Check that neighbours are told apart by shape and blot.",
			},
		},
	},
	render: (args) => (
		<div className="grid grid-cols-6 gap-3">
			{TILE_ROSTER_IDS.map((seed) => (
				<BotTile {...args} key={seed} seed={seed} size={GRID_SIZE} />
			))}
		</div>
	),
	play: async ({ canvasElement }) =>
		expectTilesRender(canvasElement, TILE_ROSTER_IDS.length),
})

export const SideBySide = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Today's companion avatar next to the tile for the same bot and blot, at the same size.",
			},
		},
	},
	render: (args) => (
		<Row>
			<LabeledCell label="BotAvatar">
				<BotAvatar
					animal={SIDE_BY_SIDE_BOT.animal}
					blot={SIDE_BY_SIDE_BOT.blot}
					seed={SIDE_BY_SIDE_BOT.id}
					animated={false}
					size={SHOWCASE_SIZE}
				/>
			</LabeledCell>
			<LabeledCell label="BotTile">
				<BotTile
					{...args}
					seed={SIDE_BY_SIDE_BOT.id}
					blot={SIDE_BY_SIDE_BOT.blot}
					size={SHOWCASE_SIZE}
				/>
			</LabeledCell>
		</Row>
	),
	play: async ({ canvasElement }) => expectTilesRender(canvasElement, 1),
})
