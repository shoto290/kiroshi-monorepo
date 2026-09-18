import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { BotIdentityAvatar } from "@workspace/ui/components/bot-identity-avatar"
import { Icons } from "@workspace/ui/components/icons"
import { MISSION_AVATAR_SIZE } from "@workspace/ui/components/mission"
import { MISSION_BOT } from "@workspace/ui/components/missions.fixtures"
import {
	ACTIVITY_ROW_CLASS,
	ROW_GLYPH_CLASS,
	RowAnatomy,
	RowParts,
} from "@workspace/ui/components/row-anatomy"

const PARTS = [
	{ key: "source", text: "On a schedule" },
	{ key: "silent", text: "" },
	{ key: "bot", text: MISSION_BOT.name },
]

const PARTS_SLOT = "row-anatomy-parts"

const SHELL_WIDTH = 320

const partsOf = (canvasElement: HTMLElement) => [
	...slotIn(canvasElement, PARTS_SLOT).children,
]

const dotOf = (part: Element) => getComputedStyle(part, "::before").content

const meta = preview.meta({
	title: "Layout/RowAnatomy",
	component: RowAnatomy,
	tags: ["test-only"],
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The anatomy every row of the product is built from: a media slot, a name line ending in a timestamp, and a second line. `SidebarListRow` renders it in the roster geometry, `ReportedRunRow` and `SearchResultRow` in the activity geometry. Reach for one of those three rather than this shell; it is here to prove the geometry each of them inherits.",
			},
		},
	},
	args: {
		geometry: "activity" as const,
		name: "Morning digest",
		timestamp: "08:04",
		media: (
			<BotIdentityAvatar
				{...MISSION_BOT}
				className="shrink-0"
				size={MISSION_AVATAR_SIZE}
			/>
		),
	},
	render: (args) => (
		<div
			className={ACTIVITY_ROW_CLASS}
			data-slot="row-anatomy-shell"
			style={{ width: SHELL_WIDTH }}
		>
			<RowAnatomy {...args} />
		</div>
	),
})

export const Default = meta.story({
	args: {
		preview: (
			<>
				<Icons.Routine aria-hidden="true" className={ROW_GLYPH_CLASS} />
				<RowParts parts={PARTS} slot={PARTS_SLOT} />
			</>
		),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The activity geometry, filled as a reported run fills it: a blot, a title, a time and a mark followed by parts. Check that the row keeps the 52px height of an activity row, that the part with no text is dropped rather than separated, and that the first part carries no leading dot because nothing precedes it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [first, second, third] = partsOf(canvasElement)

		await expect(
			slotIn(canvasElement, "row-anatomy-shell").getBoundingClientRect().height,
		).toBe(52)
		await expect(third).toBeUndefined()
		await expect(first).toHaveTextContent("On a schedule")
		await expect(second).toHaveTextContent(MISSION_BOT.name)
		await expect(dotOf(first)).toBe("none")
		await expect(dotOf(second)).toBe('"·"')
	},
})

export const WithIdentifier = meta.story({
	args: {
		preview: (
			<>
				<Icons.Routine aria-hidden="true" className={ROW_GLYPH_CLASS} />
				<RowParts identifier="OPE-29" parts={PARTS} slot={PARTS_SLOT} />
			</>
		),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same line, led by a ticket identifier. Check that the identifier opens the line and that the first part now carries the dot that separates it from what precedes it.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [first] = partsOf(canvasElement)

		await expect(canvas.getByText("OPE-29")).toBeVisible()
		await expect(dotOf(first)).toBe('"·"')
	},
})

export const InRoster = meta.story({
	args: {
		geometry: "roster",
		media: undefined,
		preview: "Reported earlier today",
		previewSlot: "row-anatomy-preview",
		timestamp: "09:24",
		timestampSlot: "row-anatomy-timestamp",
	},
	parameters: {
		docs: {
			description: {
				story:
					"The roster geometry, rendered with no `SidebarProvider` above it: the anatomy reads no sidebar context, which is what lets the search palette render it inside a dialog. Check that the timestamp keeps its 44px column aligned to the trailing edge and that the second line stays on its 16px band.",
			},
		},
	},
	render: (args) => (
		<div
			className="flex items-center"
			data-slot="row-anatomy-shell"
			style={{ width: SHELL_WIDTH }}
		>
			<RowAnatomy {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const timestamp = slotIn(canvasElement, "row-anatomy-timestamp")
		const preview = slotIn(canvasElement, "row-anatomy-preview")

		await expect(timestamp.getBoundingClientRect().width).toBe(44)
		await expect(getComputedStyle(timestamp).textAlign).toBe("right")
		await expect(preview.getBoundingClientRect().height).toBe(16)
	},
})
