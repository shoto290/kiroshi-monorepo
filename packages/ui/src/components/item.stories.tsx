import type { ComponentProps, ReactNode } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	listExhaustively,
	UPLOADED_AVATAR_IMAGE,
} from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@workspace/ui/components/ui/item"

type ItemVariant = NonNullable<ComponentProps<typeof Item>["variant"]>
type ItemSize = NonNullable<ComponentProps<typeof Item>["size"]>
type ItemMediaVariant = NonNullable<ComponentProps<typeof ItemMedia>["variant"]>

const ITEM_VARIANTS = listExhaustively<ItemVariant>({
	default: true,
	outline: true,
	muted: true,
})

const ITEM_SIZES = listExhaustively<ItemSize>({
	default: true,
	sm: true,
	xs: true,
})

const MEDIA_VARIANTS = listExhaustively<ItemMediaVariant>({
	default: true,
	icon: true,
	image: true,
})

const PARTS = [
	"item-media",
	"item-content",
	"item-title",
	"item-description",
	"item-actions",
]

const mediaFor = (variant: ItemMediaVariant) =>
	variant === "image" ? (
		<img alt="" src={UPLOADED_AVATAR_IMAGE} />
	) : (
		<Icons.Settings aria-hidden="true" />
	)

interface ColumnProps {
	children: ReactNode
}

const Column = ({ children }: ColumnProps) => (
	<div className="flex w-96 flex-col gap-3">{children}</div>
)

const itemsIn = (canvasElement: HTMLElement) =>
	Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-slot="item"]'))

const meta = preview.meta({
	title: "Primitives/Item",
	component: Item,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The registry list item as the shadcn CLI vendors it: a root built on Base UI `useRender`, so it takes a `render` prop and can become a link or a button, with a media, a content column holding a title and a description, and trailing actions. The parts render `div` and `p`, so they only belong inside a root that may hold flow content; the sidebar roster row builds on the root alone for that reason.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"One item carrying every part: an icon media, a content column with a title and a description, and an action. Check the media sits beside the content, the description reads muted under the title, and the action holds the end of the row. Pick `Variants` or `Sizes` for the matrices.",
			},
		},
	},
	render: () => (
		<Column>
			<Item variant="outline">
				<ItemMedia variant="icon">
					<Icons.Settings aria-hidden="true" />
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Weekly report</ItemTitle>
					<ItemDescription>
						Sent to the team every Monday at nine.
					</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button size="sm" variant="outline">
						Open
					</Button>
				</ItemActions>
			</Item>
		</Column>
	),
	play: async ({ canvas, canvasElement }) => {
		const [item] = itemsIn(canvasElement)

		for (const part of PARTS)
			await expect(item.querySelector(`[data-slot="${part}"]`)).not.toBeNull()
		await expect(canvas.getByRole("button", { name: "Open" })).toBeVisible()
	},
})

export const Variants = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every variant the item declares, derived from its type so a new one fails here first. Check `default` draws no visible edge, `outline` draws the border token and `muted` fills with the muted surface.",
			},
		},
	},
	render: () => (
		<Column>
			{ITEM_VARIANTS.map((variant) => (
				<Item key={variant} variant={variant}>
					<ItemContent>
						<ItemTitle>{variant}</ItemTitle>
					</ItemContent>
				</Item>
			))}
		</Column>
	),
	play: async ({ canvasElement }) => {
		await expect(
			itemsIn(canvasElement).map((item) => item.dataset.variant),
		).toEqual(ITEM_VARIANTS)
	},
})

export const Sizes = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every size the item declares. Check each step tightens the padding and the gap, and the image media shrinks with it.",
			},
		},
	},
	render: () => (
		<Column>
			{ITEM_SIZES.map((size) => (
				<Item key={size} size={size} variant="outline">
					<ItemMedia variant="image">{mediaFor("image")}</ItemMedia>
					<ItemContent>
						<ItemTitle>{size}</ItemTitle>
					</ItemContent>
				</Item>
			))}
		</Column>
	),
	play: async ({ canvasElement }) => {
		const items = itemsIn(canvasElement)
		const paddings = items.map((item) => getComputedStyle(item).paddingTop)

		await expect(items.map((item) => item.dataset.size)).toEqual(ITEM_SIZES)
		await expect(new Set(paddings).size).toBe(ITEM_SIZES.length)
	},
})

export const MediaVariants = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every variant the media part declares: a plain slot, an icon sized by the part, and an image cropped into a rounded square. Check the icon and the image line up on the title.",
			},
		},
	},
	render: () => (
		<Column>
			{MEDIA_VARIANTS.map((variant) => (
				<Item key={variant} variant="outline">
					<ItemMedia variant={variant}>{mediaFor(variant)}</ItemMedia>
					<ItemContent>
						<ItemTitle>{variant}</ItemTitle>
					</ItemContent>
				</Item>
			))}
		</Column>
	),
	play: async ({ canvasElement }) => {
		await expect(
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>('[data-slot="item-media"]'),
				(media) => media.dataset.variant,
			),
		).toEqual(MEDIA_VARIANTS)
	},
})
