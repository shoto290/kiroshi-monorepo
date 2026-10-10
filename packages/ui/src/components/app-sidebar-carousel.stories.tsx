import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SidebarFrame, slotIn } from "@workspace/storybook/story-utils"
import { SIDEBAR_SPACES } from "@workspace/ui/components/app-sidebar.fixtures"
import { AppSidebarList } from "@workspace/ui/components/app-sidebar-carousel"
import type { Space } from "@workspace/ui/components/space"

const renderSpace = (space: Space) => (
	<button type="button">{space.name}</button>
)

const meta = preview.meta({
	title: "Navigation/AppSidebarCarousel",
	component: AppSidebarList,
	tags: ["test-only"],
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<SidebarFrame>
				<Story />
			</SidebarFrame>
		),
	],
	args: {
		isPerSpace: true,
		isSwipeEnabled: true,
		list: "conversations" as const,
		onSelectSpace: fn(),
		renderSpace,
		selectedSpaceId: SIDEBAR_SPACES[0].id,
		spaces: SIDEBAR_SPACES,
		children: null,
	},
})

export const ListPerSpace = meta.story({
	play: async ({ canvasElement }) => {
		const carousel = slotIn(canvasElement, "space-carousel")
		await expect(carousel.children).toHaveLength(SIDEBAR_SPACES.length)
		await expect(
			within(carousel).getByText(SIDEBAR_SPACES[0].name),
		).toBeInTheDocument()
	},
})
