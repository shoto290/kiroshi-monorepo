import { expect, waitFor } from "storybook/test"

import {
	CompanionStatesRoster,
	playCompanionStatesRoster,
} from "@workspace/storybook/companion-states-roster"
import preview from "@workspace/storybook/preview"
import { drawingOf, recordLitCells } from "@workspace/storybook/story-utils"
import { BLOT_TINTS } from "@workspace/ui/components/companion-colour"
import { DitheredFieldAvatar } from "@workspace/ui/components/dithered-field-avatar"
import { contrastRatio, type Rgb } from "@workspace/ui/lib/contrast"

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
const TRANSPARENT = "rgba(0, 0, 0, 0)"
const CELL_CONTRAST_FLOOR = 3

const drawnCanvases = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas[data-cells]"))

const expectOneDrawing = async (root: HTMLElement, count: number) => {
	const canvases = drawnCanvases(root)
	await expect(canvases).toHaveLength(count)
	await expect(
		new Set(canvases.map((canvas) => canvas.dataset.cells)).size,
	).toBe(1)
	await waitFor(() => expect(drawingOf(canvases[0])).not.toBe(""))
	await expect(new Set(canvases.map(drawingOf)).size).toBe(1)
}

const framesIn = (root: HTMLElement) =>
	Array.from(
		root.querySelectorAll<HTMLElement>('[data-slot="companion-field"]'),
	)

const schemeOf = (frame: HTMLElement) =>
	frame.closest(".dark") ? "dark" : "light"

const createPixel = () => {
	const pixel = document
		.createElement("canvas")
		.getContext("2d", { willReadFrequently: true })
	if (!pixel) throw new Error("2D canvas context unavailable")
	return pixel
}

const rasterised = (pixel: CanvasRenderingContext2D, color: string): Rgb => {
	pixel.clearRect(0, 0, 1, 1)
	pixel.fillStyle = color
	pixel.fillRect(0, 0, 1, 1)
	const [red, green, blue] = pixel.getImageData(0, 0, 1, 1).data
	return [red, green, blue]
}

const cellContrastOf = (
	pixel: CanvasRenderingContext2D,
	frame: HTMLElement,
) => {
	const canvas = frame.querySelector("canvas")
	const surface = frame.closest<HTMLElement>(".light, .dark")
	if (!canvas || !surface) throw new Error("Avatar outside a themed surface")
	return contrastRatio(
		rasterised(pixel, getComputedStyle(canvas).color),
		rasterised(pixel, getComputedStyle(surface).backgroundColor),
	)
}

const meta = preview.meta({
	title: "Branding/DitheredFieldAvatar",
	component: DitheredFieldAvatar,
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				component:
					"A companion drawn as a dithered field of cells only: square cells in the companion colour straight on whatever surface holds them, no ground, no outline, the shape carried by cell density alone. The hue is the companion's in both themes; its lightness rises on dark so the cells keep 3:1 against the surface. Every companion shares one screen: each cell is a square of one fixed size, its tone carried by opacity in two steps through error diffusion, so the field reads in two tones of one hue over the bare surface. The density field is the companion's ASCII glyph silhouette, blurred, over a seeded low noise floor, all seeded on the name. The grid holds the same cell count at every size. At work the field drifts and the state motion passes through it; at rest, and under reduced motion, it holds still.",
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
					"The avatar as the app draws it, at 40 px: one companion with no colour, which takes the Kiroshi blue, then one per colour. Every field uses the same screen, so the row reads as one family parted by silhouette and hue. Check that the cells read against the bare surface in both themes, that nothing paints behind them, and that every field holds still at rest.",
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

export const EveryState = meta.story({
	render: () => <CompanionStatesRoster Avatar={DitheredFieldAvatar} />,
	parameters: {
		docs: {
			description: {
				story:
					"The square tone screen at work: in the mixed row, companions rest, think, search, write and work side by side, and the field drifts under each state's motion. The radios switch every companion to one state; pick `idle` and every field holds still, pick `working` and they all move. The ladder below shows the first companion at 16, 40 and 96 px in the same state.",
			},
		},
	},
	play: playCompanionStatesRoster,
})

export const OneDrawingAtEverySize = meta.story({
	tags: ["test-only"],
	beforeEach: recordLitCells,
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
					"One companion at 20, 40 and 96 px, the header, the sidebar and the settings sizes. The grid holds the same number of cells at every size and only the cell grows, so the three fields are one drawing at three scales. Check that the 20 px field reads as a shrunken 40 px one, not as a coarser mosaic.",
			},
		},
	},
	play: ({ canvasElement }) =>
		expectOneDrawing(canvasElement, COMPARED_SIZES.length * 2),
})

export const OneGlyphInEveryColour = meta.story({
	beforeEach: recordLitCells,
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
					"One companion with no colour, then in each of the eight colours, as the Appearance picker lays its swatches. The seed comes from the name alone, so only the field colour changes and the glyph stays the companion's. Check that the nine fields carry one shape and that each reads on the bare surface in both themes: the test asserts every frame paints a transparent background and every cell ink holds 3:1 against the surface behind it, light and dark.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectOneDrawing(canvasElement, COLOURS.length * 2)
		const frames = framesIn(canvasElement)
		const pixel = createPixel()
		const faint = frames
			.map((frame, index) => ({
				label: `${schemeOf(frame)} ${COLOURS[index % COLOURS.length] ?? "untinted"}`,
				ratio: cellContrastOf(pixel, frame),
			}))
			.filter(({ ratio }) => ratio < CELL_CONTRAST_FLOOR)
			.map(({ label, ratio }) => `${label} ${ratio.toFixed(2)}`)

		await expect(frames.map(schemeOf)).toEqual(
			["light", "dark"].flatMap((scheme) => COLOURS.map(() => scheme)),
		)
		await expect(
			frames.map((frame) => getComputedStyle(frame).backgroundColor),
		).toEqual(frames.map(() => TRANSPARENT))
		await expect(faint).toEqual([])
	},
})
