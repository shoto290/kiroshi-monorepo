import { useState } from "react"
import { expect, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn, slotsIn } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { MISSION_BOT } from "@workspace/ui/components/missions.fixtures"
import {
	SearchPalette,
	type SearchPaletteProps,
	type SearchPaletteResult,
	type SearchResultGroup,
	type SearchTab,
} from "@workspace/ui/components/search-palette"

const QUERY = "parser"

const SPACE = "Studio"

const OTHER_SPACE = "Archive"

const MESSAGES_FOUND = 12

const SHOWN_PER_KIND = 3

const ROUTINE_BOT = {
	name: "Noor Beltran",
	animal: "rabbit",
	seed: "bot-noor-beltran",
} as const

const messageAt = (rank: number): SearchPaletteResult => ({
	id: `message-${rank}`,
	identity: { kind: "message", bot: MISSION_BOT },
	title: [
		{ key: "head", text: "The " },
		{ key: "match", text: QUERY, isMatch: true },
		{ key: "tail", text: ` drops escaped newline ${rank}` },
	],
	timestamp: `${rank}h`,
	parts: [
		{ key: "author", text: "Ada Martin" },
		{ key: "conversation", text: "Changelog cleanup" },
	],
	space: SPACE,
	onOpen: fn(),
})

const MESSAGES: SearchPaletteResult[] = Array.from({ length: 10 }, (_, index) =>
	messageAt(index + 1),
)

const CHATS: SearchPaletteResult[] = [
	{
		id: "chat-changelog",
		identity: {
			kind: "chat-group",
			participants: [
				{ id: "atlas", name: "Atlas", animal: "rabbit", blot: "blue" },
				{ id: "beacon", name: "Beacon", animal: "owl", blot: "orange" },
			],
		},
		title: [{ key: "title", text: "Changelog cleanup" }],
		timestamp: "Mon",
		parts: [{ key: "participants", text: "Atlas and Beacon" }],
		space: SPACE,
		onOpen: fn(),
	},
	{
		id: "chat-release",
		identity: { kind: "chat-solo", bot: MISSION_BOT },
		title: [{ key: "title", text: "Release notes review" }],
		timestamp: "Tue",
		parts: [{ key: "bot", text: "Ada Martin" }],
		space: OTHER_SPACE,
		onOpen: fn(),
	},
]

const MISSIONS: SearchPaletteResult[] = [
	{
		id: "mission-run-history",
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
		space: SPACE,
		onOpen: fn(),
	},
]

const ROUTINES: SearchPaletteResult[] = [
	{
		id: "routine-digest",
		identity: { kind: "routine", bot: ROUTINE_BOT },
		title: [{ key: "title", text: "Morning changelog digest" }],
		timestamp: "8d",
		parts: [{ key: "schedule", text: "Every weekday at 09:00" }],
		space: OTHER_SPACE,
		onOpen: fn(),
	},
]

const RESULTS: SearchResultGroup[] = [
	{ kind: "messages", total: MESSAGES_FOUND, results: MESSAGES },
	{ kind: "chats", total: CHATS.length, results: CHATS },
	{ kind: "missions", total: MISSIONS.length, results: MISSIONS },
	{ kind: "routines", total: ROUTINES.length, results: ROUTINES },
]

const RECENTS: SearchPaletteResult[] = [
	CHATS[0] as SearchPaletteResult,
	MISSIONS[0] as SearchPaletteResult,
]

const palette = async () => {
	const popup = await screen.findByRole("dialog", { name: "Search" })
	await waitFor(() => expect(popup).toBeVisible())
	return popup
}

const bodyOf = (popup: HTMLElement) => slotIn(popup, "search-palette-body")

const Harness = (args: SearchPaletteProps) => {
	const [tab, setTab] = useState<SearchTab>(args.tab)
	const [isScopeAllSpaces, setScope] = useState(args.isScopeAllSpaces)
	const [query, setQuery] = useState(args.query)

	const changeTab = (next: SearchTab) => {
		args.onTabChange(next)
		setTab(next)
	}

	const changeScope = (next: boolean) => {
		args.onScopeChange(next)
		setScope(next)
	}

	const changeQuery = (next: string) => {
		args.onQueryChange(next)
		setQuery(next)
	}

	return (
		<SearchPalette
			{...args}
			isScopeAllSpaces={isScopeAllSpaces}
			onQueryChange={changeQuery}
			onScopeChange={changeScope}
			onTabChange={changeTab}
			query={query}
			tab={tab}
		/>
	)
}

