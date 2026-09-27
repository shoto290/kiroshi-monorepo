import { expect, waitFor } from "storybook/test"

import {
	ExplorationRoster,
	playExplorationRoster,
} from "@workspace/storybook/avatar-exploration-roster"
import preview from "@workspace/storybook/preview"
import type { ExplorationAvatarProps } from "@workspace/ui/components/avatar-exploration"
import { BLOT_TINTS } from "@workspace/ui/components/companion-colour"
import {
	DITHER_SCREENS,
	DitheredFieldAvatar,
	type DitherScreen,
} from "@workspace/ui/components/dithered-field-avatar"

const screenAvatar = (screen: DitherScreen) => {
	const ScreenAvatar = (props: ExplorationAvatarProps) => (
		<DitheredFieldAvatar {...props} screen={screen} />
	)
	return ScreenAvatar
}

const WeightRampAvatar = screenAvatar("weight")
const HalftoneAvatar = screenAvatar("halftone")
const OrderedAvatar = screenAvatar("ordered")
const OrganicAvatar = screenAvatar("organic")

const NAMES = [
	"Lyra",
	"Orion",
	"Nova",
	"Mira",
	"Vega",
	"Juno",
	"Castor",
	"Altair",
]

const COMPARED_NAME = "Atlas"
const COMPARED_SIZES = [20, 40, 96]
const COLOURS = [undefined, ...BLOT_TINTS]

const drawnCanvases = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas[data-cells]"))

const inkedCells = (canvas: HTMLCanvasElement) => {
	const cells = Number(canvas.dataset.cells)
	const cell = canvas.width / cells
	const { data } =
		canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height) ??
		{}
	return Array.from({ length: cells * cells }, (_, index) => {
		const x = Math.floor(((index % cells) + 0.5) * cell)
		const y = Math.floor((Math.floor(index / cells) + 0.5) * cell)
		return (data?.[(y * canvas.width + x) * 4 + 3] ?? 0) > 64 ? "#" : "."
	}).join("")
}

const expectOneDrawing = async (root: HTMLElement, count: number) => {
	const canvases = drawnCanvases(root)
	await expect(canvases).toHaveLength(count)
	await expect(
		new Set(canvases.map((canvas) => canvas.dataset.cells)).size,
	).toBe(1)
	await waitFor(() => expect(new Set(canvases.map(inkedCells)).size).toBe(1))
}

const meta = preview.meta({
	title: "Branding/DitheredFieldAvatar",
	component: DitheredFieldAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"A companion drawn as a dithered field that fills the whole rounded tile: white ink on a saturated field of the companion's hue, no outline, the shape carried by density alone. The density field is the companion's ASCII glyph silhouette, blurred, over a seeded low noise floor; the hue is the chosen colour's hue pushed to a saturated field and nudged by the seed. At 40 px the screen reads as texture and the identity comes from the macro shape of the field and its hue. At work the field drifts and the state motion passes through it; at rest, and under reduced motion, it holds still.",
			},
		},
	},
})

export const WeightRamp = meta.story({
	render: () => <ExplorationRoster Avatar={WeightRampAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"Each cell picks its glyph from a ramp of increasing ink weight by the field density: a dot, a small square, a cross, a filled square. Check that the six silhouettes part at 40 px and that the 16 px one still shows its mass.",
			},
		},
	},
	play: playExplorationRoster,
})

export const Halftone = meta.story({
	render: () => <ExplorationRoster Avatar={HalftoneAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"One dot per cell, its radius following the field density. Check that the silhouettes part at 40 px by where the dots swell, and that the 16 px one reads as a soft blob of the right shape.",
			},
		},
	},
	play: playExplorationRoster,
})

export const TwoToneOrdered = meta.story({
	render: () => <ExplorationRoster Avatar={OrderedAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"The density thresholded through a 4 by 4 Bayer matrix into one square glyph, on or off. Check that the crosshatch of the Bayer pattern stays even and that the silhouettes part at 40 px.",
			},
		},
	},
	play: playExplorationRoster,
})

export const ThreeToneOrganic = meta.story({
	render: () => <ExplorationRoster Avatar={OrganicAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"White ink plus a lighter tint of the hue on the field, through Floyd-Steinberg error diffusion over three tones. Check that the grain looks organic rather than gridded and that the silhouettes part at 40 px.",
			},
		},
	},
	play: playExplorationRoster,
})

export const ScreensByName = meta.story({
	render: () => (
		<div aria-label="Companions" className="flex flex-wrap gap-4" role="group">
			{NAMES.map((name, index) => (
				<div className="flex flex-col items-center gap-2" key={name}>
					<DitheredFieldAvatar
						name={name}
						size={40}
						tint={BLOT_TINTS[index % BLOT_TINTS.length]}
					/>
					<span className="text-muted-foreground text-xs">{name}</span>
				</div>
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The avatar as the app draws it: no screen pinned, so each companion's screen is picked from its name alone and a colour change never swaps it. Eight names, chosen so each of the four screens appears at least once. Check that every tile is a still field at rest and that each reads by its silhouette at 40 px.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const screens = Array.from(
			canvasElement.querySelectorAll<HTMLCanvasElement>("canvas[data-screen]"),
			(canvas) => canvas.dataset.screen,
		)

		await expect(screens).toHaveLength(NAMES.length * 2)
		await expect(new Set(screens)).toEqual(new Set(DITHER_SCREENS))
	},
})

export const OneDrawingAtEverySize = meta.story({
	render: () => (
		<div aria-label="Sizes" className="flex items-end gap-4" role="group">
			{COMPARED_SIZES.map((size) => (
				<DitheredFieldAvatar key={size} name={COMPARED_NAME} size={size} />
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"One companion at 20, 40 and 96 px, the header, the sidebar and the settings sizes. The grid holds the same number of cells at every size and only the cell grows, so the three tiles are one drawing at three scales. Check that the 20 px tile reads as a shrunken 40 px one, not as a coarser mosaic.",
			},
		},
	},
	play: ({ canvasElement }) =>
		expectOneDrawing(canvasElement, COMPARED_SIZES.length * 2),
})

export const OneGlyphInEveryColour = meta.story({
	render: () => (
		<div aria-label="Colours" className="flex flex-wrap gap-4" role="group">
			{COLOURS.map((tint) => (
				<DitheredFieldAvatar
					key={tint ?? "none"}
					name={COMPARED_NAME}
					tint={tint}
				/>
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"One companion with no colour, then in each of the eight colours, as the Appearance picker lays its swatches. The seed comes from the name alone, so only the field colour changes and the glyph stays the companion's. Check that the nine tiles carry one shape.",
			},
		},
	},
	play: ({ canvasElement }) =>
		expectOneDrawing(canvasElement, COLOURS.length * 2),
})
