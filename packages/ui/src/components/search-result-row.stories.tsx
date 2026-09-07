import type { ReactNode } from "react"
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

const RESULTS_LABEL = "Search results"

const HOVERED_RESULTS_LABEL = "Search results under the pointer"

const QUERY_LABEL = "Search"

const QUERY = "parser"

const PAST_THE_LIST_LABEL = "Past the list"

const ACTIVE_OPTION_ID = "search-result-active"

const RESULT_LIST_ID = "search-result-list"

const PALETTE_RING_CLASS = "[--badge-ring:var(--color-popover)]"

const RANK_CHORD = "Press Control"

const RANK_CAP = "⌘3"

const rankLabelFor = (rank: number) => `${RANK_CHORD} ${rank}`

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

type ResultListProps = {
	children: ReactNode
	label?: string
	id?: string
	width?: number
}

const ResultList = ({
	children,
	label = RESULTS_LABEL,
	id,
	width = PALETTE_WIDTH,
}: ResultListProps) => (
	<div
		aria-label={label}
		className={`flex flex-col gap-0.5 rounded-xl bg-popover p-1 ${PALETTE_RING_CLASS}`}
		id={id}
		role="listbox"
		style={{ width }}
	>
		{children}
	</div>
)

const Probe = ({ slot, tone }: { slot: string; tone: string }) => (
	<span className={`hidden ${tone}`} data-slot={slot} />
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
		<ResultList>
			<SearchResultRow {...args} />
		</ResultList>
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
					"A thread held with one bot alone. Check that the context line reads exactly the parts the caller passed and nothing appended behind them: the words that tell a solo thread apart from a room of two are the palette's copy, not this component's.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(titleWeightOf(canvasElement)).toBe("500")
		await expect(
			slotIn(canvasElement, "search-result-row-parts").textContent,
		).toBe("Ada Martin")
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
			<Probe slot="muted-probe" tone="bg-muted" />
			<Probe slot="background-probe" tone="bg-background" />
			<ResultList>
				<SearchResultRow {...args} />
			</ResultList>
		</>
	),
	play: async ({ canvas, canvasElement }) => {
		const row = canvas.getByRole("option")

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
					"Rest, the pointer and keyboard focus side by side. Check that the row draws no surface of its own at rest so the palette behind it shows through, that the pointer answer is the muted surface at half strength so it never reads as the active row, and that a row the palette moves focus onto adds a ring on top of whichever surface it already carries.",
			},
		},
	},
	render: (args) => (
		<>
			<ResultList>
				<SearchResultRow {...args} />
			</ResultList>
			<ResultList id="search-result-hovered" label={HOVERED_RESULTS_LABEL}>
				<SearchResultRow
					{...args}
					title={[{ key: "title", text: "Hovered result" }]}
				/>
			</ResultList>
		</>
	),
	play: async ({ canvas, userEvent }) => {
		const [rested] = canvas.getAllByRole("option")

		await expect(getComputedStyle(rested).backgroundColor).toBe(
			"rgba(0, 0, 0, 0)",
		)
		await userEvent.keyboard("{ArrowDown}")
		rested.focus()

		await expect(rested).toHaveFocus()
		await expect(getComputedStyle(rested).boxShadow).not.toBe("none")
	},
})

export const AsListboxOption = meta.story({
	args: {
		isActive: true,
		id: ACTIVE_OPTION_ID,
		rank: 1,
		rankLabel: rankLabelFor(1),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The row as the palette owns it, with the wiring a reader needs around it: the query field is a combobox that owns the list through `aria-controls`, so the option it points at with `aria-activedescendant` is a logical descendant of the focused element and is actually announced. Check that the pointed id resolves inside the owned list to the option carrying the selected state, that its accessible name carries both the title and the chord its rank answers to, and that no row is in the tab order — one press of Tab leaves the field and lands past the whole list, because the palette drives the list from the arrow keys and never from Tab.",
			},
		},
	},
	render: (args) => (
		<>
			<input
				aria-activedescendant={ACTIVE_OPTION_ID}
				aria-controls={RESULT_LIST_ID}
				aria-expanded
				aria-label={QUERY_LABEL}
				readOnly
				role="combobox"
				value={QUERY}
			/>
			<ResultList id={RESULT_LIST_ID}>
				<SearchResultRow {...args} />
				<SearchResultRow
					{...args}
					id="search-result-second"
					isActive={false}
					rank={2}
					rankLabel={rankLabelFor(2)}
					title={[{ key: "title", text: "The second hit" }]}
				/>
			</ResultList>
			<button type="button">{PAST_THE_LIST_LABEL}</button>
		</>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const field = canvas.getByRole("combobox")
		const owned = canvasElement.querySelector(
			`#${field.getAttribute("aria-controls")}`,
		)
		const [selected, rest] = canvas.getAllByRole("option")

		if (!owned) throw new Error("The combobox owns no list")

		await expect(field).toHaveAttribute("aria-expanded", "true")
		await expect(
			owned.querySelector(`#${field.getAttribute("aria-activedescendant")}`),
		).toBe(selected)
		await expect(selected).toHaveAttribute("aria-selected", "true")
		await expect(rest).toHaveAttribute("aria-selected", "false")
		await expect(selected).toHaveAttribute("tabindex", "-1")
		await expect(selected).toHaveAccessibleName(
			expect.stringContaining(rankLabelFor(1)),
		)

		field.focus()
		await userEvent.tab()

		await expect(
			canvas.getByRole("button", { name: PAST_THE_LIST_LABEL }),
		).toHaveFocus()
	},
})

