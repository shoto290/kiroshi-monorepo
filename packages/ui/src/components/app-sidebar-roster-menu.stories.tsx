import { expect, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SidebarFrame, slotIn } from "@workspace/storybook/story-utils"
import {
	BEACON,
	DESK_ROOM,
	SIDEBAR_BOTS,
	SIDEBAR_CONVERSATIONS,
	SIDEBAR_SECTION,
	SIDEBAR_SPACES,
} from "@workspace/ui/components/app-sidebar.fixtures"
import { useRosterDrag } from "@workspace/ui/components/app-sidebar-roster-drag"
import { rosterEntriesOf } from "@workspace/ui/components/app-sidebar-roster-layout"
import { PinnedZone } from "@workspace/ui/components/app-sidebar-roster-menu"

const SECTIONS = [SIDEBAR_SECTION]

const LivePinnedZone = () => {
	const entries = rosterEntriesOf({
		bots: SIDEBAR_BOTS,
		conversations: SIDEBAR_CONVERSATIONS,
		naming: null,
		sections: SECTIONS,
	})
	const drag = useRosterDrag({ entries, onLand: () => undefined })

	return (
		<PinnedZone
			collapsedSectionIds={[]}
			drag={drag}
			entries={entries}
			onMoveSection={() => undefined}
			rows={{
				edgeAt: drag.edgeAt,
				lift: drag.rosterLift,
				membershipsOf: () => [],
				sections: SECTIONS,
				slotFor: drag.slotFor,
				spaces: SIDEBAR_SPACES,
			}}
		/>
	)
}

const meta = preview.meta({
	title: "Navigation/AppSidebarRosterMenu",
	component: PinnedZone,
	tags: ["test-only"],
	parameters: { layout: "fullscreen" },
})

export const PinnedSectionThenPinnedConversation = meta.story({
	render: () => (
		<SidebarFrame>
			<LivePinnedZone />
		</SidebarFrame>
	),
	play: async ({ canvasElement }) => {
		const zone = within(canvasElement)
		await expect(
			slotIn(canvasElement, "roster-section-name"),
		).toHaveTextContent(SIDEBAR_SECTION.name)
		await expect(zone.getByText(BEACON.name)).toBeInTheDocument()
		await expect(zone.getByText(DESK_ROOM.name)).toBeVisible()
	},
})
