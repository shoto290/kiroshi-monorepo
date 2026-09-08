import { useRef } from "react"

import preview from "@workspace/storybook/preview"
import { Row } from "@workspace/storybook/story-utils"
import {
	AppIconMark,
	type AppIconMarkHandle,
	type AppIconMarkProps,
} from "@workspace/ui/components/app-icon-mark"
import { Button } from "@workspace/ui/components/button"

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
