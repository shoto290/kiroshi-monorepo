import { expect, fn, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	ATLAS,
	SIDEBAR_BOTS,
	SIDEBAR_CONVERSATIONS,
	SIDEBAR_SPACES,
} from "@workspace/ui/components/app-sidebar.fixtures"
import { AppSidebarPanel } from "@workspace/ui/components/app-sidebar-panel"
import { SidebarProvider } from "@workspace/ui/components/ui/sidebar"

const meta = preview.meta({
	title: "Navigation/AppSidebarPanel",
	component: AppSidebarPanel,
	tags: ["test-only"],
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<SidebarProvider>
				<Story />
			</SidebarProvider>
		),
	],
	args: {
		bots: SIDEBAR_BOTS,
		conversations: SIDEBAR_CONVERSATIONS,
		spaces: SIDEBAR_SPACES,
		selectedSpaceId: SIDEBAR_SPACES[0].id,
		selectedBotId: ATLAS.id,
		isSpaceSwitchingEnabled: true,
		openPanel: "conversations" as const,
		footer: null,
		onCreateBot: fn(),
		onSelectBot: fn(),
	},
})

export const ConversationsWithAWorkingBot = meta.story({
	play: async ({ canvasElement }) => {
		const panel = within(canvasElement).getByRole("complementary")
		await expect(panel).toHaveAttribute("aria-busy", "true")
		await expect(within(panel).getByText(ATLAS.name)).toBeVisible()
		await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
			ATLAS.name,
		)
	},
})
