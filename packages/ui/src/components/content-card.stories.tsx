import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { probedStyleOf } from "@workspace/storybook/story-utils"
import { ContentCard } from "@workspace/ui/components/content-card"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const CONTENT = (
	<p className="p-4 text-sm">Whatever screen the shell hands the room to.</p>
)

const cardsIn = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>("[data-content-card]"),
	) as [HTMLElement, HTMLElement]

const expectCarriesCard = async (card: HTMLElement) => {
	const painted = getComputedStyle(card)
	await expect(painted.borderTopWidth).toBe("1px")
	await expect(painted.borderTopColor).toBe(
		probedStyleOf("border-shell-border", "borderTopColor"),
	)
	await expect(painted.backgroundColor).toBe(
		probedStyleOf("bg-card", "backgroundColor"),
	)
	await expect(painted.borderStartStartRadius).toBe(
		painted.borderStartEndRadius,
	)
	await expect(painted.borderStartStartRadius).not.toBe("0px")
	await expect(painted.overflow).toBe("hidden")
	await expect(painted.marginTop).toBe("0px")
	await expect(painted.marginInlineEnd).toBe("0px")
}

const meta = preview.meta({
	title: "Layout/ContentCard",
	component: ContentCard,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The one piece that draws the content card: the radius, the 1px border and the card background that lift a screen off the window ground. The shell owns the gutter around it. Beside the conversation panel it becomes the trailing half of the shell card, square and borderless on the side it shares with the panel. Every host that hands room to a screen renders it, the shell and the activity panel around the thread, so the treatment is written once and can never drift between the two. A card inside another card yields: it drops its own radius, border and background so the outermost card, the shell card, is the only frame.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => (
		<SidebarProvider>
			<ContentCard>{CONTENT}</ContentCard>
		</SidebarProvider>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The card as a screen with no side panel gets it. Check that it carries no margin of its own, that it is told from the ground by its card background and its 1px border, that the radius reads the same on both leading corners, and that the content is clipped by the radius rather than squaring the corners. Pick `WithNestedCard` for the shape the activity panel puts it in. The app assembles it at `apps/app/src/App.tsx:928`.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [card] = cardsIn(canvasElement)
		await expectCarriesCard(card)
	},
})

export const WithNestedCard = meta.story({
	render: () => (
		<SidebarProvider>
			<ContentCard>
				<SidebarProvider>
					<ContentCard isLandmark={false}>{CONTENT}</ContentCard>
				</SidebarProvider>
			</ContentCard>
		</SidebarProvider>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A card holding a host that draws a card of its own, which is what the activity panel does to the shell. Check that only one frame is visible: the inner card keeps no radius, no border and no background of its own, so the outer card is the only frame. Pick `Default` for the single card. The app assembles it at `apps/app/src/App.tsx:928`.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [outer, inner] = cardsIn(canvasElement)
		const yielded = getComputedStyle(inner)
		await expect(yielded.borderStartStartRadius).toBe("0px")
		await expect(yielded.borderTopWidth).toBe("0px")
		await expect(yielded.backgroundColor).toBe("rgba(0, 0, 0, 0)")
		await expectCarriesCard(outer)
	},
})
