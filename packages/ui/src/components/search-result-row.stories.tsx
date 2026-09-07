import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn, slotsIn } from "@workspace/storybook/story-utils"
import type { ConversationParticipant } from "@workspace/ui/components/avatar-group"
import { Icons } from "@workspace/ui/components/icons"
import { MISSION_BOT } from "@workspace/ui/components/missions.fixtures"
import {
	type SearchResultKind,
	SearchResultRow,
	type SearchResultRowProps,
} from "@workspace/ui/components/search-result-row"

const PALETTE_WIDTH = 420

const NARROW_PALETTE_WIDTH = 320

const RANK_LANE_WIDTH = 26

const ROUTINE_BOT = {
	name: "Noor Beltran",
	animal: "rabbit",
	seed: "bot-noor-beltran",
} as const

const PARTICIPANTS: ConversationParticipant[] = [
	{ id: "atlas", name: "Atlas", animal: "rabbit", blot: "blue" },
	{ id: "beacon", name: "Beacon", animal: "owl", blot: "orange" },
]

const KIND_ARGS: Record<SearchResultKind, SearchResultRowProps> = {
	message: {
		identity: { kind: "message", bot: MISSION_BOT },
		title: [
			{ key: "head", text: "The " },
			{ key: "match", text: "parser", isMatch: true },
			{ key: "tail", text: " drops every escaped newline" },
		],
		timestamp: "1h",
		parts: [
			{ key: "author", text: "Ada Martin" },
			{ key: "conversation", text: "Changelog cleanup" },
		],
		rank: 1,
		onOpen: fn(),
	},
	"message-from-you": {
		identity: { kind: "message-from-you", reader: "Steve Rivera" },
		title: [
			{ key: "head", text: "Can you rerun the " },
			{ key: "match", text: "parser", isMatch: true },
			{ key: "tail", text: " on the archive?" },
		],
		timestamp: "3h",
		parts: [
			{ key: "reader", text: "You" },
			{ key: "other", text: "Ada Martin" },
		],
		rank: 2,
		onOpen: fn(),
	},
	"chat-group": {
		identity: { kind: "chat-group", participants: PARTICIPANTS },
		title: [{ key: "title", text: "Changelog cleanup" }],
		timestamp: "Mon",
		parts: [{ key: "participants", text: "Atlas and Beacon" }],
		rank: 3,
		onOpen: fn(),
	},
	"chat-solo": {
		identity: { kind: "chat-solo", bot: MISSION_BOT },
		title: [{ key: "title", text: "Release notes review" }],
		timestamp: "Tue",
		parts: [{ key: "bot", text: "Ada Martin" }],
		rank: 4,
		onOpen: fn(),
	},
	mission: {
		identity: {
			kind: "mission",
			bot: MISSION_BOT,
			badge: "attention",
			mark: Icons.Linear,
		},
		title: [{ key: "title", text: "Migrate the run history table" }],
		timestamp: "2d",
		identifier: "OPE-51",
		parts: [
			{ key: "owner", text: "Ada Martin" },
			{ key: "state", text: "Waiting for you" },
		],
		rank: 5,
		onOpen: fn(),
	},
	routine: {
		identity: { kind: "routine", bot: ROUTINE_BOT },
		title: [{ key: "title", text: "Morning changelog digest" }],
		timestamp: "8d",
		parts: [
			{ key: "schedule", text: "Every weekday at 09:00" },
			{ key: "conversation", text: "Changelog cleanup" },
		],
		rank: 6,
		onOpen: fn(),
	},
}

const titleWeightOf = (canvasElement: HTMLElement) =>
	getComputedStyle(slotIn(canvasElement, "search-result-row-title")).fontWeight

const Probe = ({ surface, tone }: { surface: string; tone: string }) => (
	<span className={`hidden ${tone}`} data-slot={surface} />
)

const surfaceOf = (canvasElement: HTMLElement, slot: string) =>
	getComputedStyle(slotIn(canvasElement, slot)).backgroundColor

const meta = preview.meta({
	title: "Navigation/SearchResultRow",
	component: SearchResultRow,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"One hit of the search palette, in the six kinds a hit can take. It borrows the geometry and the interaction of `ActivityRow`, adds a rank lane on a `Kbd` for the digit that opens it from the keyboard, and marks the matched words of its title. It draws a hit and nothing else: the palette that holds it, its scope and its keyboard loop live above.",
			},
		},
	},
	args: KIND_ARGS.message,
	render: (args) => (
		<ul className="flex flex-col gap-0.5" style={{ width: PALETTE_WIDTH }}>
			<SearchResultRow {...args} />
		</ul>
	),
})

export const Message = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A message written by a bot, the nominal hit. Check that the excerpt is the title and stays at weight 400 because it is prose and not a name, that the matched word carries a `mark` on the amber token, and that the context line reads the author then the conversation.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const matched = canvas.getByText("parser")

		await expect(matched.tagName).toBe("MARK")
		await expect(getComputedStyle(matched).backgroundColor).not.toBe(
			"rgba(0, 0, 0, 0)",
		)
		await expect(titleWeightOf(canvasElement)).toBe("400")
		await expect(canvas.getByText("Changelog cleanup")).toBeVisible()
	},
})

