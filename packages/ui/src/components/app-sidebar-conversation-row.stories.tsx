import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SidebarFrame, slotIn } from "@workspace/storybook/story-utils"
import {
	DESK_ROOM,
	SIDEBAR_SECTION,
	STILL_LIFT,
} from "@workspace/ui/components/app-sidebar.fixtures"
import { ConversationRosterRow } from "@workspace/ui/components/app-sidebar-conversation-row"
import { SidebarMenu } from "@workspace/ui/components/ui/sidebar"

const meta = preview.meta({
	title: "Navigation/AppSidebarConversationRow",
	component: ConversationRosterRow,
	tags: ["test-only"],
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<SidebarFrame>
				<SidebarMenu>
					<Story />
				</SidebarMenu>
			</SidebarFrame>
		),
	],
	args: {
		conversation: DESK_ROOM,
		isSelected: false,
		isPinned: true,
		lift: STILL_LIFT,
		sections: [SIDEBAR_SECTION],
		onSelect: fn(),
	},
})

export const PinnedConversationWithAWorkingBot = meta.story({
	play: async ({ args, canvasElement }) => {
		const row = slotIn(canvasElement, "sidebar-menu-button")
		await expect(within(row).getByText(DESK_ROOM.name)).toBeVisible()
		await expect(slotIn(canvasElement, "sidebar-menu-item")).toHaveAttribute(
			"data-roster-drop",
		)
		row.click()
		await expect(args.onSelect).toHaveBeenCalledWith(DESK_ROOM.id)
	},
})
