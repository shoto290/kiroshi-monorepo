import { useRef } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	litCellIndices,
	Row,
	recordLitCells,
} from "@workspace/storybook/story-utils"
import {
	AppIconMark,
	type AppIconMarkHandle,
	type AppIconMarkProps,
	BRAND_FIELD,
	BRAND_NAME,
	BrandMark,
	PLAYABLE_STATES,
} from "@workspace/ui/components/app-icon-mark"
import { Button } from "@workspace/ui/components/ui/button"

const Performed = (props: AppIconMarkProps) => {
	const markRef = useRef<AppIconMarkHandle>(null)

	return (
		<Row>
			<AppIconMark {...props} ref={markRef} />
			<Button onClick={() => markRef.current?.play()} variant="outline">
				Play one animation
			</Button>
		</Row>
	)
}

const MARK_SIZES = [20, 32, 72, 128]
const STATE_SIZE = 72
const REFERENCE = { width: 401, height: 363, side: 66, edge: 58 }
const MARGIN_CELLS = 1
const CELL_TOLERANCE = 1

const markCanvases = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas[data-cells]"))

const ringCells = () =>
	new Set(
		Array.from(BRAND_FIELD.mask ?? [], (lit, index) => (lit ? index : -1)),
	)

const runLength = (lit: Set<number>, start: number, step: number) => {
	let first = start
	while (!lit.has(first)) first += step
	let length = 0
	while (lit.has(first + length * step)) length++
	return length
}

const expectRingDrawing = async (canvas: HTMLCanvasElement) => {
	const { cells } = BRAND_FIELD
	const ring = ringCells()
	const lit = new Set(litCellIndices(canvas))
	const middle = cells / 2
	const markWidth = cells - 2 * MARGIN_CELLS
	const markHeight = (markWidth * REFERENCE.height) / REFERENCE.width

	await expect(lit.size).toBeGreaterThan(0)
	await expect([...lit].every((index) => ring.has(index))).toBe(true)
	await expect(lit.has(middle * cells + middle)).toBe(false)
	await expect(lit.has(0)).toBe(false)
	await expect(
		Math.abs(
			runLength(lit, middle * cells, 1) -
				(markWidth * REFERENCE.side) / REFERENCE.width,
		),
	).toBeLessThanOrEqual(CELL_TOLERANCE)
	await expect(
		Math.abs(
			runLength(lit, middle, cells) -
				(markHeight * REFERENCE.edge) / REFERENCE.height,
		),
	).toBeLessThanOrEqual(CELL_TOLERANCE)
}

const meta = preview.meta({
	title: "Branding/AppIconMark",
	component: AppIconMark,
	parameters: { layout: "centered" },
	args: { size: 128 },
	argTypes: {
		size: { control: { type: "range", min: 24, max: 256, step: 4 } },
	},
	render: (args) => <Performed {...args} />,
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The mark as the site ships it: the Kiroshi hexagon ring drawn in square cells of the companion screen, #A2B1D0 on white, still at rest and playing one working motion drawn at random every few seconds. Only cells inside the ring ever light; the hole and the outside stay white. Drag `size` to check the ring holds its shape at any size. Press the button to fire one motion now instead of waiting for the scheduler. Under `prefers-reduced-motion`, what the test run renders, the mark holds still and nothing is scheduled.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const mark = canvasElement.querySelector<HTMLElement>(
			'[data-slot="app-icon-mark"]',
		)
		await expect(mark?.dataset.state).toBe("idle")
		await expect(
			mark?.querySelector('[data-slot="avatar-exploration"]'),
		).toHaveAccessibleName(BRAND_NAME)
	},
})

export const Themes = meta.story({
	tags: ["test-only"],
	args: { size: 160 },
	globals: { theme_layout: "side-by-side" },
	parameters: {
		docs: {
			description: {
				story:
					"The mark on both themes. Its cells are #A2B1D0 on a white ground in both, so it must not follow the theme: check the ring reads the same on the light and on the dark panel.",
			},
		},
	},
})

export const EveryState = meta.story({
	beforeEach: recordLitCells,
	render: () => (
		<Row>
			{PLAYABLE_STATES.map((state) => (
				<div className="flex flex-col items-center gap-2" key={state}>
					<BrandMark size={STATE_SIZE} state={state} />
					<span className="text-muted-foreground text-xs">{state}</span>
				</div>
			))}
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The mark playing each of its states at once, with the same motion a working companion shows for that state, running through the cells of the ring only. Check that no cell ever lights in the hole or outside the ring while each state plays. Under `prefers-reduced-motion`, what the test run renders, every tile holds the resting ring.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const marks = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'[data-slot="avatar-exploration"]',
			),
		)

		await expect(marks.map((mark) => mark.dataset.state)).toEqual(
			PLAYABLE_STATES,
		)
		for (const canvas of markCanvases(canvasElement))
			await expectRingDrawing(canvas)
	},
})

export const EverySize = meta.story({
	beforeEach: recordLitCells,
	render: () => (
		<Row>
			{MARK_SIZES.map((size) => (
				<BrandMark key={size} size={size} />
			))}
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The resting mark at 20, 32, 72 and 128 px. The grid keeps its cell count and only the cell grows, so the ring is one drawing at four scales. Check that the ring is as thick at its side points and at its flat edges as the logo, and that the 20 px tile still reads as a ring with a hole.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvases = markCanvases(canvasElement)

		await expect(canvases).toHaveLength(MARK_SIZES.length)
		for (const canvas of canvases) await expectRingDrawing(canvas)
	},
})