const meta = preview.meta({
	title: "Overlays/SearchPalette",
	component: SearchPalette,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The search surface of the app, opened over whatever the reader was doing. It composes its own popup rather than the shared dialog content because the query line, the tab row and the footer are pinned and only the body between them scrolls. It reads nothing: the query, the tab, the scope, the results, the recents and the loading flag are all props, and every gesture is a callback, so the host owns the search itself. Focus stays on the query line at all times and the row the keyboard sits on is pointed at with `aria-activedescendant`, which is why the rows are options of one listbox rather than buttons in a tree. On the All tab each kind gets a head naming it and counting what it found, cut to three rows with a See all that moves the reader to that kind's own tab; every other tab is one flat list.",
			},
		},
	},
	args: {
		open: true,
		query: QUERY,
		tab: "all" as SearchTab,
		isScopeAllSpaces: false,
		spaceName: SPACE,
		results: RESULTS,
		recents: RECENTS,
		isLoading: false,
		activeResultId: "message-1",
		onOpenChange: fn(),
		onQueryChange: fn(),
		onTabChange: fn(),
		onScopeChange: fn(),
	},
	render: (args) => <Harness {...args} />,
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every kind answering one query, on the All tab. Check that each kind carries a head naming it and counting what it found, that the twelve messages are cut to the three rows the head announces with a See all beside them while the kinds that fit draw none, that the rows are numbered from one straight through the sections rather than restarting at each head, and that focus never leaves the query line while the row it points at is the one drawn as selected.",
			},
		},
	},
	play: async ({ canvas }) => {
		const popup = await palette()
		const body = bodyOf(popup)
		const field = within(popup).getByRole("combobox")

		await expect(field).toHaveFocus()
		await expect(canvas.queryByRole("dialog")).toBeNull()

		const heads = slotsIn(body, "search-palette-section-head")
		await expect(heads).toHaveLength(4)
		await expect(heads[0]).toHaveTextContent(`Messages${MESSAGES_FOUND}`)

		const messages = within(popup).getByRole("listbox", { name: "Messages" })
		await expect(within(messages).getAllByRole("option")).toHaveLength(
			SHOWN_PER_KIND,
		)
		await expect(slotsIn(body, "search-palette-see-all")).toHaveLength(1)

		const ranks = slotsIn(body, "search-result-row-rank").map(
			(lane) => lane.textContent,
		)
		await expect(ranks).toEqual(["1", "2", "3", "4", "5", "6", "7"])

		const selected = within(popup).getAllByRole("option", { selected: true })
		await expect(selected).toHaveLength(1)
		await expect(field.getAttribute("aria-activedescendant")).toBe(
			selected[0]?.id,
		)
		await expect(field).toHaveAttribute("aria-controls", body.id)
	},
})

export const OneKind = meta.story({
	args: { tab: "messages" },
	parameters: {
		docs: {
			description: {
				story:
					"The Messages tab alone. Check that the section heads are gone entirely — a single kind names itself through the active pill, so a head would repeat it — that every message the host handed over is drawn instead of the three the All tab keeps, and that the tenth row and beyond carry no keycap because no digit reaches them. Pick `Default` when what you are checking is the grouping.",
			},
		},
	},
	play: async () => {
		const popup = await palette()
		const body = bodyOf(popup)

		await expect(slotsIn(body, "search-palette-section-head")).toHaveLength(0)
		await expect(within(popup).getAllByRole("listbox")).toHaveLength(1)
		await expect(within(popup).getAllByRole("option")).toHaveLength(
			MESSAGES.length,
		)

		const lanes = slotsIn(body, "search-result-row-rank")
		await expect(lanes.filter((lane) => lane.textContent !== "")).toHaveLength(
			9,
		)
	},
})

export const ChangingTab = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The gesture that swaps the body: the All tab, then Chats, then back through See all. Check that the press reports the tab it selects and that the body follows it — grouped and cut on All, flat and whole on a kind — and that See all is nothing more than that same gesture drawn on the head of the kind that overflows.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const popup = await palette()
		const body = bodyOf(popup)
		const reader = within(popup)

		await userEvent.click(reader.getByRole("tab", { name: "Chats" }))
		await expect(args.onTabChange).toHaveBeenCalledWith("chats")
		await waitFor(async () => {
			await expect(slotsIn(body, "search-palette-section-head")).toHaveLength(0)
		})
		await expect(reader.getAllByRole("option")).toHaveLength(CHATS.length)

		await userEvent.click(reader.getByRole("tab", { name: "All" }))
		await waitFor(async () => {
			await expect(slotsIn(body, "search-palette-see-all")).toHaveLength(1)
		})

		await userEvent.click(reader.getByRole("button", { name: "See all" }))
		await expect(args.onTabChange).toHaveBeenLastCalledWith("messages")
		await waitFor(async () => {
			await expect(reader.getAllByRole("option")).toHaveLength(MESSAGES.length)
		})
	},
})

