import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row } from "@workspace/storybook/story-utils"
import { ProgressRing } from "@workspace/ui/components/progress-ring"

const RING_VALUES = [0, 64, 100]

const RING_LABEL = "Update download progress"

const meta = preview.meta({
	title: "Feedback/ProgressRing",
	component: ProgressRing,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The same determinate value as `Progress`, closing as an arc instead of filling a bar, for the places a bar cannot go - this is how `Feedback/UpdateBadge` reports its download around a 36px button. The drawing is `aria-hidden`, so the value reaches assistive technology from the root alone. Size it from `className`: the arc scales with the box and has no size prop of its own.",
			},
		},
	},
	args: { "aria-label": RING_LABEL, className: "size-9", value: 64 },
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100, step: 1 } },
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The nominal case at 64 percent. Check the arc starts at twelve o'clock and grows clockwise, and that the value still reaches assistive technology from the root.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("progressbar", { name: RING_LABEL }),
		).toHaveAttribute("aria-valuenow", "64")
	},
})

export const Values = meta.story({
	render: () => (
		<Row>
			{RING_VALUES.map((value) => (
				<ProgressRing
					aria-label={`${RING_LABEL} ${value}`}
					className="size-9"
					key={value}
					value={value}
				/>
			))}
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The two ends of the range and a point between them. Check that 0 leaves the arc empty rather than drawing a stub, that 100 closes the circle with no seam at twelve o'clock, and that the fraction of the circumference painted matches the value.",
			},
		},
	},
	play: async ({ canvas }) => {
		const bars = canvas.getAllByRole("progressbar")

		await expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual(
			RING_VALUES.map(String),
		)

		const [empty, partial, full] = bars.map((bar) =>
			Number(
				bar.querySelectorAll("circle")[1].getAttribute("stroke-dashoffset"),
			),
		)
		const circumference = 2 * Math.PI * 16

		await expect(empty).toBeCloseTo(circumference, 3)
		await expect(partial).toBeCloseTo(circumference * 0.36, 3)
		await expect(full).toBeCloseTo(0, 3)
	},
})

export const ZeroValue = meta.story({
	args: { value: 0 },
	parameters: {
		docs: {
			description: {
				story:
					"A download that has started but moved nothing yet. Check the track ring is still drawn so the reader sees a shape waiting to fill rather than an empty hole, and that the announced value is 0 rather than absent - `Progress` covers the case where the size is unknown instead.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("progressbar", { name: RING_LABEL }),
		).toHaveAttribute("aria-valuenow", "0")
	},
})
