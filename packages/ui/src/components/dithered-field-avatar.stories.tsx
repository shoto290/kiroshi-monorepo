import { expect, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { BLOT_TINTS } from "@workspace/ui/components/companion-colour"
import { DitheredFieldAvatar } from "@workspace/ui/components/dithered-field-avatar"

const NAMES = [
	"Lyra",
	"Orion",
	"Nova",
	"Mira",
	"Vega",
	"Juno",
	"Castor",
	"Altair",
	"Atlas",
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
					"A companion drawn as a dithered field that fills the whole rounded tile: square cells in the companion colour on a pale tint of that same colour, no outline, the shape carried by cell density alone. Every companion shares one screen: each cell is a square of one fixed size, its tone carried by opacity in two steps through error diffusion, so the tile reads in three tones of one hue. The density field is the companion's ASCII glyph silhouette, blurred, over a seeded low noise floor, all seeded on the name. The grid holds the same cell count at every size. At work the field drifts and the state motion passes through it; at rest, and under reduced motion, it holds still.",
			},
		},
	},
})

const STILL_WAIT = 300

const pause = (duration: number) =>
	new Promise((resolve) => setTimeout(resolve, duration))

export const OneScreenForEveryCompanion = meta.story({
	render: () => (
		<div aria-label="Companions" className="flex flex-wrap gap-4" role="group">
			{NAMES.map((name, index) => (
				<div className="flex flex-col items-center gap-2" key={name}>
					<DitheredFieldAvatar name={name} size={40} tint={COLOURS[index]} />
					<span className="text-muted-foreground text-xs">{name}</span>
				</div>
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The avatar as the app draws it, at 40 px: one companion with no colour, which takes the Kiroshi blue, then one per colour. Every tile uses the same screen, so the row reads as one family parted by silhouette and hue. Check that the cells read darker than their pale ground in both themes, and that every tile holds still at rest.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvases = drawnCanvases(canvasElement)
		const screens = canvases.map((canvas) => canvas.dataset.screen)

		await expect(canvases).toHaveLength(NAMES.length * 2)
		await expect(new Set(screens).size).toBe(1)
		const before = canvases.map((canvas) => canvas.toDataURL())
		await pause(STILL_WAIT)
		await expect(canvases.map((canvas) => canvas.toDataURL())).toEqual(before)
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
