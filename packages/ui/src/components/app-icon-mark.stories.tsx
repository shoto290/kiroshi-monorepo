import { useRef } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row } from "@workspace/storybook/story-utils"
import {
	AppIconMark,
	type AppIconMarkHandle,
	type AppIconMarkProps,
	BRAND_NAME,
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
					"The mark as the site ships it: the brand's own dithered field, its seed, silhouette and screen fixed, still at rest and playing one working motion drawn at random every few seconds. Drag `size` to check the field holds its silhouette at any size. Press the button to fire one motion now instead of waiting for the scheduler. Under `prefers-reduced-motion`, what the test run renders, the mark holds still and nothing is scheduled.",
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
					"The mark on both themes. Its field is the brand hue in both, so it must not follow the theme: check the white ink reads the same on the light and on the dark panel.",
			},
		},
	},
})