export const AcrossSpaces = meta.story({
	args: { isScopeAllSpaces: true },
	parameters: {
		docs: {
			description: {
				story:
					"The same query once the scope is every space. Check that each row opens its context line with the space it was found in, which is the only thing that tells two identically named threads apart here, and that turning the switch back reports the scope the reader asked for rather than filtering anything on its own.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const popup = await palette()
		const reader = within(popup)
		const [first] = slotsIn(bodyOf(popup), "search-result-row-parts")

		await expect(first?.textContent?.startsWith(SPACE)).toBe(true)
		await expect(
			reader.getByRole("listbox", { name: "Chats" }).textContent,
		).toContain(OTHER_SPACE)

		await userEvent.click(reader.getByRole("switch", { name: "All spaces" }))
		await expect(args.onScopeChange).toHaveBeenCalledWith(false)
	},
})

export const Recent = meta.story({
	args: { query: "", activeResultId: "chat-changelog" },
	parameters: {
		docs: {
			description: {
				story:
					"The palette the moment it opens, with nothing typed yet. Check that the recents stand under one head that counts nothing and offers no See all — there is no total to report when no search has run — and that the rows are numbered from one all the same, because the digits open a recent exactly as they open a hit.",
			},
		},
	},
	play: async () => {
		const popup = await palette()
		const body = bodyOf(popup)
		const [head] = slotsIn(body, "search-palette-section-head")

		await expect(head).toHaveTextContent("Recent")
		await expect(head?.textContent).toBe("Recent")
		await expect(
			slotsIn(within(popup).getByRole("listbox"), "kbd"),
		).toHaveLength(RECENTS.length)
		await expect(slotsIn(body, "search-palette-see-all")).toHaveLength(0)
	},
})

export const Empty = meta.story({
	args: { results: [], recents: [] },
	parameters: {
		docs: {
			description: {
				story:
					"A query nothing in the space answers. Check that the empty state names the space that was searched and quotes the query back, so a reader who mistyped sees it, and that the way out it offers is the scope itself — pressing it asks for every space rather than clearing the query.",
			},
		},
	},
	play: async ({ args, userEvent }) => {
		const reader = within(await palette())

		await expect(reader.queryByRole("listbox")).toBeNull()
		await expect(reader.getByText("Nothing here matches")).toBeVisible()
		await expect(
			reader.getByText(`No message, chat, mission or routine in ${SPACE}`, {
				exact: false,
			}),
		).toHaveTextContent(`“${QUERY}”`)

		await userEvent.click(
			reader.getByRole("button", { name: "Search all spaces" }),
		)
		await expect(args.onScopeChange).toHaveBeenCalledWith(true)
	},
})

export const EmptyEverywhere = meta.story({
	args: { results: [], recents: [], isScopeAllSpaces: true },
	parameters: {
		docs: {
			description: {
				story:
					"The same nothing once every space has already been searched. Check that the empty state keeps its title and its sentence but drops the action: widening the scope is the only thing it offered, and a button that repeats the state the reader is already in is worse than no button. Pick `Empty` for the scoped search that still has somewhere to go.",
			},
		},
	},
	play: async () => {
		const reader = within(await palette())

		await expect(reader.getByText("Nothing here matches")).toBeVisible()
		await expect(
			reader.queryByRole("button", { name: "Search all spaces" }),
		).toBeNull()
	},
})

export const Loading = meta.story({
	args: { isLoading: true },
	parameters: {
		docs: {
			description: {
				story:
					"A second search running while the first one is still on screen. Check that not one row is taken away and that the body reports itself busy instead — a palette that blanks between two keystrokes flickers, and the rows it drops were the answer to what the reader had typed a moment before.",
			},
		},
	},
	play: async () => {
		const popup = await palette()
		const reader = within(popup)

		await expect(reader.getAllByRole("option")).toHaveLength(7)
		await expect(reader.queryByText("Nothing here matches")).toBeNull()
		await expect(bodyOf(popup)).toHaveAttribute("aria-busy", "true")
	},
})

export const LoadingFirstQuery = meta.story({
	args: { isLoading: true, results: [], recents: [] },
	parameters: {
		docs: {
			description: {
				story:
					"The very first search of the session, still in flight, with nothing to keep on screen. Check that the body stays bare: the empty state claims nothing matches, which is a statement the palette cannot make until the search comes back. Pick `Empty` for the same bare body once it has.",
			},
		},
	},
	play: async () => {
		const reader = within(await palette())

		await expect(reader.queryByRole("listbox")).toBeNull()
		await expect(reader.queryByText("Nothing here matches")).toBeNull()
		await expect(reader.getByRole("combobox")).toHaveAttribute(
			"aria-expanded",
			"false",
		)
	},
})
