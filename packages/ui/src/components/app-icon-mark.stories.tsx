import { useRef } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { expectInkContrast, Row } from "@workspace/storybook/story-utils"
import {
	AppIconMark,
	type AppIconMarkHandle,
	type AppIconMarkProps,
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
					"The mark as the site ships it: the rabbit rests on `waiting` and plays one state drawn at random every few seconds. Drag `size` to check that crop, position and ink weight hold the same proportion to the ground at any size. Press the button to fire one animation now instead of waiting for the scheduler. Under `prefers-reduced-motion` — what the test run renders — the rabbit holds its resting pose and nothing is scheduled.",
			},
		},
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
					"Reach for this before shipping any change to the mark's ink. The ground is the brand cream in both themes, so the drawing must not follow the theme foreground: check that the eyes are the same near-black as the head outline and the ear strokes on the right-hand dark panel, not the near-white the app text takes there. `Default` covers the motion, this one covers the ink.",
			},
		},
	},
})

export const InkDark = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The mark under the dark theme. The ground stays brand cream, so the eyes must keep the near-black blot ink of the outline rather than the near-white text colour of the theme. Pick `Themes` to compare both panels by eye.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const ground = canvasElement.querySelector('[data-slot="app-icon-ground"]')
		const eye = canvasElement.querySelector('[data-part="eye-0"]')
		const outline = canvasElement.querySelector('[data-part="head"] path')
		if (!ground || !eye || !outline) throw new Error("The mark draws no eyes")
		const eyeFill = getComputedStyle(eye).fill

		await expect(eyeFill).toBe(getComputedStyle(outline).stroke)
		await expectInkContrast({
			ink: eyeFill,
			surface: getComputedStyle(ground).fill,
		})
	},
})