export const MessageFromYou = meta.story({
	args: KIND_ARGS["message-from-you"],
	parameters: {
		docs: {
			description: {
				story:
					"The same prose hit when the reader wrote it. Check that the leading identity is the reader's initials rather than a bot, and that the title keeps the weight 400 the other message kind takes.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotIn(canvasElement, "user-avatar")).toBeVisible()
		await expect(titleWeightOf(canvasElement)).toBe("400")
		await expect(canvas.getByText("You")).toBeVisible()
	},
})

export const ChatGroup = meta.story({
	args: KIND_ARGS["chat-group"],
	parameters: {
		docs: {
			description: {
				story:
					"A room with several participants. Check that the identity is the held avatar group and not a single bot, that the title is a name and so takes weight 500, and that the context line is one sentence with no leading glyph in front of it.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotIn(canvasElement, "conversation-avatar")).toBeVisible()
		await expect(titleWeightOf(canvasElement)).toBe("500")
		await expect(canvas.getByText("Atlas and Beacon")).toBeVisible()
		await expect(
			slotsIn(canvasElement, "search-result-row-glyph"),
		).toHaveLength(0)
	},
})

export const ChatSolo = meta.story({
	args: KIND_ARGS["chat-solo"],
	parameters: {
		docs: {
			description: {
				story:
					"A thread held with one bot alone. Check that the context line ends on the words the component owns rather than on a string its caller passed, which is what tells this hit apart from a room of two.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(titleWeightOf(canvasElement)).toBe("500")
		await expect(canvas.getByText("Solo thread")).toBeVisible()
	},
})

export const Mission = meta.story({
	args: KIND_ARGS.mission,
	parameters: {
		docs: {
			description: {
				story:
					"A mission hit, the only kind carrying a state badge and a ticket. Check that the badge dot sits on the bot and is ringed against the palette surface, and that the platform mark and the identifier open the context line ahead of the owner and the state.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotIn(canvasElement, "bot-activity-dot")).toHaveAttribute(
			"data-badge",
			"attention",
		)
		await expect(canvas.getByText("OPE-51")).toBeVisible()
		await expect(titleWeightOf(canvasElement)).toBe("500")
	},
})

export const Routine = meta.story({
	args: KIND_ARGS.routine,
	parameters: {
		docs: {
			description: {
				story:
					"A routine hit. Check that its context line opens on the repeat glyph, which is what separates a scheduled run from the mission kind that also names a bot and a state.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(titleWeightOf(canvasElement)).toBe("500")
		await expect(canvas.getByText("Every weekday at 09:00")).toBeVisible()
		await expect(slotIn(canvasElement, "search-result-row-glyph")).toBeVisible()
	},
})

export const Active = meta.story({
	args: { isActive: true },
	parameters: {
		docs: {
			description: {
				story:
					"The row the keyboard loop currently sits on. Check that the row takes the muted surface at full strength and that its `Kbd` flips to the background colour so the digit stays readable on top of it, which is the only place the two surfaces swap.",
			},
		},
	},
	render: (args) => (
		<>
			<Probe surface="muted-probe" tone="bg-muted" />
			<Probe surface="background-probe" tone="bg-background" />
			<ul className="flex flex-col gap-0.5" style={{ width: PALETTE_WIDTH }}>
				<SearchResultRow {...args} />
			</ul>
		</>
	),
	play: async ({ canvas, canvasElement }) => {
		const row = canvas.getByRole("button")

		await expect(getComputedStyle(row).backgroundColor).toBe(
			surfaceOf(canvasElement, "muted-probe"),
		)
		await expect(surfaceOf(canvasElement, "kbd")).toBe(
			surfaceOf(canvasElement, "background-probe"),
		)
	},
})

export const States = meta.story({
	parameters: {
		pseudo: { hover: "#search-result-hovered button" },
		docs: {
			description: {
				story:
					"Rest, the pointer and keyboard focus side by side. Check that the row draws no surface of its own at rest, that the pointer answer is the muted surface at half strength so it never reads as the active row, and that keyboard focus adds a ring on top of whichever surface the row already carries. The pointer surface is read here from the class the row shares with `ActivityRow`: the pseudo-state addon paints it in Storybook but does not reach the browser the story test runs in.",
			},
		},
	},
	render: (args) => (
		<>
			<ul className="flex flex-col gap-0.5" style={{ width: PALETTE_WIDTH }}>
				<SearchResultRow {...args} />
			</ul>
			<ul
				className="flex flex-col gap-0.5"
				id="search-result-hovered"
				style={{ width: PALETTE_WIDTH }}
			>
				<SearchResultRow
					{...args}
					title={[{ key: "title", text: "Hovered result" }]}
				/>
			</ul>
		</>
	),
	play: async ({ canvas, userEvent }) => {
		const [rested, hovered] = canvas.getAllByRole("button")

		await expect(getComputedStyle(rested).backgroundColor).toBe(
			"rgba(0, 0, 0, 0)",
		)
		await expect(hovered).toHaveClass("hover:bg-muted/50")

		await userEvent.tab()

		await expect(rested).toHaveFocus()
		await expect(getComputedStyle(rested).boxShadow).not.toBe("none")
	},
})

export const LongContent = meta.story({
	args: {
		title: [
			{ key: "head", text: "Rewrite the changelog " },
			{ key: "match", text: "parser", isMatch: true },
			{
				key: "tail",
				text: " so that every escaped newline survives the round trip through the archive",
			},
		],
		parts: [
			{ key: "author", text: "Ada Martin" },
			{
				key: "conversation",
				text: "Changelog cleanup, archive migration and the long tail of the release notes",
			},
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A title and a context line longer than their lanes. Check that both end on an ellipsis rather than wrapping, that the timestamp and the rank lane keep their width and their place instead of being pushed out, and that the identifier and the leading glyph are never the part that gets cut.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const row = canvas.getByRole("button")
		const title = slotIn(canvasElement, "search-result-row-title")
		const parts = slotIn(canvasElement, "search-result-row-parts")
		const rank = slotIn(canvasElement, "search-result-row-rank")
		const timestamp = slotIn(canvasElement, "search-result-row-timestamp")

		await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
		await expect(getComputedStyle(title).textOverflow).toBe("ellipsis")
		await expect(parts.scrollWidth).toBeGreaterThan(parts.clientWidth)
		await expect(getComputedStyle(parts).textOverflow).toBe("ellipsis")
		await expect(rank.getBoundingClientRect().width).toBe(RANK_LANE_WIDTH)
		await expect(timestamp.getBoundingClientRect().right).toBeLessThanOrEqual(
			row.getBoundingClientRect().right,
		)
	},
})

export const Unranked = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The rows past the ninth hit, which no digit opens. Check that the lane still measures its full width so every title in the list starts and ends on the same column, and that nothing is drawn inside it — a row given a rank of ten is the same case as a row given none.",
			},
		},
	},
	render: (args) => (
		<ul className="flex flex-col gap-0.5" style={{ width: PALETTE_WIDTH }}>
			<SearchResultRow {...args} rank={undefined} />
			<SearchResultRow
				{...args}
				rank={10}
				title={[{ key: "title", text: "The tenth hit" }]}
			/>
		</ul>
	),
	play: async ({ canvasElement }) => {
		const lanes = slotsIn(canvasElement, "search-result-row-rank")

		await expect(lanes).toHaveLength(2)
		for (const lane of lanes) {
			await expect(lane.getBoundingClientRect().width).toBe(RANK_LANE_WIDTH)
			await expect(lane.children).toHaveLength(0)
		}
	},
})

export const WithRank = meta.story({
	args: { rank: 3 },
	parameters: {
		docs: {
			description: {
				story:
					"A hit inside the first nine, the range the keyboard can reach by a digit. Check that the lane holds a `Kbd` showing the digit, and that the digit is spoken as a named result rather than as a bare number the screen reader would read out of context.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const kbd = slotIn(canvasElement, "kbd")

		await expect(kbd).toHaveTextContent("3")
		await expect(kbd).toHaveAttribute("aria-hidden", "true")
		await expect(canvas.getByText("Result 3")).toBeInTheDocument()
	},
})

export const Activated = meta.story({
	args: { onOpen: fn() },
	parameters: {
		docs: {
			description: {
				story:
					"The row taken by the pointer and then by the keyboard. Check that the whole row is a single button named by its title, and that either way of activating it reports exactly once — reach for this over `States` when what you are checking is the handler and not the surface.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const row = canvas.getByRole("button", { name: /drops every escaped/ })

		await userEvent.click(row)
		await expect(args.onOpen).toHaveBeenCalledTimes(1)

		row.focus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onOpen).toHaveBeenCalledTimes(2)
	},
})

export const InNarrowPalette = meta.story({
	args: KIND_ARGS.mission,
	parameters: {
		docs: {
			description: {
				story:
					"The row squeezed to the 320px reflow floor. Check that the rank lane and the timestamp stay inside the row rather than overflowing it, which is the width where the title lane runs out of room first.",
			},
		},
	},
	render: (args) => (
		<ul
			className="flex flex-col gap-0.5"
			style={{ width: NARROW_PALETTE_WIDTH }}
		>
			<SearchResultRow {...args} />
		</ul>
	),
	play: async ({ canvas, canvasElement }) => {
		const row = canvas.getByRole("button").getBoundingClientRect()
		const rank = slotIn(canvasElement, "search-result-row-rank")
		const timestamp = slotIn(canvasElement, "search-result-row-timestamp")

		await expect(rank.getBoundingClientRect().width).toBe(RANK_LANE_WIDTH)
		await expect(rank.getBoundingClientRect().right).toBeLessThanOrEqual(
			row.right,
		)
		await expect(timestamp.getBoundingClientRect().right).toBeLessThanOrEqual(
			row.right,
		)
	},
})
