import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { Row, UPLOADED_AVATAR_IMAGE } from "@workspace/storybook/story-utils"
import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@workspace/ui/components/ui/avatar"

const NAME = "Ada Martin"

const meta = preview.meta({
	title: "Primitives/Avatar",
	component: Avatar,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The avatar as the shadcn registry ships it: a root that picks a size from the closed set `sm`, `default`, `lg` - 24, 32 and 40 pixels - with `AvatarImage` and `AvatarFallback` swapping on load. Reach for `InitialsAvatar` when the size comes from the caller in pixels or the initials have to be derived from a name.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => (
		<Avatar>
			<AvatarImage alt={NAME} src={UPLOADED_AVATAR_IMAGE} />
			<AvatarFallback>AM</AvatarFallback>
		</Avatar>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A loaded picture at the default 32px. Check the image fills the circle by covering rather than stretching, so a non-square upload is cropped instead of skewed.",
			},
		},
	},
	play: async ({ canvas }) => {
		const image = canvas.getByAltText(NAME)

		await expect(getComputedStyle(image).objectFit).toBe("cover")
	},
})

export const Sizes = meta.story({
	render: () => (
		<Row>
			<Avatar size="sm">
				<AvatarFallback>AM</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>AM</AvatarFallback>
			</Avatar>
			<Avatar size="lg">
				<AvatarFallback>AM</AvatarFallback>
			</Avatar>
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Every size in the closed set. Check the fallback text steps down with the circle rather than staying pinned at one size, and pick `InitialsAvatar` when the caller needs a pixel size outside these three.",
			},
		},
	},
	play: async ({ canvas }) => {
		const heights = canvas
			.getAllByText("AM")
			.map((fallback) => fallback.getBoundingClientRect().height)

		await expect(heights).toEqual([24, 32, 40])
	},
})

export const Empty = meta.story({
	render: () => (
		<Avatar>
			<AvatarFallback>AM</AvatarFallback>
		</Avatar>
	),
	parameters: {
		docs: {
			description: {
				story:
					"No image at all, the state a reader who never uploaded one sits in. Check the fallback shows immediately instead of flashing an empty circle first.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("AM")).toBeVisible()
	},
})

export const WithBadge = meta.story({
	render: () => (
		<Avatar>
			<AvatarFallback>AM</AvatarFallback>
			<AvatarBadge />
		</Avatar>
	),
	parameters: {
		docs: {
			description: {
				story:
					"`AvatarBadge` pins a mark to the bottom corner and sizes it from the avatar's own size. Check it keeps the ring that lifts it off whatever is behind the avatar.",
			},
		},
	},
})

export const InGroup = meta.story({
	render: () => (
		<AvatarGroup>
			<Avatar>
				<AvatarFallback>AM</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>LR</AvatarFallback>
			</Avatar>
			<AvatarGroupCount>+3</AvatarGroupCount>
		</AvatarGroup>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Several avatars overlapped, with `AvatarGroupCount` closing the row. Check the overlap keeps each ring visible so the faces stay countable, and pick `Branding/AvatarGroup` for the conversation tile, which is a different component with the same name.",
			},
		},
	},
})
