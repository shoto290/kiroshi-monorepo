import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row, slotIn, slotsIn } from "@workspace/storybook/story-utils"
import { Kbd, KbdGroup } from "@workspace/ui/components/ui/kbd"

const meta = preview.meta({
	title: "Primitives/Kbd",
	component: Kbd,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The key cap a keyboard shortcut is written on, as the shadcn registry ships it: a 20px muted chip that never takes the pointer and never takes a selection. `KbdGroup` sets several of them in a chord. It draws a key and nothing else — binding the key is the caller's work.",
			},
		},
	},
	args: { children: "K" },
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"One key on its own. Check that a single character still reaches the 20px square a cap in a list is measured on, and that the cap ignores the pointer so it never eats a click meant for the row behind it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const kbd = slotIn(canvasElement, "kbd")

		await expect(kbd.getBoundingClientRect().height).toBe(20)
		await expect(kbd.getBoundingClientRect().width).toBeGreaterThanOrEqual(20)
		await expect(getComputedStyle(kbd).pointerEvents).toBe("none")
	},
})

export const LongContent = meta.story({
	args: { children: "Shift" },
	parameters: {
		docs: {
			description: {
				story:
					"A named key rather than a character. Check that the cap grows past its minimum instead of clipping the word, which is what makes it usable for modifiers and not only for digits.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const kbd = slotIn(canvasElement, "kbd")

		await expect(kbd.getBoundingClientRect().width).toBeGreaterThan(20)
		await expect(kbd.scrollWidth).toBe(kbd.clientWidth)
	},
})

export const InGroup = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Several keys read as one chord. Reach for `KbdGroup` over three loose caps when the keys are pressed together: it is what puts the gap between them and keeps them on one line.",
			},
		},
	},
	render: () => (
		<Row>
			<KbdGroup>
				<Kbd>Ctrl</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>
		</Row>
	),
	play: async ({ canvasElement }) => {
		const [modifier, key] = slotsIn(canvasElement, "kbd")

		await expect(modifier.getBoundingClientRect().top).toBe(
			key.getBoundingClientRect().top,
		)
		await expect(
			key.getBoundingClientRect().left - modifier.getBoundingClientRect().right,
		).toBe(4)
	},
})