export const ActiveUnderPointer = meta.story({
	args: { isActive: true },
	parameters: {
		pseudo: { hover: true },
		docs: {
			description: {
				story:
					"The row the keyboard sits on, with the pointer resting on it too. Check that it keeps the muted surface at full strength instead of lightening to the half-strength pointer answer: the pointer never takes a row away from the keyboard, and the two surfaces are close enough that a row flickering between them reads as a bug. Reach for `States` when what you are checking is a row the keyboard is not on.",
			},
		},
	},
	render: (args) => (
		<>
			<Probe slot="muted-probe" tone="bg-muted" />
			<ResultList>
				<SearchResultRow {...args} />
			</ResultList>
		</>
	),
	play: async ({ canvas, canvasElement }) => {
		await expect(
			getComputedStyle(canvas.getByRole("option")).backgroundColor,
		).toBe(surfaceOf(canvasElement, "muted-probe"))
	},
})

export const WithBadgeWhileActive = meta.story({
	args: KIND_ARGS.mission,
	parameters: {
		docs: {
			description: {
				story:
					"Two mission rows on the palette surface, one of them active. The badge ring is a hole punched through whatever is behind the dot, so check that the resting row punches the palette it is placed on and the active row punches the muted surface it draws itself — a ring naming a surface the row is not on paints a pale halo instead of disappearing.",
			},
		},
	},
	render: (args) => (
		<>
			<Probe slot="muted-probe" tone="bg-muted" />
			<ResultList>
				<SearchResultRow {...args} isActive={false} />
				<SearchResultRow
					{...args}
					isActive
					rank={2}
					title={[{ key: "title", text: "Retire the legacy importer" }]}
				/>
			</ResultList>
		</>
	),
	play: async ({ canvasElement }) => {
		const [resting, active] = slotsIn(canvasElement, "search-result-row")
		const [restingDot, activeDot] = slotsIn(canvasElement, "bot-activity-dot")
		const palette = resting.parentElement

		if (!palette) throw new Error("The rows sit in no palette")

		await expect(getComputedStyle(restingDot).boxShadow).toContain(
			getComputedStyle(palette).backgroundColor,
		)
		await expect(getComputedStyle(activeDot).boxShadow).toContain(
			surfaceOf(canvasElement, "muted-probe"),
		)
		await expect(getComputedStyle(resting).backgroundColor).toBe(
			"rgba(0, 0, 0, 0)",
		)
		await expect(getComputedStyle(active).backgroundColor).toBe(
			surfaceOf(canvasElement, "muted-probe"),
		)
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
		const row = canvas.getByRole("option")
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
					"The rows past the ninth hit, which no digit opens. Check that the lane still measures its full width so every title in the list starts and ends on the same column, that nothing is drawn inside it, and that a rank label handed to a row out of range is dropped along with the keycap rather than announced for a chord that does nothing — a row given a rank of ten is the same case as a row given none.",
			},
		},
	},
	render: (args) => (
		<ResultList>
			<SearchResultRow {...args} rank={undefined} rankLabel={rankLabelFor(1)} />
			<SearchResultRow
				{...args}
				rank={10}
				rankLabel={rankLabelFor(10)}
				title={[{ key: "title", text: "The tenth hit" }]}
			/>
		</ResultList>
	),
	play: async ({ canvas, canvasElement }) => {
		const lanes = slotsIn(canvasElement, "search-result-row-rank")

		await expect(lanes).toHaveLength(2)
		for (const lane of lanes) {
			await expect(lane.getBoundingClientRect().width).toBe(RANK_LANE_WIDTH)
			await expect(lane.children).toHaveLength(0)
		}
		for (const option of canvas.getAllByRole("option")) {
			await expect(option).not.toHaveAccessibleName(
				expect.stringContaining(RANK_CHORD),
			)
		}
	},
})

export const WithRank = meta.story({
	args: { rank: 3 },
	parameters: {
		docs: {
			description: {
				story:
					"A hit inside the first nine, the range the keyboard can reach by a digit, given no rank label. Check that the lane holds a `Kbd` showing the digit, that the cap stays hidden from assistive technology so the digit never lands in the middle of the option's name, and that nothing takes its place in the name — a caller that says nothing about the chord gets no invented wording.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const kbd = slotIn(canvasElement, "kbd")

		await expect(kbd).toHaveTextContent(RANK_CAP)
		await expect(kbd).toHaveAttribute("aria-hidden", "true")
		await expect(
			slotIn(canvasElement, "search-result-row-rank").textContent,
		).toBe(RANK_CAP)
		await expect(canvas.getByRole("option")).toHaveAccessibleName(
			expect.not.stringContaining(RANK_CHORD),
		)
	},
})

export const Activated = meta.story({
	args: { onOpen: fn() },
	parameters: {
		docs: {
			description: {
				story:
					"The row taken by the pointer and then by the keyboard. Check that the whole row is one option named by its title, and that either way of activating it reports exactly once — reach for this over `States` when what you are checking is the handler and not the surface.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const row = canvas.getByRole("option", { name: /drops every escaped/ })

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
		<ResultList width={NARROW_PALETTE_WIDTH}>
			<SearchResultRow {...args} />
		</ResultList>
	),
	play: async ({ canvas, canvasElement }) => {
		const row = canvas.getByRole("option").getBoundingClientRect()
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
