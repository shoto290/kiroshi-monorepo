import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SidebarFrame, slotIn, slotsIn } from "@workspace/storybook/story-utils"
import {
	ATLAS,
	DESK_ROOM,
	SIDEBAR_BOTS,
	SIDEBAR_CONVERSATIONS,
	SIDEBAR_SECTION,
	SIDEBAR_SPACES,
} from "@workspace/ui/components/app-sidebar.fixtures"
import { BotRoster } from "@workspace/ui/components/app-sidebar-roster"

const meta = preview.meta({
	title: "Navigation/AppSidebarRoster",
	component: BotRoster,
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
		bots: SIDEBAR_BOTS,
		conversations: SIDEBAR_CONVERSATIONS,
		sections: [SIDEBAR_SECTION],
		spaces: SIDEBAR_SPACES,
		spaceId: SIDEBAR_SPACES[0].id,
		selectedBotId: ATLAS.id,
		membershipsOf: () => [SIDEBAR_SPACES[0].id],
		onSelectBot: fn(),
		onPinRoster: fn(),
	},
})

export const PinnedZoneThenSortedZone = meta.story({
	play: async ({ canvasElement }) => {
		const [pinned, sorted] = slotsIn(canvasElement, "roster-drop-area").filter(
			(area) =>
				area.parentElement?.closest('[data-slot="roster-drop-area"]') === null,
		)
		await expect(within(pinned).getByText(DESK_ROOM.name)).toBeVisible()
		await expect(within(sorted).getByText(ATLAS.name)).toBeVisible()
		await expect(
			slotIn(canvasElement, "roster-zone-separator"),
		).toBeInTheDocument()
	},
})
