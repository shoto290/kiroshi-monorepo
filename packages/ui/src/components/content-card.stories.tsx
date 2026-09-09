import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	CONTENT_CARD_GUTTER,
	ContentCard,
} from "@workspace/ui/components/content-card"
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
	await expect(painted.borderTopWidth).toBe("0px")
	await expect(painted.backgroundColor).not.toBe("rgba(0, 0, 0, 0)")
	await expect(painted.borderStartStartRadius).toBe(
		painted.borderStartEndRadius,
	)
	await expect(painted.borderStartStartRadius).not.toBe("0px")
	await expect(painted.overflow).toBe("hidden")
	await expect(painted.marginTop).toBe(`${CONTENT_CARD_GUTTER}px`)
	await expect(painted.marginInlineStart).toBe("0px")
	await expect(painted.marginInlineEnd).toBe(`${CONTENT_CARD_GUTTER}px`)
}

const meta = preview.meta({
	title: "Layout/ContentCard",
	component: ContentCard,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The one piece that draws the content card: the gutter, the radius, the border and the background that lift a screen off the shell surface. Every host that hands room to a screen renders it — the shell around a screen with no side panel, and the activity panel around the thread it sits beside — so the treatment is written once and can never drift between the two. A card that ends up containing another card yields: it drops its own gutter, radius, border and background so the innermost card is the only frame, which is what lets the panel sit outside the frame on the shell surface.",
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
					"The card as a screen with no side panel gets it. Check that the shell surface shows through above and below with the same gutter and past the trailing edge, that the card is told from that surface by its own background rather than by a border, that the radius reads the same on both leading corners, and that the content is clipped by the radius rather than squaring the corners. Pick `WithNestedCard` for the shape the activity panel puts it in.",
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
					"A card holding a host that draws a card of its own, which is what the activity panel does to the shell. Check that only one frame is visible: the outer card keeps no gutter, no radius and no background of its own, so the shell surface runs under the inner card and out to the window edge. Pick `Default` for the single card.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [outer, inner] = cardsIn(canvasElement)
		const yielded = getComputedStyle(outer)
		await expect(yielded.borderStartStartRadius).toBe("0px")
		await expect(yielded.marginTop).toBe("0px")
		await expect(yielded.backgroundColor).toBe("rgba(0, 0, 0, 0)")
		await expectCarriesCard(inner)
	},
})
