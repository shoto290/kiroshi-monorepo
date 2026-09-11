import { useState } from "react"
import { expect, fireEvent, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	A11Y_FLOATING_FOCUS_GUARDS,
	A11Y_SUBMENU_PORTAL_GUARD,
	FRAME_POLL,
	hasOverlayScrollbars,
	mergeA11y,
	settled,
	shown,
	slotIn,
	slotsIn,
	tokenLengthOf,
} from "@workspace/storybook/story-utils"
import {
	AppSidebar,
	type AppSidebarBot,
	type AppSidebarConversation,
	type AppSidebarProps,
	type AppSidebarRowMission,
	type AppSidebarSection,
	type BotAvatarBlot,
	ROW_AVATAR_SIZE,
	type Space,
	type UserChipIdentity,
} from "@workspace/ui/components/app-sidebar"
import { blotTransform } from "@workspace/ui/components/bot-avatar-blot"
import type {
	BotMissionState,
	BotMissionTicket,
} from "@workspace/ui/components/bot-badge"
import { Icons } from "@workspace/ui/components/icons"
import { TooltipButton } from "@workspace/ui/components/tooltip-button"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

const LAST_MESSAGE =
	"Renamed the transport module and updated every caller, so the second turn resumes the first one cleanly again."

const SINGLE_LINE_HEIGHT = 20

const NARROW_VIEWPORT = {
	narrow: { name: "Narrow", styles: { width: "800px", height: "900px" } },
}

const SHORT_VIEWPORT = {
	short: { name: "Short", styles: { width: "1000px", height: "420px" } },
}

const UPLOADED_IMAGE =
	"data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA5NiA5Nic+PHJlY3Qgd2lkdGg9Jzk2JyBoZWlnaHQ9Jzk2JyBmaWxsPScjZThhMzNkJy8+PGNpcmNsZSBjeD0nNDgnIGN5PSczOCcgcj0nMTYnIGZpbGw9JyNmZmY3ZTgnLz48cmVjdCB4PScyMCcgeT0nNjAnIHdpZHRoPSc1NicgaGVpZ2h0PSc0MCcgcng9JzIwJyBmaWxsPScjZmZmN2U4Jy8+PC9zdmc+"

const ROSTER: AppSidebarBot[] = [
	{
		id: "atlas",
		blot: "blue",
		name: "Atlas",
		title: "Research",
		animal: "owl",
		lastMessage: "Pulled the three papers and summarised each one for you.",
		timestamp: "09:24",
	},
	{
		id: "beacon",
		blot: "yellow",
		name: "Beacon",
		animal: "cat",
		lastMessage: LAST_MESSAGE,
		timestamp: "09:18",
	},
	{
		id: "cinder",
		blot: "red",
		name: "Cinder",
		title: "Build",
		animal: "dog",
		status: "working",
		pose: "working",
		lastMessage: "Rebuilding the desktop bundle.",
		timestamp: "09:12",
	},
	{
		id: "dune",
		blot: "green",
		name: "Dune",
		animal: "bear",
		lastMessage: "Nothing since the migration landed.",
		timestamp: "Mon",
	},
	{
		id: "ember",
		blot: "purple",
		name: "Ember",
		title: "Review",
		animal: "rabbit",
		lastMessage: "Left four comments on the transport rename.",
		timestamp: "Mon",
	},
	{
		id: "flint",
		blot: "pink",
		name: "Flint",
		animal: "mouse",
		lastMessage: "Ran the suite twice, both green.",
		timestamp: "Sun",
	},
	{
		id: "grove",
		blot: "cyan",
		name: "Grove",
		title: "Docs",
		animal: "koala",
		lastMessage: "Rewrote the setup page around the new command.",
		timestamp: "Sun",
	},
	{
		id: "harbor",
		blot: "orange",
		name: "Harbor",
		animal: "chick",
		lastMessage: "Waiting on the credentials you promised.",
		timestamp: "Sat",
	},
	{
		id: "iris",
		blot: "yellow",
		name: "Iris",
		title: "Design",
		animal: "cat",
		lastMessage: "Swapped the rail avatars for the new blots.",
		timestamp: "Sat",
	},
	{
		id: "juno",
		blot: "blue",
		name: "Juno",
		animal: "owl",
		lastMessage: "Summarised yesterday's session into six bullets.",
		timestamp: "Fri",
	},
	{
		id: "kite",
		blot: "red",
		name: "Kite",
		title: "Ops",
		animal: "dog",
		lastMessage: "Rotated the signing key and restarted the runner.",
		timestamp: "Fri",
	},
	{
		id: "lumen",
		blot: "orange",
		name: "Lumen",
		animal: "bear",
		lastMessage: "Nothing yet.",
		timestamp: "Thu",
	},
]

const BADGED_ROSTER: AppSidebarBot[] = [
	{ ...ROSTER[0], badge: "attention" },
	{ ...ROSTER[1], badge: "done" },
	{ ...ROSTER[2], badge: "failed" },
	ROSTER[3],
]

const MISSION_TICKETS: BotMissionTicket[] = [
	{
		platform: "linear",
		externalId: "OPE-71",
		title: "Roster row shows the mission ticket",
	},
	{ platform: "github", externalId: "#4172", title: "Resume the second turn" },
	{ platform: "linear", externalId: "OPE-64", title: "Pin the waiting room" },
	{
		platform: "github",
		externalId: "#4180",
		title: "Split the transport read",
	},
]

const missionOf = (
	state: BotMissionState,
	index: number,
): AppSidebarRowMission => ({
	id: `m-${state}-${index}`,
	state,
	ticket: MISSION_TICKETS[index],
})

const MISSION_STATE_ROSTER: AppSidebarBot[] = [
	{ ...ROSTER[0], missions: [missionOf("waiting", 0)] },
	{ ...ROSTER[1], missions: [missionOf("failed", 1)] },
	{ ...ROSTER[4], missions: [missionOf("ready", 2)] },
	{ ...ROSTER[5], missions: [missionOf("working", 3)] },
]

const stripsIn = (row: HTMLElement) =>
	Array.from(
		row.querySelectorAll<HTMLElement>('[data-slot="bot-mission-strip"]'),
	)

const stripStatesIn = (row: HTMLElement) =>
	stripsIn(row).map((strip) => strip.dataset.state)

const dotIn = (row: HTMLElement) => slotIn(row, "bot-mission-dot")

const BARE_ROW_HEIGHT = 52

const ROW_HEAD_HEIGHT = 40

const STRIP_STEP = 28

const heightForStrips = (count: number) => BARE_ROW_HEIGHT + count * STRIP_STEP

const LOOSE_MISSION_ROSTER: AppSidebarBot[] = [
	{ ...ROSTER[1], lastActivityAt: 3, timestamp: "now" },
	{ ...ROSTER[4], lastActivityAt: 2, timestamp: "5m" },
	{
		...ROSTER[0],
		lastActivityAt: 1,
		timestamp: "Tue",
		missions: [missionOf("waiting", 0)],
	},
]

const IDENTITY_BLOTS: BotAvatarBlot[] = [
	"red",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"orange",
]

const IDENTITY_ROSTER: AppSidebarBot[] = IDENTITY_BLOTS.map((blot, index) => ({
	...ROSTER[index],
	blot,
	status: "idle",
}))

const blotsIn = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "bot-avatar-blot")

const blotFillsIn = (canvasElement: HTMLElement) =>
	blotsIn(canvasElement).map((path) => path.getAttribute("fill"))

const SHARED_TINT_ROSTER: AppSidebarBot[] = IDENTITY_ROSTER.map((bot) => ({
	...bot,
	blot: "blue",
}))

const LONG_ROSTER: AppSidebarBot[] = [0, 1, 2].flatMap((pass) =>
	ROSTER.map((bot) => ({ ...bot, id: `${bot.id}-${pass}` })),
)

const FOOTER_LABEL = "Workspace settings"

const FOOTER_CONTENT = (
	<TooltipButton
		aria-label={FOOTER_LABEL}
		size="icon-sm"
		tooltip={FOOTER_LABEL}
		variant="ghost"
	>
		<Icons.Settings aria-hidden="true" />
	</TooltipButton>
)

const SPACES: Space[] = [
	{ id: "perso", name: "Perso", colour: "blue" },
	{ id: "vocca", name: "Vocca", colour: "green" },
	{ id: "atelier", name: "Atelier", colour: "pink" },
	{ id: "veille", name: "Veille", colour: "yellow" },
	{ id: "archives", name: "Archives", colour: "purple" },
	{ id: "chantier", name: "Chantier", colour: "orange" },
	{ id: "lecture", name: "Lecture", colour: "cyan" },
	{ id: "brouillons", name: "Brouillons", colour: "red" },
	{ id: "essais", name: "Essais", colour: "green" },
]

const READER_NAME = "Ada Martin"

const READER: UserChipIdentity = {
	name: READER_NAME,
	image: UPLOADED_IMAGE,
}

const SilentSlot = () => null

const SILENT_FOOTER_CONTENT = <SilentSlot />

const footerRowWidth = (footer: HTMLElement) => {
	const style = getComputedStyle(footer)
	return (
		footer.clientWidth -
		Number.parseFloat(style.paddingLeft) -
		Number.parseFloat(style.paddingRight)
	)
}

const verticalCentreOf = (box: DOMRect) => box.top + box.height / 2

const withoutTitle = (bot: AppSidebarBot): AppSidebarBot => ({
	...bot,
	title: undefined,
})

const withoutHistory = (bot: AppSidebarBot): AppSidebarBot => ({
	...bot,
	lastMessage: undefined,
	timestamp: undefined,
})

const rowsIn = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="sidebar-menu-item"]',
		),
	)

const rowFor = (canvasElement: HTMLElement, name: string) => {
	const row = rowsIn(canvasElement).find(
		(item) => slotIn(item, "roster-row-name").textContent === name,
	)
	if (!row) throw new Error(`No roster row named ${name}`)
	return row
}

const rowButton = (row: HTMLElement) => slotIn(row, "sidebar-menu-button")

const avatarDrawingIn = (row: HTMLElement) => {
	const drawing = slotIn(row, "bot-identity-avatar").querySelector("svg")
	if (!drawing) throw new Error("No avatar drawing in the row")
	return drawing
}

const expectAvatarDrawnAtCallSiteSize = async (row: HTMLElement) => {
	const drawn = avatarDrawingIn(row).getBoundingClientRect()
	await expect(drawn.width).toBeCloseTo(ROW_AVATAR_SIZE, 0)
	await expect(drawn.height).toBeCloseTo(ROW_AVATAR_SIZE, 0)
}

const expectAvatarWholeInRow = async (row: HTMLElement) => {
	const drawn = avatarDrawingIn(row).getBoundingClientRect()
	const box = rowButton(row).getBoundingClientRect()
	await expect(drawn.left).toBeGreaterThanOrEqual(box.left)
	await expect(drawn.right).toBeLessThanOrEqual(box.right)
	await expect(drawn.top).toBeGreaterThanOrEqual(box.top)
	await expect(drawn.bottom).toBeLessThanOrEqual(box.bottom)
}

const rowHead = (row: HTMLElement) =>
	row.querySelector<HTMLElement>('[data-slot="sidebar-menu-head"]') ??
	rowButton(row)

const headHeightOf = (row: HTMLElement) => {
	const head = rowHead(row)
	const { paddingTop, paddingBottom } = getComputedStyle(head)
	return Math.round(
		head.getBoundingClientRect().height -
			Number.parseFloat(paddingTop) -
			Number.parseFloat(paddingBottom),
	)
}

const badgeIn = (row: HTMLElement) =>
	row.querySelector<HTMLElement>('[data-slot="bot-activity-dot"]')?.dataset
		.badge

const bottomOf = (node: HTMLElement) => node.getBoundingClientRect().bottom

const centerOf = (node: HTMLElement) => {
	const box = node.getBoundingClientRect()
	return box.top + box.height / 2
}

const expectFooterAtColumnBottom = async (canvasElement: HTMLElement) => {
	const footer = slotIn(canvasElement, "sidebar-footer")
	await expect(footer.getBoundingClientRect().top).toBeCloseTo(
		bottomOf(slotIn(canvasElement, "sidebar-content")),
		0,
	)
	await expect(bottomOf(footer)).toBeCloseTo(
		bottomOf(slotIn(canvasElement, "sidebar-container")),
		0,
	)
}

const offsetsFrom =
	(edge: (rowBox: DOMRect, box: DOMRect) => number) =>
	(rows: HTMLElement[], slot: string) =>
		rows.map((row) =>
			Math.round(
				edge(
					row.getBoundingClientRect(),
					slotIn(row, slot).getBoundingClientRect(),
				),
			),
		)

const topOffsets = offsetsFrom((rowBox, box) => box.top - rowBox.top)

const startOffsets = offsetsFrom((rowBox, box) => box.left - rowBox.left)

const endOffsets = offsetsFrom((rowBox, box) => rowBox.right - box.right)

const uniqueCount = (values: unknown[]) => new Set(values).size

const rowHeights = (rows: HTMLElement[]) =>
	rows.map((row) => Math.round(row.getBoundingClientRect().height))

const isClipped = (node: HTMLElement) => node.scrollWidth > node.clientWidth

const previewShortfalls = (rows: HTMLElement[]) =>
	rows.map((row) => {
		const preview = slotIn(row, "roster-row-preview").getBoundingClientRect()
		const column = slotIn(row, "roster-row-timestamp").getBoundingClientRect()
		return Math.round(column.right - preview.right)
	})

const rowsWithPreview = (rows: HTMLElement[]) =>
	rows.filter((row) => slotIn(row, "roster-row-preview").textContent !== "")

const expectNameOnAvatarCentre = async (row: HTMLElement, avatarSlot: string) =>
	expect(
		verticalCentreOf(slotIn(row, "roster-row-name").getBoundingClientRect()),
	).toBeCloseTo(
		verticalCentreOf(slotIn(row, avatarSlot).getBoundingClientRect()),
		0,
	)

const gapsBetween = (nodes: HTMLElement[]) =>
	nodes
		.slice(1)
		.map((node, index) =>
			Math.round(
				node.getBoundingClientRect().top -
					nodes[index].getBoundingClientRect().bottom,
			),
		)

const expectAvatarCentredOnRowPart = async (
	row: HTMLElement,
	avatarSlot: string,
) =>
	expect(
		verticalCentreOf(slotIn(row, avatarSlot).getBoundingClientRect()),
	).toBeCloseTo(verticalCentreOf(rowHead(row).getBoundingClientRect()), 0)

const expectStripSpansRow = async (row: HTMLElement) => {
	const strip = stripsIn(row)[0].getBoundingClientRect()
	const avatar = slotIn(row, "bot-identity-avatar").getBoundingClientRect()
	const button = rowButton(row).getBoundingClientRect()

	await expect(Math.round(strip.left)).toBe(Math.round(avatar.left))
	await expect(Math.round(button.right - strip.right)).toBe(6)
	await expect(rowButton(row).contains(stripsIn(row)[0])).toBe(true)
}

const expectAlignedRows = async (rows: HTMLElement[]) => {
	await expect(uniqueCount(startOffsets(rows, "roster-row-name"))).toBe(1)
	await expect(uniqueCount(startOffsets(rows, "roster-row-preview"))).toBe(1)
	await expect(uniqueCount(startOffsets(rows, "roster-row-timestamp"))).toBe(1)
	await expect(uniqueCount(endOffsets(rows, "roster-row-timestamp"))).toBe(1)
	await expect(
		uniqueCount(topOffsets(rowsWithPreview(rows), "roster-row-name")),
	).toBe(1)
	await expect(previewShortfalls(rows)).toEqual(rows.map(() => 0))
	await expect(uniqueCount(rows.map(headHeightOf))).toBe(1)
}

const colorOf = (row: HTMLElement, slot: string) =>
	getComputedStyle(slotIn(row, slot)).color

const tokenBackground = (scope: HTMLElement, value: string) => {
	const probe = document.createElement("div")
	probe.style.backgroundColor = value
	scope.append(probe)
	const color = getComputedStyle(probe).backgroundColor
	probe.remove()
	return color
}

const tokenColor = (scope: HTMLElement, token: string) => {
	const probe = document.createElement("div")
	probe.style.color = `var(${token})`
	scope.append(probe)
	const color = getComputedStyle(probe).color
	probe.remove()
	return color
}

const expectMutedSecondaryText = async (row: HTMLElement, muted: string) => {
	await expect(colorOf(row, "roster-row-preview")).toBe(muted)
	await expect(colorOf(row, "roster-row-timestamp")).toBe(muted)
	await expect(colorOf(row, "roster-row-name")).not.toBe(muted)
}

const EXPANDED_PANEL_WIDTH = 304

const shellWidthOf = (property: string) => {
	const shell = document.querySelector<HTMLElement>(
		'[data-slot="sidebar-wrapper"]',
	)
	if (!shell) throw new Error(`no sidebar wrapper to read ${property} from`)
	const probe = document.createElement("div")
	probe.style.width = `var(${property})`
	shell.append(probe)
	const width = probe.getBoundingClientRect().width
	probe.remove()
	return width
}

const panelWidth = () => shellWidthOf("--sidebar-width")

const railWidth = () => shellWidthOf("--sidebar-width-icon")

const stateOf = (panel: HTMLElement) =>
	panel.closest<HTMLElement>('[data-slot="sidebar"]')?.dataset.state

const renderShell = (defaultOpen: boolean) => (args: AppSidebarProps) => (
	<WorkspaceShell defaultOpen={defaultOpen} sidebar={<AppSidebar {...args} />}>
		{null}
	</WorkspaceShell>
)

const renderTintedShell = (args: AppSidebarProps) => (
	<WorkspaceShell sidebar={<AppSidebar {...args} />} spaceTint="blue">
		{null}
	</WorkspaceShell>
)

const ON_SHELL_TOKENS = [
	"--sidebar",
	"--sidebar-accent",
	"--sidebar-border",
	"--accent",
	"--border",
	"--input",
	"--muted",
	"--secondary",
]

const paintOf = (element: HTMLElement) =>
	getComputedStyle(element).backgroundColor

const tokenPaintsIn = (host: HTMLElement, className = "") =>
	ON_SHELL_TOKENS.map((token) => {
		const probe = document.createElement("div")
		probe.className = className
		probe.style.backgroundColor = `var(${token})`
		host.append(probe)
		const painted = paintOf(probe)
		probe.remove()
		return painted
	})

const meta = preview.meta({
	title: "Navigation/AppSidebar",
	component: AppSidebar,
	render: renderShell(true),
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The roster panel of an agent app, mounted whole: the animated sidebar shell around every companion the reader owns. It carries no chrome of its own beyond the create button — the pinned region above the list clears the window controls when `insetWindowControls` says a transparent title bar sits over it, and the open state comes from the `WorkspaceShell` above it, so Cmd/Ctrl+B and whatever trigger the page mounts drive the panel and the column beside it together. A row is the companion avatar, its name, an optional title badge and the time of its last message, over one clipped line of that message. A companion at rest holds the pose it was given in its settings, drawn as a still frame; a companion that is running holds its work pose, animates, and wears an activity dot. A companion wearing a picture its reader uploaded shows that instead, and it never moves — the dot is what says it is working. Settings, duplicate and delete live behind a right-click on the row — there is no actions button to reveal — and selection and running state are props, so a host maps its store onto `bots` and `selectedBotId` and nothing here polls the transport.",
			},
		},
	},
	args: {
		bots: ROSTER,
		selectedBotId: "beacon",
		onSelectBot: fn(),
		onCreateBot: fn(),
		onEditBot: fn(),
		onDuplicateBot: fn(),
		onAddBotToSpace: fn(),
		onRemoveBotFromSpace: fn(),
		onDeleteBot: fn(),
		onOpenUserSettings: fn(),
		onSelectSpace: fn(),
		onCreateSpace: fn(),
		onOpenSpaceSettings: fn(),
	},
	argTypes: {
		selectedBotId: { control: "text" },
	},
})

export const Roster = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A dozen companions, some with a title badge and some without, each wearing the blot it was given. Check that the avatars, the names and the timestamps each hold one column down the whole list — a row without a badge must not slide its name or its preview out of line with the row above it — and that every row is the same height whatever it carries. The message and the time read as muted and read alike, on the selected row as on the rest, so a row says its name first and dates itself second; the name is the only line in the row drawn at full strength. The list is walked with Tab and a row is its own only stop, since the actions carry no button: the create button first, then one stop per row, and Enter on a row reports the selection rather than taking it. Pick `LongContent` for the same list under names and messages that do not fit, `RowContextMenu` for the actions behind a row, `Identities` for the blots at rest.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const rows = rowsIn(canvasElement)
		await expect(rows).toHaveLength(ROSTER.length)

		await expectAlignedRows(rows)

		const muted = tokenColor(canvasElement, "--muted-foreground")
		await expectMutedSecondaryText(rows[0], muted)
		await expectMutedSecondaryText(rowFor(canvasElement, "Beacon"), muted)

		const badged = rows.filter((row) =>
			row.querySelector('[data-slot="roster-row-badge"]'),
		)
		await expect(badged).toHaveLength(ROSTER.filter((bot) => bot.title).length)
		await expect(
			rowFor(canvasElement, "Beacon").querySelector(
				'[data-slot="roster-row-badge"]',
			),
		).toBeNull()

		const create = canvas.getByRole("button", { name: "New companion" })
		await userEvent.tab()
		await expect(create).toHaveFocus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onCreateBot).toHaveBeenCalled()

		await userEvent.tab()
		await expect(rowButton(rows[0])).toHaveFocus()
		await userEvent.tab()
		await expect(rowButton(rows[1])).toHaveFocus()

		await userEvent.keyboard("{Enter}")
		await expect(args.onSelectBot).toHaveBeenCalledWith("beacon")
	},
})

export const CreateLabel = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The one label in this panel that cannot open upwards. The create control is pinned in the region that clears the window controls, against the top of the window, so a label above it would be drawn off the screen — it opens under the button instead, on hover and on focus alike. Check both, and check that the bubble sits inside the window on every edge: a label a reader cannot read is the same as no label.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const create = canvas.getByRole("button", { name: "New companion" })
		const label = () =>
			document.body.querySelector<HTMLElement>('[role="tooltip"]')

		const opensBelow = async () => {
			await waitFor(async () => {
				await expect(label()).toBeVisible()
				await expect(label()).toHaveTextContent("New companion")
			})
			const button = create.getBoundingClientRect()

			await waitFor(async () => {
				const bubble = label()?.getBoundingClientRect()
				if (!bubble) throw new Error("The create control drew no label")

				await expect(bubble.top).toBeGreaterThanOrEqual(button.bottom)
				await expect(bubble.top).toBeGreaterThanOrEqual(0)
				await expect(bubble.left).toBeGreaterThanOrEqual(0)
				await expect(bubble.bottom).toBeLessThanOrEqual(window.innerHeight)
				await expect(bubble.right).toBeLessThanOrEqual(window.innerWidth)
			}, FRAME_POLL)
		}

		await userEvent.hover(create)
		await opensBelow()

		await userEvent.unhover(create)
		await waitFor(async () => expect(label()).toBeNull())

		await userEvent.tab()
		await expect(create).toHaveFocus()
		await opensBelow()
	},
})

export const Empty = meta.story({
	args: { bots: [] },
	parameters: {
		docs: {
			description: {
				story:
					"A reader who owns no companion yet. Check that the list is gone rather than left as an empty box, that the copy says so in one line, and that the create button is still the first thing Tab reaches — it is the only way out of this state. The live region says nothing is selected, so a screen reader is not left waiting for a row that never comes.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await expect(rowsIn(canvasElement)).toHaveLength(0)
		await expect(canvas.getByText("No companions yet")).toBeVisible()
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"No companion selected",
		)

		const create = canvas.getByRole("button", { name: "New companion" })
		await userEvent.tab()
		await expect(create).toHaveFocus()
		await expect(create.matches(":focus-visible")).toBe(true)
	},
})

export const UnreadableRoster = meta.story({
	args: { bots: [], haveBotsFailedToLoad: true },
	parameters: {
		docs: {
			description: {
				story:
					"The read of the roster came back refused. The sidebar says the companions could not be read instead of the invitation to create a first one, so an owner of forty companions is never told they have none. Check no row is drawn and that the create button is still reachable.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(rowsIn(canvasElement)).toHaveLength(0)
		await expect(
			canvas.getByText(
				"Couldn't load your companions. Restart Kiroshi to retry.",
			),
		).toBeVisible()
		await expect(
			canvas.queryByText("No companions yet"),
		).not.toBeInTheDocument()
	},
})

export const SingleBot = meta.story({
	args: { bots: [ROSTER[1]], selectedBotId: "beacon" },
	parameters: {
		docs: {
			description: {
				story:
					"One companion, which is where most readers start. Check that a single row still lays out on the same columns as a full roster — the avatar slot and the timestamp slot are fixed, so the first row of a roster and the only row of this one sit identically — and that the message clips to one line with an ellipsis instead of wrapping the row taller. Pick `Roster` for the same row among eleven others.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const rows = rowsIn(canvasElement)
		await expect(rows).toHaveLength(1)

		const row = rows[0]
		await expect(rowButton(row)).toHaveAttribute("aria-current", "page")
		await expect(slotIn(row, "roster-row-timestamp")).toHaveTextContent("09:18")

		const preview = slotIn(row, "roster-row-preview")
		await expect(isClipped(preview)).toBe(true)
		await expect(preview.getBoundingClientRect().height).toBeLessThanOrEqual(
			SINGLE_LINE_HEIGHT,
		)
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Beacon selected, idle",
		)
	},
})

export const NoTitles = meta.story({
	args: {
		bots: ROSTER.slice(0, 5).map(withoutTitle),
		selectedBotId: "atlas",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A roster where no companion carries a title. Check that no badge is drawn at all — not an empty one holding its box — and that the rows keep the height and the baselines they have when badges are present, since the name line owns that height rather than the badge inside it. Pick `Roster` for the mixed case the alignment has to survive.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		await expect(
			canvasElement.querySelectorAll('[data-slot="roster-row-badge"]'),
		).toHaveLength(0)
		await expectAlignedRows(rows)
	},
})

export const NoHistory = meta.story({
	args: {
		bots: [
			ROSTER[0],
			withoutHistory(ROSTER[1]),
			withoutHistory(ROSTER[3]),
			ROSTER[4],
		],
		selectedBotId: "beacon",
	},
	parameters: {
		docs: {
			description: {
				story:
					"Two companions nobody has talked to yet, between two that carry a message and a time. Check that a row with neither keeps the height of a full row and centres its name on its avatar, since the empty preview line gives up its height rather than pushing the name above the middle, and that the timestamp slot stays reserved at the end of the name line, so a time arriving later lands on the column the rest of the list already stands on instead of shifting it. Pick `BareRows` for the same centring on a room, `Roster` for rows that all carry both, `LongContent` for the name that has to give way to a time on the same line.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const bare = rowFor(canvasElement, "Beacon")

		await expect(slotIn(bare, "roster-row-timestamp")).toBeEmptyDOMElement()
		await expect(slotIn(bare, "roster-row-preview")).toBeEmptyDOMElement()
		await expectNameOnAvatarCentre(bare, "bot-identity-avatar")
		await expect(slotIn(rows[0], "roster-row-timestamp")).toHaveTextContent(
			"09:24",
		)

		await expectAlignedRows(rows)
	},
})

export const Selected = meta.story({
	args: { selectedBotId: "ember" },
	parameters: {
		docs: {
			description: {
				story:
					'The selected row, which is the one thing in the panel a reader has to be able to find without looking twice. Check that exactly one row carries the pill and `aria-current="page"`, that clicking another row reports it rather than moving the pill on its own — selection is a prop — and that the live region names the selected companion, so the choice is spoken and not only drawn.',
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const selected = rowFor(canvasElement, "Ember")
		const other = rowFor(canvasElement, "Atlas")

		await expect(rowButton(selected)).toHaveAttribute("aria-current", "page")
		await expect(rowButton(other)).not.toHaveAttribute("aria-current")
		await expect(
			canvasElement.querySelectorAll('[aria-current="page"]'),
		).toHaveLength(1)
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Ember selected, idle",
		)

		await userEvent.click(rowButton(other))
		await expect(args.onSelectBot).toHaveBeenCalledWith("atlas")
		await expect(rowButton(selected)).toHaveAttribute("aria-current", "page")
	},
})

export const UploadedPictures = meta.story({
	args: {
		bots: [
			{ ...ROSTER[0], image: UPLOADED_IMAGE },
			{
				...ROSTER[2],
				image: UPLOADED_IMAGE,
				status: "working",
				pose: "writing",
			},
			ROSTER[1],
		],
		selectedBotId: "atlas",
	},
	parameters: {
		docs: {
			description: {
				story:
					"Two companions wearing a picture their reader uploaded, beside one wearing its animal. A picture is a still image whatever the companion is doing, so the row that is running says so with its message line rather than by moving — and it lands in the same slot as a drawing, so the names and the timestamps stay on the column the rest of the roster holds. Check that a row with a picture draws no animal and no blot at all, and that the picture is decorative: the row is already named by its own text. Pick `Identities` for the animals a companion wears when it has no picture.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const [wearing, running, drawn] = rows

		await expect(wearing.querySelector("img")).toHaveAttribute(
			"src",
			UPLOADED_IMAGE,
		)
		await expect(wearing.querySelector("svg")).toBeNull()
		await expect(drawn.querySelector("img")).toBeNull()
		await expect(within(drawn).getByRole("img")).toBeVisible()
		await expect(
			running.querySelector('[data-slot="bot-activity-dot"]'),
		).toBeNull()
		await expectAlignedRows(rows)
	},
})

export const SharedTint = meta.story({
	args: {
		bots: SHARED_TINT_ROSTER,
		selectedBotId: SHARED_TINT_ROSTER[0].id,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Eight companions that all picked the same tint. Before a shape was derived from the id they were stamped from one die and a reader had to read the names to tell the rows apart; now each id lays the one authored blot down at its own quarter turn, mirrored or not. The vocabulary is deliberately small — eight poses, and eight tints over them — so two rows can still land on the same mark, and a reader who wants them apart changes a tint. What matters is that a row never changes shape: rename the companion, give it another animal, give it another tint, and the mark it wears is the one it was minted with. Pick `Identities` for the eight tints on their own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const shapes = blotsIn(canvasElement).map((path) =>
			path.getAttribute("transform"),
		)

		await expect(shapes).toHaveLength(SHARED_TINT_ROSTER.length)
		for (const [at, shape] of shapes.entries()) {
			await expect(
				shape?.endsWith(blotTransform(SHARED_TINT_ROSTER[at].id)),
			).toBe(true)
		}
		await expect(uniqueCount(shapes)).toBeGreaterThan(1)
	},
})

export const Identities = meta.story({
	args: {
		bots: IDENTITY_ROSTER,
		selectedBotId: IDENTITY_ROSTER[0].id,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The eight blots a companion can be given in its settings, one per row, with nothing running. Every avatar here draws the same idle animal — what tells the rows apart is the tint behind it, not what the companion is doing — and every one of them is a still frame, so a panel of companions that are doing nothing is a panel that does not move. Check that each row wears its own tint, that the ink line and the ear accent stay legible over all eight, that no row carries an activity dot, and that the panel does not report itself busy. Check too that the panel is the width the stylesheet gives it, that it draws no rule down its trailing edge — the thread card's own border is the only edge between the two — and that an avatar is drawn at the size the row asks for rather than at the size the menu button forces on the icons around it. The test browser renders every story with reduced motion, so the stillness is read here rather than measured; open the story in Storybook beside `Working` to see the difference. Pick `Working` for the state that animates.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(rows).toHaveLength(IDENTITY_BLOTS.length)
		await expect(blotFillsIn(canvasElement)).toEqual(
			IDENTITY_BLOTS.map((blot) => `var(--bot-blot-${blot})`),
		)
		for (const row of rows) {
			await expect(
				within(row).getByRole("img", { name: /idle$/ }),
			).toBeVisible()
		}

		await expect(
			canvasElement.querySelectorAll('[data-slot="bot-activity-dot"]'),
		).toHaveLength(0)

		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		await expect(panel).toHaveAttribute("aria-busy", "false")
		await expect(panel.getBoundingClientRect().width).toBeCloseTo(
			panelWidth(),
			0,
		)
		await expect(panelWidth()).toBe(EXPANDED_PANEL_WIDTH)
		await expect(getComputedStyle(panel).borderInlineEndWidth).toBe("0px")
		const surfaceRadius = tokenLengthOf("--radius-lg")
		await expect(
			getComputedStyle(rowButton(rows[0])).borderStartStartRadius,
		).toBe(surfaceRadius)
		await expect(
			getComputedStyle(canvas.getByRole("button", { name: "New companion" }))
				.borderStartStartRadius,
		).toBe(surfaceRadius)

		await expectAvatarDrawnAtCallSiteSize(rows[0])
		await expectAvatarWholeInRow(rows[0])
		await expect(uniqueCount(rowHeights(rows))).toBe(1)
	},
})

export const Working = meta.story({
	args: {
		bots: [
			{ ...ROSTER[0], status: "working", pose: "thinking" },
			{ ...ROSTER[1], status: "working", pose: "searching" },
			{ ...ROSTER[2], status: "working", pose: "writing" },
			{ ...ROSTER[3], status: "working", pose: "working" },
			ROSTER[4],
		],
		selectedBotId: "cinder",
	},
	parameters: {
		docs: {
			description: {
				story:
					"Four companions running at once and one at rest. Check that each running row holds its own work pose in the avatar and no activity dot, that the verb takes over the message line while it runs, and that the row at rest keeps its blot and its idle frame instead. This is the only state that moves: a running avatar animates, and every other row in the panel is a still frame, so motion in the list means work in the list. The panel reports itself busy while any row runs, and the announcement stays outside it: a live region nested inside an `aria-busy` landmark is swallowed and never reaches a screen reader. The running line also shimmers, the same sweep the activity indicator runs over its own label, so a row reads as busy from the message line alone and not only from its avatar. Pick `Identities` for the rows that hold still, `PermissionPending` for the one running state that looks like rest, `WorkingLongSummary` for a shimmering line too long for its row.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		await expect(panel).toHaveAttribute("aria-busy", "true")

		const muted = tokenColor(canvasElement, "--muted-foreground")
		const running = rowFor(canvasElement, "Cinder")
		await expect(
			running.querySelector('[data-slot="bot-activity-dot"]'),
		).toBeNull()
		await expect(slotIn(running, "roster-row-preview")).toHaveTextContent(
			"writing…",
		)
		await expect(
			within(running).getByRole("img", {
				name: "Companion avatar dog, writing",
			}),
		).toBeVisible()

		const resting = rowFor(canvasElement, "Ember")
		await expect(
			resting.querySelector('[data-slot="bot-activity-dot"]'),
		).toBeNull()
		await expect(
			within(resting).getByRole("img", { name: /idle$/ }),
		).toBeVisible()
		await expect(blotFillsIn(resting)).toEqual(["var(--bot-blot-purple)"])
		await expect(resting.querySelector('[data-slot="text-shimmer"]')).toBeNull()
		await expect(colorOf(resting, "roster-row-preview")).toBe(muted)

		const shimmer = slotIn(running, "text-shimmer")
		await expect(rowButton(running)).toHaveAttribute("aria-current", "page")
		await expect(getComputedStyle(shimmer).color).toBe(muted)

		await userEvent.hover(rowButton(running))
		await expect(getComputedStyle(shimmer).color).toBe(muted)

		await expect(
			within(rowFor(canvasElement, "Atlas")).getByRole("img", {
				name: /thinking$/,
			}),
		).toBeVisible()
		await expect(
			within(rowFor(canvasElement, "Beacon")).getByRole("img", {
				name: /searching$/,
			}),
		).toBeVisible()
		await expect(
			within(rowFor(canvasElement, "Dune")).getByRole("img", {
				name: /working$/,
			}),
		).toBeVisible()

		await expect(uniqueCount(rowHeights(rowsIn(canvasElement)))).toBe(1)
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Cinder selected, writing",
		)
	},
})

export const PermissionPending = meta.story({
	args: {
		bots: [{ ...ROSTER[0], status: "working", pose: "waiting" }, ROSTER[1]],
		selectedBotId: "atlas",
	},
	parameters: {
		docs: {
			description: {
				story:
					'A turn blocked on a permission prompt, which a host maps to `status="working"` with `pose="waiting"` — the turn is waiting on the reader, not over. Check that the avatar holds its listening pose rather than the idle frame it wears at rest and that it is still animating: the panel reports itself busy and the announcement says the companion is waiting, so a row that looked idle here would contradict both at once. Pick `Working` for the work poses that cannot be mistaken for rest, `Identities` for the still frame this state must not fall back to.',
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const row = rowFor(canvasElement, "Atlas")
		await expect(
			within(row).getByRole("img", { name: /listening$/ }),
		).toBeVisible()
		await expect(within(row).queryByRole("img", { name: /idle$/ })).toBeNull()
		await expect(slotIn(row, "roster-row-preview")).toHaveTextContent(
			"waiting…",
		)
		await expect(row.querySelector('[data-slot="bot-activity-dot"]')).toBeNull()

		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		await expect(panel).toHaveAttribute("aria-busy", "true")

		const liveRegion = canvas.getByRole("status")
		await expect(liveRegion).toHaveTextContent("Atlas selected, waiting")
		await expect(panel.contains(liveRegion)).toBe(false)
	},
})

export const Badges = meta.story({
	args: { bots: BADGED_ROSTER, selectedBotId: "beacon" },
	parameters: {
		docs: {
			description: {
				story:
					"Three rows carrying the badge a host derived from their chat — one asking for the reader, one done, one that failed — over a fourth with nothing to say. Check the badge sits at the trailing edge of the row, under the timestamp and level with the preview line, rather than on the avatar it used to crowd: the marks stack into one column the eye can run down, next to the times it is already reading. Check a row without one keeps its name, its preview and its timestamp on exactly the columns the rest of the list holds — the dot is out of the flow, so it moves nothing — that the row heights are untouched, and that the three read apart by colour and by the pulse on attention rather than by position alone. The badge is drawn and not spoken here: the row is named by its own text and the news is in the message line under it. Pick `BadgesOnRail` for the one place the mark still rides the avatar, `Working` for the running rows that carry no badge of their own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(rows.map(badgeIn)).toEqual([
			"attention",
			"done",
			"failed",
			undefined,
		])
		await expectAlignedRows(rows)
		await expect(uniqueCount(rowHeights(rows))).toBe(1)

		for (const row of rows.slice(0, 3)) {
			const dot = slotIn(row, "bot-activity-dot")
			const timestamp = slotIn(row, "roster-row-timestamp")
			const preview = slotIn(row, "roster-row-preview")

			await expect(slotIn(row, "bot-identity-avatar").contains(dot)).toBe(false)
			await expect(dot.getBoundingClientRect().right).toBeCloseTo(
				timestamp.getBoundingClientRect().right,
				0,
			)
			await expect(centerOf(dot)).toBeCloseTo(centerOf(preview), 0)
		}
	},
})

export const BadgesOnRail = meta.story({
	args: { bots: BADGED_ROSTER, selectedBotId: "beacon" },
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The same three badges once the panel is down to its icon rail, where the avatar is all that is left of a row. This is the one case where the mark rides the avatar: there is no trailing edge left to hang it on, no timestamp and no preview line, so it falls back onto the corner of the square. Check every badge is still drawn and still inside the rail rather than clipped against its trailing edge — a reader who collapses the panel is the one who most needs to be told a companion wants them — and that a row with nothing waiting still draws no dot. Pick `Badges` for the open panel, where the mark moves out to the row's edge, `Collapsed` for the rail without any.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const rows = rowsIn(canvasElement)
		await expect(rows.map(badgeIn)).toEqual([
			"attention",
			"done",
			"failed",
			undefined,
		])

		const panelBox = panel.getBoundingClientRect()
		for (const row of rows.slice(0, 3)) {
			const dot = slotIn(row, "bot-activity-dot")
			await expect(slotIn(row, "bot-identity-avatar").contains(dot)).toBe(true)

			const dotBox = dot.getBoundingClientRect()
			await expect(dotBox.right).toBeLessThanOrEqual(panelBox.right)
			await expect(dotBox.left).toBeGreaterThanOrEqual(panelBox.left)
		}
	},
})

export const MissionStripStates = meta.story({
	args: { bots: MISSION_STATE_ROSTER, selectedBotId: "beacon" },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"Four companions each carrying one open mission, one per state a mission can be in. The mission speaks in a strip under the row and never in the dot on the preview line: the strip is the state of the work, the dot is the state of the conversation, and the two shapes are never confused. Check each strip runs the full width of the row, from the leading edge of the avatar to the trailing inner edge, so it passes under the avatar rather than starting after it. Check the strip opens on its state dot in the attention, failed and done colours the panel already uses and the muted grey of a resting row while the mission simply runs, then the platform mark, the identifier, the title. Check the strip never moves: it is the one mark in the row that does not pulse, because a mission is a fact and not an alarm. The title and the mark carry `--muted-foreground`, which reaches 3.9:1 on the strip fill instead of the 4.5:1 AA asks for: the pair is the artboard’s and the fix is a lightness step on the token, which every muted line in the panel would take with it, so it is flagged for review here rather than settled inside this strip. Check every row measures 80px, the head staying 40px with the avatar centred on it rather than on the row plus the strip, and that the four chat signals are exactly what the host passed. Pick `MissionStripStack` for a row carrying four, `MissionStripSelected` for the strip under a lit row.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(rows.map(stripStatesIn)).toEqual([
			["waiting"],
			["failed"],
			["ready"],
			["working"],
		])
		await expect(stripsIn(rows[0])[0]).toHaveTextContent(
			"waiting for youOPE-71Roster row shows the mission ticket",
		)
		await expect(stripsIn(rows[3])[0]).toHaveTextContent("working")

		const dotColours = rows.map(
			(row) => getComputedStyle(dotIn(row)).backgroundColor,
		)
		await expect(uniqueCount(dotColours)).toBe(4)
		await expect(dotColours[3]).toBe(
			tokenBackground(
				canvasElement,
				"color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
			),
		)
		for (const row of rows) {
			await expect(getComputedStyle(dotIn(row)).animationName).toBe("none")
			await expectStripSpansRow(row)
			await expectAvatarCentredOnRowPart(row, "bot-identity-avatar")
		}

		await expect(rowHeights(rows)).toEqual(rows.map(() => heightForStrips(1)))
		await expect(rows.map(badgeIn)).toEqual(rows.map(() => undefined))
		await expect(slotIn(rows[0], "roster-row-badge")).toHaveTextContent(
			"Research",
		)
		await expect(slotIn(rows[0], "roster-row-preview")).toHaveTextContent(
			"Pulled the three papers and summarised each one for you.",
		)
		await expect(slotIn(rows[0], "roster-row-timestamp")).toHaveTextContent(
			"09:24",
		)
		await expectAlignedRows(rows)
	},
})

export const MissionStripSingle = meta.story({
	args: {
		bots: [MISSION_STATE_ROSTER[0], ROSTER[6]],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"One companion on one mission over one companion on none. Check the first row measures 80px and the second 52px: a strip costs 24px of height and the 4px that separates it from the row above it, and a row with nothing to say pays neither. Check the strip sits inside the row button, under the head, so one surface and one rounding cover both: the head keeps the 40px it has everywhere else in the panel and the avatar stays centred on it rather than on the row plus what hangs below it. Pick `MissionStripNone` for the bare row alone, `MissionStripStack` for four at once.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(rowHeights(rows)).toEqual([
			heightForStrips(1),
			heightForStrips(0),
		])
		await expect(stripsIn(rows[0])).toHaveLength(1)
		await expect(stripsIn(rows[1])).toHaveLength(0)
		await expect(rows.map(headHeightOf)).toEqual(
			rows.map(() => ROW_HEAD_HEIGHT),
		)
		await expect(rowHeights([rows[1]])).toEqual([BARE_ROW_HEIGHT])
		await expectAlignedRows(rows)
	},
})

export const MissionStripStack = meta.story({
	args: {
		bots: [
			{
				...ROSTER[0],
				missions: [
					missionOf("waiting", 0),
					missionOf("failed", 1),
					missionOf("ready", 2),
					missionOf("working", 3),
				],
			},
		],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"One companion running four missions at once. Check the row measures 164px and that the strips render in the order the host passed them, most urgent first: the roster never reorders them, it draws the list it is given. Check every gap in the stack is the same 4px, above the first strip as between the others, so four missions read as one block rather than as four decisions. Check each strip keeps its own state dot and its own ticket. Pick `MissionStripSingle` for the arithmetic on one strip.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const row = rowsIn(canvasElement)[0]
		const strips = stripsIn(row)

		await expect(stripStatesIn(row)).toEqual([
			"waiting",
			"failed",
			"ready",
			"working",
		])
		await expect(rowHeights([row])[0]).toBe(heightForStrips(4))
		await expect(rowHeights(strips)).toEqual(strips.map(() => 24))
		await expect(uniqueCount(gapsBetween(strips))).toBe(1)
		await expect(gapsBetween(strips)[0]).toBe(4)
		await expect(gapsBetween([rowHead(row), strips[0]])).toEqual([4])
		await expectStripSpansRow(row)
	},
})

export const MissionStripNone = meta.story({
	args: { bots: [ROSTER[6], ROSTER[3]], selectedBotId: "grove" },
	parameters: {
		docs: {
			description: {
				story:
					"Two companions with no open mission. Check neither row carries a strip and both measure the 52px a roster row has always measured: the strip is what a mission adds, never a slot held open for one that may arrive. Pick `MissionStripSingle` for the row that does carry one.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(slotsIn(canvasElement, "bot-mission-strip")).toHaveLength(0)
		await expect(rowHeights(rows)).toEqual(rows.map(() => heightForStrips(0)))
		await expectAlignedRows(rows)
	},
})

export const MissionStripSelected = meta.story({
	args: {
		bots: [MISSION_STATE_ROSTER[0], MISSION_STATE_ROSTER[1]],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The same two rows, the first of them the one the reader is in. Check the lit background and its rounding cover the head and the strip alike: the strip lives inside the button, 4px under the head and 6px from the surface edge, so a selected row reads as one block and not as a row with something stapled under it. Check the strip keeps its own rounded corners and the same 10 percent foreground fill on the lit row as on the resting one, since a mission does not change because the reader happens to be reading it, and that fill is neither the panel surface nor the selected surface it sits on. Pick `MissionStripStates` for the strip on rows at rest.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const surfaces = rows.map(
			(row) => getComputedStyle(stripsIn(row)[0]).backgroundColor,
		)

		await expect(uniqueCount(surfaces)).toBe(1)
		await expect(surfaces[0]).not.toBe(
			tokenBackground(canvasElement, "var(--sidebar)"),
		)
		await expect(getComputedStyle(stripsIn(rows[0])[0]).borderRadius).not.toBe(
			"0px",
		)
		await expect(gapsBetween([rowHead(rows[0]), stripsIn(rows[0])[0]])).toEqual(
			[4],
		)
		await expect(surfaces[0]).not.toBe(
			getComputedStyle(rowButton(rows[0])).backgroundColor,
		)
		await expect(getComputedStyle(rowButton(rows[0])).backgroundColor).not.toBe(
			getComputedStyle(rowButton(rows[1])).backgroundColor,
		)
		await expect(rowButton(rows[0]).contains(stripsIn(rows[0])[0])).toBe(true)
		await expect(
			Math.round(
				rowButton(rows[0]).getBoundingClientRect().bottom -
					stripsIn(rows[0])[0].getBoundingClientRect().bottom,
			),
		).toBe(6)
	},
})

export const MissionStripTruncatedTitle = meta.story({
	args: {
		bots: [
			{
				...ROSTER[0],
				missions: [
					{
						id: "m-long",
						state: "waiting" as const,
						ticket: {
							platform: "linear",
							externalId: "OPE-71",
							title:
								"Roster row shows the most urgent mission ticket on a strip under the row, replacing the chip",
						},
					},
				],
			},
		],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A ticket whose title runs far past the width of the strip. Check the title alone clips to an ellipsis and that everything the reader needs to act stays whole around it: the state dot, the platform mark and the identifier that names the ticket. A title is prose the product does not author and can be any length; an identifier is the handle a person types into a search box, so it is the one thing the strip never eats. Check the strip stays 24px and the row stays 80px. Pick `MissionStripStates` for titles that fit.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const row = rowsIn(canvasElement)[0]
		const strip = stripsIn(row)[0]
		const title = slotIn(row, "bot-mission-ticket-title")

		await expect(isClipped(title)).toBe(true)
		await expect(strip).toHaveTextContent("OPE-71")
		await expect(slotIn(row, "bot-mission-mark")).toBeVisible()
		await expect(rowHeights([strip])[0]).toBe(24)
		await expect(rowHeights([row])[0]).toBe(heightForStrips(1))
	},
})

export const MissionStripUnnamedPlatform = meta.story({
	args: {
		bots: [
			{
				...ROSTER[0],
				missions: [
					{
						id: "m-jira",
						state: "ready" as const,
						ticket: {
							platform: "jira",
							externalId: "OPS-9",
							title: "Rotate the staging credentials",
						},
					},
				],
			},
			{
				...ROSTER[4],
				missions: [
					{
						id: "m-inherited",
						state: "failed" as const,
						ticket: {
							platform: "constructor",
							externalId: "CON-1",
							title: "Retry the nightly export",
						},
					},
				],
			},
			{ ...ROSTER[1], missions: [missionOf("waiting", 1)] },
		],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"Two tickets from platforms the mark table does not name, beside one it does. Check both fall back to the neutral bookmark and drop the identifier: an identifier only reads as a handle when the mark beside it says which tracker to type it into, and without that mark it is a number from nowhere. The second platform is called `constructor`, a name every object in JavaScript answers to: a lookup that asks the prototype would hand it the wrong mark and print an identifier the reader cannot use, so the table is read for its own keys only. Check the title stands alone after the fallback and that the fallback sits on exactly the lane the named mark sits on, so the three strips read as one column. Pick `MissionStripStates` for the platforms the table names.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const fallback = stripsIn(rowFor(canvasElement, "Atlas"))[0]
		const inherited = stripsIn(rowFor(canvasElement, "Ember"))[0]

		await expect(fallback).toHaveTextContent("Rotate the staging credentials")
		await expect(fallback.textContent).not.toContain("OPS-9")
		await expect(inherited).toHaveTextContent("Retry the nightly export")
		await expect(inherited.textContent).not.toContain("CON-1")
		await expect(uniqueCount(startOffsets(rows, "bot-mission-mark"))).toBe(1)
		await expectAlignedRows(rows)
	},
})

export const MissionStripUntrackedTicket = meta.story({
	args: {
		bots: [
			{
				...ROSTER[0],
				missions: [
					{
						id: "m-untracked",
						state: "working" as const,
						objective: "Read the transport log and say what broke the turn",
						ticket: { platform: "", externalId: "", title: "" },
					},
				],
			},
			{
				...ROSTER[4],
				missions: [
					{
						...missionOf("waiting", 0),
						objective: "Never shown, the ticket names this one",
					},
				],
			},
		],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A mission opened on no tracker at all, over one opened on a ticket. A companion can open a mission without a ticket, and the three strings it would have filled arrive empty: the strip would then be a band holding a dot, a bookmark and not one word, which says less than an empty row. Check the first strip reads its mission objective in the lane the title holds, and the second reads its ticket title and never its objective, since a ticket the companion bothered to name is the handle the reader shares. Check the fallback changes nothing else: the state dot, the bookmark the unnamed platform falls back to and the clipping all behave as they do on a tracked mission. Pick `MissionStripUnnamedPlatform` for a ticket that has an identifier the table cannot mark, `MissionStripTruncatedTitle` for the lane running out of room.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const untracked = rowFor(canvasElement, "Atlas")
		const tracked = rowFor(canvasElement, "Ember")

		await expect(
			slotIn(untracked, "bot-mission-ticket-title"),
		).toHaveTextContent("Read the transport log and say what broke the turn")
		await expect(slotIn(tracked, "bot-mission-ticket-title")).toHaveTextContent(
			"Roster row shows the mission ticket",
		)
		await expect(tracked.textContent).not.toContain("Never shown")
		await expect(dotIn(untracked)).toBeVisible()
		await expect(slotIn(untracked, "bot-mission-mark")).toBeVisible()
		await expect(rowHeights(stripsIn(untracked))).toEqual([24])
		await expect(rowHeights([untracked, tracked])).toEqual([
			heightForStrips(1),
			heightForStrips(1),
		])
		await expectStripSpansRow(untracked)
	},
})

export const MissionStripRaised = meta.story({
	args: { bots: LOOSE_MISSION_ROSTER, selectedBotId: "beacon" },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"Three loose companions ordered by their last word, where the one carrying a mission that waits on the reader is also the one that spoke longest ago. Check it renders first anyway: a mission that cannot move without a person outranks a room that is merely fresh, so the reader finds what is blocked at the top of the list rather than hunting for a strip down it. Check the two rows below keep the order the zone already sorts them into, and that the raised row is the only taller one — it is the strip that takes it to 80px, not a different row. Pick `MissionStripPinned` for the section where a rank the reader set holds the waiting row in place.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(
			rows.map((row) => slotIn(row, "roster-row-name").textContent),
		).toEqual(["Atlas", "Beacon", "Ember"])
		await expect(stripStatesIn(rows[0])).toEqual(["waiting"])
		await expect(slotIn(rows[0], "roster-row-timestamp")).toHaveTextContent(
			"Tue",
		)
		await expect(rowHeights(rows)).toEqual([
			heightForStrips(1),
			heightForStrips(0),
			heightForStrips(0),
		])
		await expectAlignedRows(rows)
	},
})

export const MissionStripWithChatBadge = meta.story({
	args: {
		bots: [{ ...MISSION_STATE_ROSTER[0], badge: "attention" }, ROSTER[6]],
		selectedBotId: "atlas",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A companion whose mission waits on the reader and whose conversation is asking for them too. Check both marks are drawn: the chat dot at the trailing edge of the preview line, the mission strip under the row, each answering a different question. A mission never eats the badge a conversation put there and a conversation never dims a mission, so the row can say two things at once without either mark moving. Check the strip hangs below the badge instead of colliding with it. Pick `Badges` for the dot alone, `MissionStripStates` for the strip alone.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(stripStatesIn(rows[0])).toEqual(["waiting"])
		await expect(badgeIn(rows[0])).toBe("attention")
		await expect(
			slotIn(rows[0], "bot-activity-dot").getBoundingClientRect().bottom,
		).toBeLessThanOrEqual(stripsIn(rows[0])[0].getBoundingClientRect().top)
		await expect(stripsIn(rows[1])).toHaveLength(0)
		await expectAlignedRows(rows)
	},
})

export const MissionStripOnRail = meta.story({
	args: { bots: MISSION_STATE_ROSTER, selectedBotId: "beacon" },
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The same four missions once the panel is down to its icon rail. Check no strip is drawn at all: the rail is the avatar and nothing else, and a strip squeezed onto it would have nowhere to put its title. The mission is not lost, it is deferred to the open panel — what a collapsed reader still needs is the companion asking for them, and that is the badge dot the rail keeps on the avatar. Pick `MissionStripStates` for the open panel, `BadgesOnRail` for the mark the rail does keep.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		await expect(slotsIn(canvasElement, "bot-mission-strip")).toHaveLength(0)
		await expect(uniqueCount(rowHeights(rowsIn(canvasElement)))).toBe(1)
	},
})

export const MissionStripPlainMenuButton = meta.story({
	args: { bots: MISSION_STATE_ROSTER, selectedBotId: "beacon", user: READER },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The mission rows over the reader chip, an ordinary menu button that carries no strip. Check the chip is drawn exactly as every menu button outside the roster is: one line, its content centred on it, the 10px gap every menu button puts between its icon and its label, and no head wrapper split out of it. A strip changes the button that has one and no other, so a mission in the roster never reshapes the footer, the switcher or a header. Pick `MissionStripStates` for the rows that do carry one.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const chip = slotIn(
			slotIn(canvasElement, "sidebar-footer"),
			"sidebar-menu-button",
		)
		const style = getComputedStyle(chip)

		await expect(
			chip.querySelector('[data-slot="sidebar-menu-head"]'),
		).toBeNull()
		await expect(style.flexDirection).toBe("row")
		await expect(style.alignItems).toBe("center")
		await expect(style.columnGap).toBe("10px")
		await expect(slotsIn(chip, "bot-mission-strip")).toHaveLength(0)
	},
})

export const LongContent = meta.story({
	args: {
		bots: [
			{
				id: "long",
				name: "Bartholomew Featherstonehaugh the Third",
				title: "Infrastructure",
				animal: "bear",
				lastMessage: LAST_MESSAGE,
				timestamp: "Yesterday",
			},
			ROSTER[1],
			{
				id: "longer",
				name: "Anastasia Konstantinopoulos-Whitmore",
				animal: "owl",
				lastMessage: LAST_MESSAGE,
				timestamp: "12:07",
			},
		],
		selectedBotId: "long",
	},
	parameters: {
		docs: {
			description: {
				story:
					"Names, titles and messages that do not fit. Check that each of them clips to one line with an ellipsis rather than wrapping — a wrapped name would take its row taller and break the column the rest of the list stands on — that the badge stays whole beside a truncated name instead of being pushed out, and that the timestamp keeps its slot on the trailing edge whatever the name does. Pick `Roster` for the same columns under content that fits.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const long = rows[0]
		const name = slotIn(long, "roster-row-name")
		const preview = slotIn(long, "roster-row-preview")

		await expect(isClipped(name)).toBe(true)
		await expect(isClipped(preview)).toBe(true)
		await expect(name.getBoundingClientRect().height).toBeLessThanOrEqual(
			SINGLE_LINE_HEIGHT,
		)
		await expect(preview.getBoundingClientRect().height).toBeLessThanOrEqual(
			SINGLE_LINE_HEIGHT,
		)
		await expect(slotIn(long, "roster-row-badge")).toBeVisible()

		await expectAlignedRows(rows)
	},
})

export const MarkdownPreview = meta.story({
	args: {
		bots: [
			{
				id: "marked",
				name: "Atlas",
				animal: "owl",
				lastMessage:
					"## Release notes\n\n- **Renamed** the `transport` module\n- Read [the report](https://example.com/report)\n\n```ts\nconst turn = resume()\n```",
				timestamp: "12:07",
			},
			{
				id: "plain",
				name: "Beacon",
				animal: "bear",
				lastMessage: "Ran the suite twice, both green.",
				timestamp: "11:40",
			},
		],
		selectedBotId: "marked",
	},
	parameters: {
		docs: {
			description: {
				story:
					"A message written in markdown. The preview is one clipped line, so the marks are reduced away rather than styled: headings, list markers, emphasis, links, inline code and fences leave only their words, and the several lines read as one. Compare with the second row, whose message carries no markup and comes through untouched.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(slotIn(rows[0], "roster-row-preview")).toHaveTextContent(
			"Release notes Renamed the transport module Read the report const turn = resume()",
		)
		await expect(slotIn(rows[1], "roster-row-preview")).toHaveTextContent(
			"Ran the suite twice, both green.",
		)
	},
})

export const RowContextMenu = meta.story({
	args: {
		bots: ROSTER.slice(0, 4),
		selectedBotId: "beacon",
		onPinRoster: fn(),
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The actions behind a row, on the third one. There is no button to find: the row itself is the trigger, so the columns never move to make room for a control and nothing appears on hover. A pointer right-clicks the row; a keyboard reaches the same menu with the Menu key or Shift+F10 on the focused row, which the browser turns into the same `contextmenu` event this story fires. Focus lands on the menu itself and the first arrow reaches its first row, which is what a menu opened by a pointer does everywhere in Base UI. Check that the menu leads with pin and a rule under it, then offers companion settings, a duplicate under it and delete with delete reading as destructive, that the arrow keys walk them, and that Escape closes the menu and puts focus back on the row it belongs to rather than dropping it on the page, as does choosing an entry. The highlighted item is the focused one, drawn by the registry item's own `focus:bg-accent`, so the focus ring and the highlight are the same signal. The row carries no `aria-haspopup`: a click on it opens a companion, not a menu, so the registry trigger leaves the row saying only what it does. The menu is left open here so the panel can be read with it up. Delete carries `--destructive`, which does not clear AA against a light popup at this size — the same open question `Primitives/Button` already carries on its own destructive variant, and a token decision rather than a decision this menu can make on its own.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const row = rowFor(canvasElement, "Cinder")
		const trigger = rowButton(row)
		const overlay = within(document.body)

		await expect(within(row).getAllByRole("button")).toHaveLength(1)

		await userEvent.tab()
		await userEvent.tab()
		await userEvent.tab()
		await userEvent.tab()
		await expect(trigger).toHaveFocus()

		fireEvent.contextMenu(trigger)
		const menu = await shown(
			await overlay.findByRole("menu", { name: "Actions for Cinder" }),
		)
		const items = within(menu).getAllByRole("menuitem")
		await expect(items.map((item) => item.textContent)).toEqual([
			"Pin",
			"Settings",
			"Duplicate",
			"Delete",
		])
		const [pin, settings, duplicate, remove] = items
		await expect(pin.nextElementSibling).toBe(
			within(menu).getAllByRole("separator")[0],
		)
		await userEvent.keyboard("{ArrowDown}")
		await waitFor(async () => {
			await expect(pin).toHaveFocus()
		}, FRAME_POLL)
		await expect(getComputedStyle(pin).backgroundColor).not.toBe(
			getComputedStyle(settings).backgroundColor,
		)
		await expect(getComputedStyle(remove).color).not.toBe(
			getComputedStyle(settings).color,
		)

		await userEvent.keyboard("{ArrowDown}")
		await expect(settings).toHaveFocus()
		await userEvent.keyboard("{ArrowDown}")
		await expect(duplicate).toHaveFocus()
		await userEvent.keyboard("{ArrowDown}")
		await expect(remove).toHaveFocus()
		await expect(getComputedStyle(remove).backgroundColor).not.toBe(
			getComputedStyle(settings).backgroundColor,
		)
		await userEvent.keyboard("{Escape}")
		await waitFor(async () => {
			await expect(overlay.queryByRole("menu")).toBeNull()
		}, FRAME_POLL)
		await expect(trigger).toHaveFocus()

		await userEvent.pointer({ keys: "[MouseRight]", target: trigger })
		await userEvent.click(
			await overlay.findByRole("menuitem", { name: "Settings" }),
		)
		await expect(args.onEditBot).toHaveBeenCalledWith("cinder")
		await waitFor(async () => {
			await expect(trigger).toHaveFocus()
		}, FRAME_POLL)

		await userEvent.pointer({ keys: "[MouseRight]", target: trigger })
		await userEvent.click(
			await overlay.findByRole("menuitem", { name: "Duplicate" }),
		)
		await expect(args.onDuplicateBot).toHaveBeenCalledWith("cinder")

		await userEvent.pointer({ keys: "[MouseRight]", target: trigger })
		await userEvent.click(
			await overlay.findByRole("menuitem", { name: "Delete" }),
		)
		await expect(args.onDeleteBot).toHaveBeenCalledWith("cinder")

		await userEvent.pointer({ keys: "[MouseRight]", target: trigger })
		await expect(await overlay.findByRole("menu")).toBeVisible()
		await expect(
			uniqueCount(endOffsets(rowsIn(canvasElement), "roster-row-timestamp")),
		).toBe(1)
	},
})

export const Collapsed = meta.story({
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The panel opened on its icon rail, which is how a host restores a remembered choice through `defaultOpen`. Check that the rail is one avatar wide with the avatars sitting centred in it and nothing clipped against either edge, that an avatar keeps the size the row asks for and fits whole inside the row rather than being cut by it, that hovering a row names it in a hint beside the rail — the rail hides the label, so the pointer needs the name back, and the row keeps `aria-label` for the readers who never hover — that the create button rides down with it, and that the names, badges and timestamps are gone from the picture and from the accessibility tree — each row keeps its name through `aria-label` instead. A row is still one button and one only, and right-clicking it still reaches its actions. Pick `Toggle` to watch the panel travel between the two widths.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const create = canvas.getByRole("button", { name: "New companion" })
		await userEvent.tab()
		await expect(create).toHaveFocus()

		const row = rowsIn(canvasElement)[0]
		await userEvent.tab()
		await expect(rowButton(row)).toHaveFocus()
		await expect(rowButton(row).matches(":focus-visible")).toBe(true)
		await expect(rowButton(row)).toHaveAccessibleName("Atlas")
		await expect(within(row).getAllByRole("button")).toHaveLength(1)

		const panelBox = panel.getBoundingClientRect()
		const avatarBox = avatarDrawingIn(row).getBoundingClientRect()
		await expect(avatarBox.left).toBeGreaterThanOrEqual(panelBox.left)
		await expect(avatarBox.right).toBeLessThanOrEqual(panelBox.right)
		await expectAvatarDrawnAtCallSiteSize(row)
		await expectAvatarWholeInRow(row)

		await expect(
			slotIn(row, "roster-row-preview").closest("[aria-hidden='true']"),
		).not.toBeNull()

		await userEvent.hover(rowButton(row))
		await expect(await screen.findByRole("tooltip")).toHaveTextContent("Atlas")
	},
})

export const SpaceTinted = meta.story({
	render: renderTintedShell,
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The roster in a space that carries a colour. The panel paints nothing of its own — the shell surface runs under it to the window edge — so the tint reaches it by inheritance rather than by a second declaration that could drift from the first. Check that the panel's own paint is nothing at all, that the eight tokens it redeclares read the tinted values inside it and the untinted ones outside the shell, and that its trailing edge draws no rule the thread card would double. A row, a section card, a rule or a field that kept the untinted value is how a tint leaks out of a space. The timestamp and the preview line read 4.38:1 against the tinted surface where AA asks 4.5:1, which is the `--muted-foreground` pair the untinted panel already carries and a token decision rather than one this panel can make. Pick `Roster` for the untinted panel, `Conversation/Routines/RoutinesPanel` `OnShellSurfaceTinted` for the panel opposite.",
			},
		},
	},
	play: async ({ canvas }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const shell = canvas.getByRole("main").parentElement as HTMLElement
		const inner = slotIn(panel, "sidebar-inner")

		await expect(paintOf(inner)).toBe("rgba(0, 0, 0, 0)")
		await expect(getComputedStyle(panel).borderInlineEndWidth).toBe("0px")
		await expect(tokenPaintsIn(panel)).toEqual(tokenPaintsIn(shell, "on-shell"))
		await expect(tokenPaintsIn(panel)).not.toEqual(
			tokenPaintsIn(document.body, "on-shell"),
		)
	},
})

export const Toggle = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The collapse itself, driven from Cmd/Ctrl+B — the panel carries no trigger of its own, so the shortcut and whatever control the page mounts are the two ways in. Check that one press takes the panel to the rail and back, that focus stays exactly where it was instead of falling back to the page, and that the rows fold down to the icon square the rail leaves them and come back to the height they had. Pick `Collapsed` for the resting rail.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const row = rowsIn(canvasElement)[0]
		const button = rowButton(row)
		const preview = slotIn(row, "roster-row-preview")
		const rowHeight = row.getBoundingClientRect().height
		const rail = railWidth()

		await expect(stateOf(panel)).toBe("expanded")
		await userEvent.tab()
		await userEvent.tab()
		await expect(button).toHaveFocus()

		await userEvent.keyboard("{Meta>}b{/Meta}")
		await expect(stateOf(panel)).toBe("collapsed")
		await expect(button).toHaveFocus()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		await userEvent.keyboard("{Control>}b{/Control}")
		await expect(stateOf(panel)).toBe("expanded")
		await expect(button).toHaveFocus()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeGreaterThan(rail)
			await expect(row.getBoundingClientRect().height).toBe(rowHeight)
			const label = preview.closest("[aria-hidden]")
			await expect(label && getComputedStyle(label).opacity).toBe("1")
		}, FRAME_POLL)
	},
})

export const Narrow = meta.story({
	globals: { viewport: { value: "narrow" } },
	parameters: {
		viewport: { options: NARROW_VIEWPORT },
		docs: {
			description: {
				story:
					"The roster in a window just wide enough to keep two columns, one notch above the width where the panel becomes a drawer. Check that it is still a column at its full width rather than the icon rail — a breakpoint that collapsed it early would fail here — and that the rows keep their columns at that width. Pick `Roster` for a full window, `Layout/WorkspaceShell` `OffCanvas` for the drawer a narrower window gets instead.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		await expect(panel.getBoundingClientRect().width).toBeGreaterThan(
			railWidth(),
		)
		await expect(
			uniqueCount(endOffsets(rowsIn(canvasElement), "roster-row-timestamp")),
		).toBe(1)
	},
})

export const ReducedMotion = meta.story({
	args: { selectedBotId: "cinder" },
	parameters: {
		docs: {
			description: {
				story:
					"The panel under `prefers-reduced-motion: reduce`, which is how the test browser renders every story here. Check that the running avatar settles on a static frame of its pose, that the running message line drops its sweep and its gradient for the flat muted colour every other line wears, that the shell drops its width and row springs to zero duration, and that nothing else changes: the rows keep their selection, their focus ring and their two lines, so the state is still readable without motion.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const row = rowFor(canvasElement, "Cinder")
		await expect(rowButton(row)).toHaveAttribute("aria-current", "page")
		await expect(row.querySelector('[data-slot="bot-activity-dot"]')).toBeNull()

		const shimmer = slotIn(row, "text-shimmer")
		await expect(getComputedStyle(shimmer).animationName).toBe("none")
		await expect(getComputedStyle(shimmer).color).toBe(
			tokenColor(canvasElement, "--muted-foreground"),
		)
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Cinder selected, working",
		)

		await userEvent.tab()
		await userEvent.tab()
		const first = rowButton(rowsIn(canvasElement)[0])
		await expect(first).toHaveFocus()
		await expect(first.matches(":focus-visible")).toBe(true)
	},
})

export const Footer = meta.story({
	args: {
		bots: LONG_ROSTER,
		selectedBotId: "beacon-0",
		footer: FOOTER_CONTENT,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The pinned region under the list, given a control by the host — the panel is handed a node and draws it, it knows nothing of what it is. Check that it sits under the last row rather than beside it, that its bottom edge is the bottom edge of the column, and that a roster three times too long for the window scrolls inside the list alone: the region stays exactly where it was and the column itself never scrolls. Pick `NoFooter` for the same list with the slot left out, `FooterWithoutBots` for the slot over an empty roster.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const panel = slotIn(canvasElement, "sidebar-container")
		const list = slotIn(canvasElement, "sidebar-content")
		const footer = slotIn(canvasElement, "sidebar-footer")

		await expect(
			within(footer).getByRole("button", { name: FOOTER_LABEL }),
		).toBeVisible()
		await expectFooterAtColumnBottom(canvasElement)

		const footerTop = footer.getBoundingClientRect().top
		await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
		list.scrollTop = list.scrollHeight

		await expect(list.scrollTop).toBeGreaterThan(0)
		await expect(panel.scrollTop).toBe(0)
		await expect(footer.getBoundingClientRect().top).toBeCloseTo(footerTop, 0)
	},
})

export const NoFooter = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same column with the slot left out, which is every other story here. Check that no pinned region is drawn at all — not an empty one, not a reserved strip — and that the list runs all the way to the bottom edge of the column, so a host that wants nothing under its roster pays nothing for the slot. Pick `Footer` for the same list with the slot filled.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(slotsIn(canvasElement, "sidebar-footer")).toHaveLength(0)
		await expect(
			bottomOf(slotIn(canvasElement, "sidebar-content")),
		).toBeCloseTo(bottomOf(slotIn(canvasElement, "sidebar-container")), 0)
	},
})

export const FooterWithoutBots = meta.story({
	args: { bots: [], footer: FOOTER_CONTENT },
	parameters: {
		docs: {
			description: {
				story:
					"The slot over a reader who owns no companion yet. Check that the pinned region stays against the bottom edge of the column instead of riding up under the empty copy — the list keeps the space it is not using, so the region reads as part of the column rather than as the end of a short list. Pick `Empty` for the same state without the slot.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(rowsIn(canvasElement)).toHaveLength(0)
		await expectFooterAtColumnBottom(canvasElement)
	},
})

export const FooterOnRail = meta.story({
	render: renderShell(false),
	args: { footer: FOOTER_CONTENT },
	parameters: {
		docs: {
			description: {
				story:
					"The slot on the icon rail. Check that the pinned region drops its side padding and centres what it holds, exactly as the create button rides down in the header — a rail one avatar wide has no room for padding either side — and that nothing is clipped against either edge of the rail. Pick `Collapsed` for the rail without the slot.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const panel = slotIn(canvasElement, "sidebar-container")
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const footer = slotIn(canvasElement, "sidebar-footer")
		const style = getComputedStyle(footer)
		await expect(style.paddingLeft).toBe("0px")
		await expect(style.paddingRight).toBe("0px")

		const panelBox = panel.getBoundingClientRect()
		const buttonBox = within(footer)
			.getByRole("button", { name: FOOTER_LABEL })
			.getBoundingClientRect()
		await expect(buttonBox.left).toBeGreaterThanOrEqual(panelBox.left)
		await expect(buttonBox.right).toBeLessThanOrEqual(panelBox.right)
		await expectFooterAtColumnBottom(canvasElement)
	},
})

export const WithUser = meta.story({
	args: { user: READER },
	parameters: {
		docs: {
			description: {
				story:
					"The reader themselves, pinned under the list — the only way into their own settings, so a host that has an account to show always hands one down. Check that the chip opens the region with the picture leading and the name beside it, that it covers the whole row since nothing else is drawn there, that the chip starts on the column a conversation row above it starts on, and that the row leaves the same channel on both sides — the thread card's own gutter counts towards the trailing one, so the roster pays 4px there and 8px against the window edge to read as even air — and that activating it fires the open event once. Pick `WithUserAndFooter` for the same chip sharing the row.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const footer = slotIn(canvasElement, "sidebar-footer")
		const chip = within(footer).getByRole("button", { name: READER_NAME })
		const inner = slotIn(canvasElement, "sidebar-inner").getBoundingClientRect()
		const chipBox = chip.getBoundingClientRect()
		const rowBox = rowButton(rowsIn(canvasElement)[0]).getBoundingClientRect()
		const card = canvas.getByRole("main").getBoundingClientRect()
		const gutter = rowBox.left - inner.left
		await expect(card.left - rowBox.right).toBe(gutter)
		await expect(chipBox.left - inner.left).toBe(gutter)

		await expect(chip.getBoundingClientRect().width).toBeCloseTo(
			footerRowWidth(footer),
			0,
		)
		await expectFooterAtColumnBottom(canvasElement)

		await userEvent.click(chip)
		await expect(args.onOpenUserSettings).toHaveBeenCalledTimes(1)
	},
})

export const WithUserAndFooter = meta.story({
	args: { user: READER, footer: FOOTER_CONTENT },
	parameters: {
		docs: {
			description: {
				story:
					"The chip beside what the host pinned next to it — the update badge, in the app. Check that the chip comes first and gives way to the control rather than pushing it off the row: the two share one line, the control keeps its size, and the name is what is clipped. Pick `WithUserAndIdleFooter` for the same pair while the control draws nothing.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const footer = slotIn(canvasElement, "sidebar-footer")
		const chip = within(footer)
			.getByRole("button", { name: READER_NAME })
			.getBoundingClientRect()
		const pinned = within(footer)
			.getByRole("button", { name: FOOTER_LABEL })
			.getBoundingClientRect()

		await expect(chip.right).toBeLessThanOrEqual(pinned.left)
		await expect(verticalCentreOf(chip)).toBeCloseTo(
			verticalCentreOf(pinned),
			0,
		)
		await expect(chip.width).toBeLessThan(footerRowWidth(footer))
	},
})

export const WithUserAndIdleFooter = meta.story({
	args: { user: READER, footer: SILENT_FOOTER_CONTENT },
	parameters: {
		docs: {
			description: {
				story:
					"The state the app is in nearly all the time: the host pinned a node beside the chip and that node draws nothing, since there is no update to install. Check that the row reads exactly as `WithUser` — the chip covers the whole width, with no gap held open beside it for something that is not there. Pick `WithUserAndFooter` for the moment the control does draw.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const footer = slotIn(canvasElement, "sidebar-footer")
		const chip = within(footer).getByRole("button", { name: READER_NAME })

		await expect(within(footer).getAllByRole("button")).toHaveLength(1)
		await expect(chip.getBoundingClientRect().width).toBeCloseTo(
			footerRowWidth(footer),
			0,
		)
	},
})

export const WithUserOnRail = meta.story({
	render: renderShell(false),
	args: { user: READER, footer: FOOTER_CONTENT },
	parameters: {
		docs: {
			description: {
				story:
					"The chip and the host's control once the panel collapses to its rail, where a row one avatar wide cannot hold both side by side. Check that they stack with the control above the chip — the chip is the row that is always there, so it stays against the bottom edge — that the picture is drawn alone with the name still naming the button, and that neither is clipped against an edge. `UserChip → OnRail` owns how the picture sits inside the chip; this one owns where the chip sits in the region. Pick `FooterOnRail` for the rail without a reader.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const panel = slotIn(canvasElement, "sidebar-container")
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const footer = slotIn(canvasElement, "sidebar-footer")
		const chipButton = within(footer).getByRole("button", { name: READER_NAME })
		const pinned = within(footer)
			.getByRole("button", { name: FOOTER_LABEL })
			.getBoundingClientRect()
		const avatar = slotIn(footer, "user-avatar").getBoundingClientRect()

		await expect(pinned.bottom).toBeLessThanOrEqual(avatar.top)
		await expect(chipButton).toHaveAttribute("aria-label", READER_NAME)

		const panelBox = panel.getBoundingClientRect()
		await expect(avatar.left).toBeGreaterThanOrEqual(panelBox.left)
		await expect(avatar.right).toBeLessThanOrEqual(panelBox.right)
		await expectFooterAtColumnBottom(canvasElement)
	},
})

export const DragRegion = meta.story({
	args: { user: READER },
	render: (args: AppSidebarProps) => (
		<WorkspaceShell
			defaultOpen
			sidebar={<AppSidebar {...args} data-tauri-drag-region="deep" />}
		>
			{null}
		</WorkspaceShell>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The panel as a frameless desktop window mounts it: the column is what the window is carried by. Check that the attribute lands on the panel itself, so the space between the rows drags the window, and that nothing the reader presses carries it — a row, the create button and the chip are buttons, and a button with no drag region of its own is what stops the drag.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotIn(canvasElement, "sidebar-container")).toHaveAttribute(
			"data-tauri-drag-region",
			"deep",
		)

		const pressable = [
			rowButton(rowsIn(canvasElement)[0]),
			canvas.getByRole("button", { name: "New companion" }),
			canvas.getByRole("button", { name: READER_NAME }),
		]
		for (const target of pressable) {
			await expect(target.tagName).toBe("BUTTON")
			await expect(target).not.toHaveAttribute("data-tauri-drag-region")
		}
	},
})

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

const carouselIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "space-carousel")

const panelsIn = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "space-panel")

const panelInView = (canvasElement: HTMLElement) => {
	const panel = panelsIn(canvasElement).find(
		(box) => !box.hasAttribute("inert"),
	)
	if (!panel) throw new Error("No space panel is in view")
	return panel
}

const SETTLE = 250

const slotShown = (carousel: HTMLElement) =>
	Math.round(carousel.scrollLeft / carousel.clientWidth)

const slotReported = (carousel: HTMLElement) =>
	panelsIn(carousel).indexOf(panelInView(carousel))

const swipeBeside = async (carousel: HTMLElement, step: number) => {
	carousel.scrollLeft = (slotReported(carousel) + step) * carousel.clientWidth
	await new Promise((resolve) => setTimeout(resolve, SETTLE))
}

const carryTo = async (carousel: HTMLElement, panels: number) => {
	carousel.style.scrollSnapType = "none"
	carousel.scrollLeft = panels * carousel.clientWidth
	await new Promise((resolve) => setTimeout(resolve, SETTLE))
}

const settleFlush = async (carousel: HTMLElement) => {
	carousel.style.scrollSnapType = ""
	carousel.scrollLeft = slotShown(carousel) * carousel.clientWidth
	await new Promise((resolve) => setTimeout(resolve, SETTLE))
}

const rostersAcross = (spaces: Space[]): Record<string, AppSidebarBot[]> =>
	Object.fromEntries(
		spaces.map((space, rank) => [
			space.id,
			ROSTER.filter((_, index) => index % spaces.length === rank),
		]),
	)

const leftOf = (node: HTMLElement) => node.getBoundingClientRect().left

const FIVE_SPACES = SPACES.slice(0, 5)

const FIVE_ROSTERS = rostersAcross(FIVE_SPACES)

const LiveSpaces = (args: AppSidebarProps) => {
	const [selectedSpaceId, setSelectedSpaceId] = useState(args.selectedSpaceId)

	return (
		<WorkspaceShell
			defaultOpen
			sidebar={
				<AppSidebar
					{...args}
					onSelectSpace={(id) => {
						args.onSelectSpace?.(id)
						setSelectedSpaceId(id)
					}}
					selectedSpaceId={selectedSpaceId}
				/>
			}
		>
			{null}
		</WorkspaceShell>
	)
}

const spaceDotsIn = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "space-dot-button")

const openSpaceMenu = async (trigger: HTMLElement) => {
	fireEvent.click(trigger)
	return within(
		await shown(await screen.findByRole("menu", { name: "Spaces" })),
	)
}

export const OneSpace = meta.story({
	args: {
		spaces: [SPACES[0]],
		selectedSpaceId: "perso",
		botsBySpaceId: { perso: ROSTER },
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The state every account opens in: one space, so the header names it and nothing else navigates. Check the switcher sits left of the create button on the same line with the create button's three insets untouched, that no dot strip is drawn in the pinned region, that the row holds exactly one panel filling the list area, and that the row is no wider than that panel, so the trackpad has nothing to scroll and lands nowhere new — there is nowhere to go, and a gesture that silently does nothing is better than one that rubber-bands. Pick `FiveSpaces` for the navigating case, `SpaceScrolling` for the row under the gesture.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement }) => {
		const switcher = canvas.getByRole("button", {
			name: "Change space, Perso open",
		})
		const create = canvas.getByRole("button", { name: "New companion" })
		const header = slotIn(canvasElement, "sidebar-header")

		await expect(switcher.getBoundingClientRect().right).toBeLessThanOrEqual(
			create.getBoundingClientRect().left,
		)

		const headerBox = header.getBoundingClientRect()
		const createBox = create.getBoundingClientRect()
		const inset = Math.round(headerBox.right - createBox.right)
		await expect(Math.round(createBox.top - headerBox.top)).toBe(inset)
		await expect(Math.round(headerBox.bottom - createBox.bottom)).toBe(inset)

		await expect(spaceDotsIn(canvasElement)).toHaveLength(0)

		const carousel = carouselIn(canvasElement)
		const panels = panelsIn(canvasElement)
		await expect(panels).toHaveLength(1)
		await expect(panels[0].offsetWidth).toBe(carousel.clientWidth)

		await expect(carousel.scrollWidth).toBe(carousel.clientWidth)

		await swipeBeside(carousel, 1)
		await expect(args.onSelectSpace).not.toHaveBeenCalled()
	},
})

export const FiveSpaces = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Five spaces with the second one open, each with its own roster — the everyday case, and the one that exercises all four ways in. Check the dot strip is centred in the pinned region with only the open dot filled and full size, that pressing a dot reports its id, that the row is three panels wide however many spaces there are, so one swipe reaches one space, that landing on it reports it and only it, and that Cmd and a digit reaches a space directly while a digit past the last one is left alone. Pick `NineSpaces` for the strip at its widest, `SpacesOnRail` for the same panel collapsed, `SpaceScrolling` for the gesture itself against a host that follows it, `SpacesWithoutRosters` for the same spaces before a host hands its rosters over.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(
			canvas.getByRole("button", { name: "Change space, Vocca open" }),
		).toBeVisible()

		const dots = spaceDotsIn(canvasElement)
		await expect(dots).toHaveLength(5)
		await expect(dots[1]).toHaveAttribute("aria-current", "true")
		await expect(dots[0]).toHaveAttribute("aria-current", "false")

		const strip = slotIn(canvasElement, "space-dots").getBoundingClientRect()
		const region = slotIn(
			canvasElement,
			"sidebar-footer",
		).getBoundingClientRect()
		await expect(verticalCentreOf(strip)).toBeLessThan(verticalCentreOf(region))
		await expect(Math.round(strip.left - region.left)).toBe(
			Math.round(region.right - strip.right),
		)

		await userEvent.click(dots[3])
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("veille")

		const carousel = carouselIn(canvasElement)
		await expect(carousel.scrollWidth).toBe(carousel.clientWidth * 3)

		await userEvent.keyboard("{Meta>}5{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("archives")

		await userEvent.keyboard("{Meta>}7{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
	},
})

const crossSafePolygon = async (panel: HTMLElement) => {
	fireEvent.mouseMove(panel)
	await waitFor(() =>
		expect(getComputedStyle(panel).pointerEvents).not.toBe("none"),
	)
}

const openRowMenu = async (canvasElement: HTMLElement, name: string) => {
	fireEvent.contextMenu(rowButton(rowFor(canvasElement, name)))
	return within(
		await shown(
			await screen.findByRole("menu", { name: `Actions for ${name}` }),
		),
	)
}

const SPACES_BRANCH = "Spaces"

const LAST_SPACE_NOTE =
	"A companion stays in at least one space. Delete the companion to remove it."

const tintOf = (node: HTMLElement) => getComputedStyle(node).backgroundColor

type Gestures = {
	click: (node: Element) => Promise<void>
	hover: (node: Element) => Promise<void>
}

const openSpacesBranch = async (
	canvasElement: HTMLElement,
	bot: string,
	userEvent: Gestures,
) => {
	const menu = await openRowMenu(canvasElement, bot)
	await userEvent.hover(menu.getByRole("menuitem", { name: SPACES_BRANCH }))
	const panel = await settled(
		await screen.findByRole("menu", { name: SPACES_BRANCH }),
	)
	await crossSafePolygon(panel)
	return panel
}

type Typing = { keyboard: (keys: string) => Promise<void> }

const walkIntoSpacesBranch = async (
	canvasElement: HTMLElement,
	bot: string,
	userEvent: Typing,
) => {
	const menu = await openRowMenu(canvasElement, bot)
	const trigger = menu.getByRole("menuitem", { name: SPACES_BRANCH })
	for (const _ of menu.getAllByRole("menuitem")) {
		if (document.activeElement === trigger) break
		await userEvent.keyboard("{ArrowDown}")
	}
	await expect(trigger).toHaveFocus()
	await userEvent.keyboard("{ArrowRight}")
	const panel = await settled(
		await screen.findByRole("menu", { name: SPACES_BRANCH }),
	)
	await crossSafePolygon(panel)
	return panel
}

const BEACON_IN_TWO_SPACES: Record<string, AppSidebarBot[]> = {
	...FIVE_ROSTERS,
	atelier: [
		...FIVE_ROSTERS.atelier,
		...ROSTER.filter((bot) => bot.id === "beacon"),
	],
}

const WORDY_SPACE: Space = {
	id: "wordy",
	name: "Recherche, veille et documentation partagée",
	colour: "cyan",
}

const WORDY_SPACES = [...FIVE_SPACES, WORDY_SPACE]

export const RowSpaces = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"The branch under a row that says which spaces the companion belongs to. A companion is one companion in one or more spaces, not a copy per space, so there is nothing to duplicate towards and nothing to move: the branch lists every space of the account in the order the switcher gives them, each with its tint dot and its name, and ticks the ones holding the companion. Beacon sits in Vocca and Atelier here, so two rows read as ticked and three as free. The branch keeps no membership of its own — every tick is read from the rosters the sidebar was handed, so a refused edit that never reaches the store leaves the tick where it was. With the companion in more than one space, every row is live and nothing is drawn under them. Pick `RowTogglesSpaces` for both directions of the toggle in one visit, `RowLastSpace` for the companion that has only one space left.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		const menu = await openRowMenu(canvasElement, "Beacon")
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Settings", "Duplicate", SPACES_BRANCH, "Delete"])
		await expect(
			menu.getByRole("menuitem", { name: SPACES_BRANCH }),
		).toHaveAttribute("aria-haspopup", "menu")

		const panel = await openSpacesBranch(canvasElement, "Beacon", userEvent)
		const rows = within(panel).getAllByRole("menuitemcheckbox")
		await expect(rows.map((row) => row.textContent)).toEqual(
			FIVE_SPACES.map((space) => space.name),
		)
		await expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual([
			"false",
			"true",
			"true",
			"false",
			"false",
		])
		await expect(slotsIn(panel, "space-dot").map(tintOf)).toEqual(
			FIVE_SPACES.map((space) =>
				tokenColor(canvasElement, `--bot-blot-${space.colour}`),
			),
		)
		for (const row of rows)
			await expect(row).not.toHaveAttribute("aria-disabled", "true")
		await expect(within(panel).queryByText(LAST_SPACE_NOTE)).toBeNull()
		await expect(within(panel).queryAllByRole("separator")).toHaveLength(0)
	},
})

export const RowTogglesSpaces = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"Two spaces settled in one visit. Ticking Perso reports the companion and that space to the add handler; unticking Atelier, without reopening anything, reports them to the remove handler — a membership is rarely edited alone, so the branch and the menu under it stay open across both, the way every checkbox menu in this system behaves. Neither gesture reaches the other handler, and neither redraws a tick on its own: the rows here are fed a roster that never changes, so both stay exactly as they were drawn. The tick a reader ends up seeing is the one the host hands back, which is also what makes a refused edit honest.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const panel = await openSpacesBranch(canvasElement, "Beacon", userEvent)
		const rows = within(panel).getAllByRole("menuitemcheckbox")

		await userEvent.click(rows[0])
		await expect(args.onAddBotToSpace).toHaveBeenCalledWith("beacon", "perso")
		await expect(panel).toBeVisible()

		await userEvent.click(rows[2])
		await expect(args.onRemoveBotFromSpace).toHaveBeenCalledWith(
			"beacon",
			"atelier",
		)

		await expect(panel).toBeVisible()
		await expect(
			screen.getByRole("menu", { name: "Actions for Beacon" }),
		).toBeVisible()
		await expect(args.onAddBotToSpace).toHaveBeenCalledTimes(1)
		await expect(args.onRemoveBotFromSpace).toHaveBeenCalledTimes(1)
		await expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual([
			"false",
			"true",
			"true",
			"false",
			"false",
		])
	},
})

export const RowMembershipsUnknown = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"An account with spaces handed one flat roster instead of one roster per space. Which spaces hold a companion cannot be read from that, and a branch that guessed would tick the open space and lie about the rest, so the branch is not drawn at all — a host that wants it passes `botsBySpaceId`. The rest of the menu is untouched.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const menu = await openRowMenu(canvasElement, "Beacon")

		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Settings", "Duplicate", "Delete"])
		await expect(
			menu.queryByRole("menuitem", { name: SPACES_BRANCH }),
		).toBeNull()
	},
})

const LiveMemberships = (args: AppSidebarProps) => {
	const [rosters, setRosters] = useState(args.botsBySpaceId ?? {})

	return (
		<WorkspaceShell
			defaultOpen
			sidebar={
				<AppSidebar
					{...args}
					botsBySpaceId={rosters}
					onRemoveBotFromSpace={(botId, spaceId) => {
						args.onRemoveBotFromSpace?.(botId, spaceId)
						setRosters((held) => ({
							...held,
							[spaceId]: (held[spaceId] ?? []).filter(
								(bot) => bot.id !== botId,
							),
						}))
					}}
				/>
			}
		>
			{null}
		</WorkspaceShell>
	)
}

export const RowLeavesOpenSpace = meta.story({
	render: LiveMemberships,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"Unticking the space the reader is looking at. Beacon is held by Vocca and Atelier, and Vocca is the roster on screen, so this one gesture deletes the row the menu hangs off and the menu with it. Every other row keeps the branch open for a second edit; this row hands focus to the roster region first and closes the menu on its way out, so nothing is left hanging over a row that no longer exists and a keyboard reader carries on from inside the sidebar rather than from the top of the document. Pick `RowTogglesSpaces` for the ordinary case, where the row survives its own edit and the branch stays open.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const beaconRows = () =>
			rowsIn(canvasElement).filter(
				(row) => slotIn(row, "roster-row-name").textContent === "Beacon",
			)
		await expect(beaconRows()).toHaveLength(2)

		const panel = await openSpacesBranch(canvasElement, "Beacon", userEvent)
		const rows = within(panel).getAllByRole("menuitemcheckbox")

		await userEvent.click(rows[1])
		await expect(args.onRemoveBotFromSpace).toHaveBeenCalledWith(
			"beacon",
			"vocca",
		)
		await waitFor(async () => {
			await expect(beaconRows()).toHaveLength(1)
		}, FRAME_POLL)

		await expect(screen.queryByRole("menu")).toBeNull()
		await expect(
			slotIn(canvasElement, "sidebar-content").contains(document.activeElement),
		).toBe(true)
	},
})

export const RowLastSpace = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"The companion that has one space left, walked with the keyboard. Grove sits in Vocca alone: that row is `aria-disabled` rather than switched off, so the arrow walk still lands on it and a reader who cannot see the panel hears which space holds the companion — the one row they most need is the one a native `disabled` would have hidden from them. Landing there announces it ticked and unavailable, Enter and a click both report to nobody, and the next arrow stays inside the panel. The reason is the accessible description of both the `Spaces` entry and the row itself, so it is heard before the branch is opened and again on the row it applies to, however the reader got there. It is read from a node beside the entry in the row menu, exposed but unseen, because the panel it would otherwise live in is inert while the branch is shut and a description cannot be read out of an inert subtree; the note under the rule shows the same sentence to the eye and stays out of the tree. The locked row takes no pointer at all, so resting on it moves neither the focus nor the highlight: an affordance the row cannot honour is worse than none. Beacon, held by two spaces, carries no description: there is nothing to warn about while every row is live.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const menu = await openRowMenu(canvasElement, "Grove")
		const trigger = menu.getByRole("menuitem", { name: SPACES_BRANCH })
		const reason = menu.getByText(LAST_SPACE_NOTE)

		await expect(trigger).toHaveAccessibleName(SPACES_BRANCH)
		await expect(trigger).toHaveAttribute("aria-describedby", reason.id)
		await expect(reason).toBeVisible()
		await expect(reason.closest("[inert]")).toBeNull()
		await expect(reason).not.toHaveAttribute("aria-hidden")

		const panel = await walkIntoSpacesBranch(canvasElement, "Grove", userEvent)
		const rows = within(panel).getAllByRole("menuitemcheckbox")
		const held = rows[1]

		await waitFor(
			() => expect(panel.contains(document.activeElement)).toBe(true),
			FRAME_POLL,
		)

		await userEvent.keyboard("{ArrowDown}")
		await expect(held).toHaveFocus()
		await expect(held).toHaveAttribute("aria-checked", "true")
		await expect(held).toHaveAttribute("aria-disabled", "true")
		await expect(held).toHaveAccessibleDescription(LAST_SPACE_NOTE)

		await userEvent.keyboard("{Enter}")
		fireEvent.click(held)
		await expect(args.onRemoveBotFromSpace).not.toHaveBeenCalled()
		await expect(args.onAddBotToSpace).not.toHaveBeenCalled()
		await expect(panel).toBeVisible()

		await userEvent.keyboard("{ArrowDown}")
		await expect(rows[2]).toHaveFocus()

		await expect(getComputedStyle(held).pointerEvents).toBe("none")
		await expect(rows[2]).toHaveFocus()

		const note = within(panel).getByText(LAST_SPACE_NOTE)
		await expect(note).toBeVisible()
		await expect(note).toHaveAttribute("aria-hidden", "true")
		await expect(within(panel).getAllByRole("separator")).toHaveLength(1)

		await userEvent.keyboard("{Escape}{Escape}")
		await waitFor(async () => {
			await expect(screen.queryByRole("menu")).toBeNull()
		}, FRAME_POLL)

		const shared = await openRowMenu(canvasElement, "Beacon")
		await expect(
			shared.getByRole("menuitem", { name: SPACES_BRANCH }),
		).not.toHaveAccessibleDescription()
	},
})

export const RowSpaceNameTooLong = meta.story({
	args: {
		spaces: WORDY_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"A space named longer than the branch is wide. The name clips on one line with an ellipsis rather than wrapping onto a second or widening the panel past the row menu it hangs off, and the two things that carry the state — the tick slot and the tint dot — keep their full size, so a long name never costs the reader the answer they opened the branch for. The full name stays the row's accessible name, so a reader who cannot see the clip still hears it whole.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		const panel = await openSpacesBranch(canvasElement, "Beacon", userEvent)
		const row = within(panel).getByRole("menuitemcheckbox", {
			name: WORDY_SPACE.name,
		})
		const name = within(row).getByText(WORDY_SPACE.name)
		const dot = name.previousElementSibling as HTMLElement

		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
		await expect(name.getBoundingClientRect().height).toBeLessThanOrEqual(
			Number.parseFloat(getComputedStyle(name).lineHeight) + 1,
		)
		await expect(dot.getBoundingClientRect().width).toBe(10)
		await expect(getComputedStyle(row).paddingInlineEnd).toBe("32px")
	},
})

export const OneSpaceRowMenu = meta.story({
	args: {
		spaces: [SPACES[0]],
		selectedSpaceId: "perso",
		botsBySpaceId: { perso: ROSTER },
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"The same row menu in the account that has only one space. The branch still opens, on the single space the account has, ticked and unavailable with the note under it — an account with one space is the account where every companion is on its last space, so the branch says what it always says rather than vanishing and leaving the reader to guess where their companions live. That single row is the whole walk, and it is unavailable: opening the branch with the keyboard leaves focus on the branch entry, since a list whose only row is unavailable has nothing to hand focus to, and the next arrow walks the row menu it came from rather than dropping focus on the page. The reason is the accessible description of the entry itself, so the reader hears why before deciding to go in. The plain duplicate stays where it is: copying a companion beside itself has nothing to do with spaces. The two rules that fence settings and delete off from the middle stay put whatever the middle holds.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		const menu = await openRowMenu(canvasElement, "Beacon")

		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Settings", "Duplicate", SPACES_BRANCH, "Delete"])
		await expect(menu.getAllByRole("separator")).toHaveLength(2)

		const panel = await walkIntoSpacesBranch(canvasElement, "Beacon", userEvent)
		const branch = screen.getByRole("menuitem", { name: SPACES_BRANCH })
		const rows = within(panel).getAllByRole("menuitemcheckbox")
		await expect(rows.map((row) => row.textContent)).toEqual(["Perso"])
		await expect(rows[0]).toHaveAttribute("aria-disabled", "true")
		await expect(branch).toHaveAttribute("data-popup-open")
		await expect(document.activeElement).toHaveAttribute(
			"data-slot",
			"context-menu-sub-trigger",
		)

		await expect(within(panel).getByText(LAST_SPACE_NOTE)).toBeVisible()

		await userEvent.keyboard("{ArrowDown}")
		await expect(
			screen
				.getByRole("menu", { name: "Actions for Beacon" })
				.contains(document.activeElement),
		).toBe(true)
	},
})

export const NineSpaces = meta.story({
	args: {
		spaces: SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: rostersAcross(SPACES),
		user: READER,
	},
	parameters: {
		a11y: A11Y_FLOATING_FOCUS_GUARDS,
		docs: {
			description: {
				story:
					"Nine spaces each with its own roster, which is as many as the Cmd+digit chords can name and the widest the dot strip ever gets. Check every dot stays inside the pinned region rather than clipping against its edges, that the row draws the space in view and the one waiting off each edge and no more, even with nine spaces to choose from — a reader can never see a third panel, and with the first space open there is only one panel to reach, so the hardest flick lands on the second and no further — that the menu lists all nine with `⌘1` through `⌘9`, that Cmd+9 reaches the last one, and that a swipe back while the first space is open reports nothing and holds the row still. Pick `FiveSpaces` for the everyday width, `OneSpace` for the row that cannot travel.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const dots = spaceDotsIn(canvasElement)
		await expect(dots).toHaveLength(9)

		const region = slotIn(
			canvasElement,
			"sidebar-footer",
		).getBoundingClientRect()
		for (const dot of dots) {
			const box = dot.getBoundingClientRect()
			await expect(box.left).toBeGreaterThanOrEqual(region.left)
			await expect(box.right).toBeLessThanOrEqual(region.right)
		}

		const menu = await openSpaceMenu(
			canvas.getByRole("button", { name: /^Change space/ }),
		)
		await expect(menu.getAllByRole("menuitemradio")).toHaveLength(9)
		await expect(menu.getByText("⌘9")).toBeInTheDocument()
		await userEvent.keyboard("{Escape}")

		await userEvent.keyboard("{Meta>}9{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("essais")

		const carousel = carouselIn(canvasElement)
		const panels = panelsIn(canvasElement)
		await expect(panels).toHaveLength(2)
		await expect(carousel.scrollWidth).toBe(carousel.clientWidth * 2)
		const viewport = carousel.getBoundingClientRect()
		await expect(leftOf(panels[0])).toBeCloseTo(viewport.left, 0)
		await expect(leftOf(panels[1])).toBeCloseTo(viewport.right, 0)

		await swipeBeside(carousel, -1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(leftOf(panels[0])).toBeCloseTo(viewport.left, 0)
	},
})

export const SpaceBadges = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: FIVE_ROSTERS,
		badgesBySpaceId: { perso: "done", atelier: "attention", veille: "failed" },
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Three spaces the reader is not in, each with a companion that has something to say. Check each dot in the strip keeps its space's tint and takes the badge as a ring around it, that the spaces with nothing are drawn exactly as they are without badges, and that the switcher takes a single mark for the strongest of the three — attention here — so a reader looking at one roster still knows another one wants them. Pick `FiveSpaces` for the same strip with nothing waiting, `Badges` for the marks on the rows inside a space.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const dots = spaceDotsIn(canvasElement).map(
			(button) => slotsIn(button, "space-dot")[0]?.dataset.badge,
		)
		await expect(dots).toEqual([
			"done",
			undefined,
			"attention",
			"failed",
			undefined,
		])

		const trigger = canvas.getByRole("button", {
			name: "Change space, Vocca open",
		})
		await expect(
			slotsIn(trigger, "space-switcher-badge")[0]?.dataset.badge,
		).toBe("attention")
	},
})

export const MissionSpaceRing = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: {
			...FIVE_ROSTERS,
			perso: [{ ...ROSTER[0], missions: [missionOf("working", 0)] }],
			atelier: [{ ...ROSTER[1], missions: [missionOf("waiting", 1)] }],
		},
		badgesBySpaceId: { atelier: "attention" },
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Two spaces the reader is not in, each with a companion on a mission, and only one of them lit. The space whose mission waits on a person takes the attention ring; the space whose mission is simply running stays exactly as a space with nothing to say, because a companion at work is not news. Check the switcher above the roster repeats the lit mark and only that one, so a reader deep in one space learns another is blocked on them without being pulled by every mission in the app. Check no companion row anywhere carries a mission badge on its preview line: the ring is derived from the missions, not from a dot written onto a row. Pick `SpaceBadges` for the rings a chat lights, `MissionStripStates` for what the mission puts on a row.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const dots = spaceDotsIn(canvasElement).map(
			(button) => slotsIn(button, "space-dot")[0]?.dataset.badge,
		)
		await expect(dots).toEqual([
			undefined,
			undefined,
			"attention",
			undefined,
			undefined,
		])

		const trigger = canvas.getByRole("button", {
			name: "Change space, Vocca open",
		})
		await expect(
			slotsIn(trigger, "space-switcher-badge")[0]?.dataset.badge,
		).toBe("attention")

		await expect(slotsIn(canvasElement, "bot-activity-dot")).toHaveLength(0)
	},
})

export const SpacesOnRail = meta.story({
	render: renderShell(false),
	args: {
		spaces: SPACES.slice(0, 5),
		selectedSpaceId: "vocca",
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same navigation once the panel is on its icon rail. Check the switcher keeps the open space's tint as a dot and drops its name, that it and the create button sit side by side without clipping against either edge of the rail, and that the dot strip is gone — a rail is too narrow to hold nine targets, and the tint on the switcher already says where the reader is. Pick `FiveSpaces` for the expanded panel.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = slotIn(canvasElement, "sidebar-container")
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const switcher = canvas.getByRole("button", {
			name: "Change space, Vocca open",
		})
		await expect(
			slotIn(switcher, "space-switcher-name").checkVisibility(),
		).toBe(false)
		await expect(slotIn(switcher, "space-dot").checkVisibility()).toBe(true)

		const panelBox = panel.getBoundingClientRect()
		for (const control of [
			switcher,
			canvas.getByRole("button", { name: "New companion" }),
		]) {
			const box = control.getBoundingClientRect()
			await expect(box.left).toBeGreaterThanOrEqual(panelBox.left)
			await expect(box.right).toBeLessThanOrEqual(panelBox.right)
		}

		await expect(
			slotsIn(canvasElement, "space-dots")[0]?.checkVisibility(),
		).toBe(false)
	},
})

export const LiveSpaceSelection = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The panel wired to a host that actually moves its selection, which is the only way the row is honest: landing on a space reports it, the host moves `selectedSpaceId`, and the row must already be where the reader left it rather than scroll itself there a second time. Check a landing reports once and only once, that the space the reader landed on is the one the header names, that the row stays put afterwards instead of bouncing, and that a rank chord scrolls the row to that space and reports it once, however many re-renders came before. Pick `FiveSpaces` for the same navigation against a fixed selection, `SpaceScrolling` for the snapping the row is built on.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const carousel = carouselIn(canvasElement)

		await swipeBeside(carousel, 1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(
			canvas.getByRole("button", { name: "Change space, Vocca open" }),
		).toBeVisible()

		await swipeBeside(carousel, 1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(
			canvas.getByRole("button", { name: "Change space, Atelier open" }),
		).toBeVisible()

		await expect(slotShown(carousel)).toBe(1)

		await userEvent.keyboard("{Meta>}5{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(3)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("archives")

		await waitFor(async () => {
			await expect(panelsIn(canvasElement)).toHaveLength(2)
		}, FRAME_POLL)
		await expect(slotShown(carousel)).toBe(1)
		await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
			carousel.getBoundingClientRect().left,
			0,
		)
	},
})

export const SpaceScrolling = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The row itself, which is one scrolling box a panel wide with a roster in each panel — the swipe is the reader scrolling it sideways, so the trackpad tracks their fingers, coasts, rubber-bands at the ends and magnetises on release the way it does in every native window, none of it ours to write. Check the contract that gets that for free: the box snaps on the x axis and snaps hard, every panel is exactly the width of the box, and the box holds the space in view and the one waiting off each edge and no more. That last one is what holds a flick to one space, and it holds it the only way a browser cannot argue with — there is nowhere further to scroll. `scroll-snap-stop: always` says the same thing and no engine honours it for a swipe, so the row is three panels wide and the reach of a gesture is the width of the row. Check too that a panel is its own scrolling box, so a reader coming back to a space finds it where they left it — and that it holds only its own axis: a panel that keeps a sideways gesture to itself is a panel the row can never be swiped out of, since the innermost box a gesture lands in is the one that answers it. Check that a space is reported as soon as its panel covers the larger half of the row, mid-gesture and once per crossing, so the switch never waits on the fingers to leave the glass. Check it is reported once, and that a host which does not follow gets its row back: the space in view is the host's to say, so a row left on a space the host never opened walks back to the one it did. Pick `LiveSpaceSelection` for the row against a host that moves its selection, `SpaceScrollMemory` for a space walked past and come back to.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const carousel = carouselIn(canvasElement)
		const panels = panelsIn(canvasElement)
		await expect(panels).toHaveLength(3)

		const box = getComputedStyle(carousel)
		await expect(box.scrollSnapType).toBe("x mandatory")
		await expect(box.overflowX).toBe("auto")
		await expect(carousel.scrollWidth).toBe(carousel.clientWidth * 3)

		for (const panel of panels) {
			const style = getComputedStyle(panel)
			await expect(style.scrollSnapAlign).toBe("start")
			await expect(style.scrollSnapStop).toBe("always")
			await expect(hasOverlayScrollbars(panel)).toBe(true)
			await expect(style.scrollbarWidth).toBe("none")
			await expect(panel.clientWidth).toBe(panel.offsetWidth)
			await expect(style.paddingLeft).toBe(style.paddingRight)
			await expect(style.overscrollBehaviorY).toBe("contain")
			await expect(style.overscrollBehaviorX).toBe("auto")
			await expect(panel.offsetWidth).toBe(carousel.clientWidth)
		}

		const still = [
			leftOf(slotIn(canvasElement, "space-switcher-name")),
			leftOf(slotIn(canvasElement, "space-dots")),
		]

		await swipeBeside(carousel, 1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("atelier")
		await expect([
			leftOf(slotIn(canvasElement, "space-switcher-name")),
			leftOf(slotIn(canvasElement, "space-dots")),
		]).toEqual(still)

		await expect(panelsIn(canvasElement)).toHaveLength(3)
		await expect(carousel.scrollWidth).toBe(carousel.clientWidth * 3)
		await expect(slotShown(carousel)).toBe(1)

		await swipeBeside(carousel, -1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("vocca")
	},
})

export const SpaceLanding = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Every space walked one at a time, first to last and back, against a host that follows. The row draws the space in view and the one waiting off each edge, so the drawn window slides by one panel on every landing and the space in view keeps the same slot in it — which is exactly how a landing can be reported and then quietly slid off, leaving the reader on the space one further along the way they swiped, or slid back with a second animated switch replaying under them. Check it the only way that catches either: each step is taken from the panel the host reports rather than from the slot the row happens to sit on, and each landing is measured absolutely — the reported panel flush with the left edge of the row. That flush edge is also what leaves the row still, since a row already on the space the host has open has nowhere left to slide to. Check too that the walk names every space once and in order, none skipped and none doubled. Pick `LiveSpaceSelection` for a landing reported once and a chord slid to, `SpaceScrolling` for the snapping underneath.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const carousel = carouselIn(canvasElement)
		const walked = FIVE_SPACES.map((space) => space.id)

		const walk = async (step: number, expected: string[]) => {
			for (const id of expected) {
				await swipeBeside(carousel, step)
				await expect(args.onSelectSpace).toHaveBeenLastCalledWith(id)
				await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
					leftOf(carousel),
					0,
				)
			}
		}

		await walk(1, walked.slice(1))
		await walk(-1, walked.slice(0, -1).reverse())

		await expect(args.onSelectSpace).toHaveBeenCalledTimes(
			(walked.length - 1) * 2,
		)
	},
})

export const SpaceFlickMomentum = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A trackpad flick, which a browser reports as two scrolls rather than one: the fingers leave the glass and the scroll ends there, then the momentum they left carries the row on and ends a second time. Waiting on that second end is waiting on inertia to die under a panel that filled the row a second ago, so what makes a space the reader's is neither the row being still nor the panel being flush — it is the panel covering the larger half of the row. Cross half and the space is theirs, fingers still down. Check the crossing is the whole rule: carried short of half a panel it reports nothing and stays where it stopped, carried past half it reports the space at once and still stays where it stopped, same drawn window, same offset — the row is never slid out from under a live gesture, the drawn window follows only on the rest. Check it reports once per crossing and not once per frame: carried on to nine tenths of a panel, the larger half unchanged, it says nothing further. Check the rest adds nothing, the row settling flush on the space already reported, and that a rank chord still slides the row from there. Pick `SpaceScrolling` for the snapping the flick rides on, `SpaceLanding` for the walk from panel to panel, `SpaceSwipeTakenBack` for a crossing made and then made back.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const carousel = carouselIn(canvasElement)
		const panel = carousel.clientWidth

		await carryTo(carousel, 0.4)
		await expect(args.onSelectSpace).not.toHaveBeenCalled()
		await expect(carousel.scrollLeft).toBeCloseTo(0.4 * panel, 0)
		await expect(panelsIn(canvasElement)).toHaveLength(2)

		await carryTo(carousel, 0.6)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("vocca")
		await expect(Math.round(carousel.scrollLeft)).toBe(Math.round(0.6 * panel))
		await expect(panelsIn(canvasElement)).toHaveLength(2)

		await carryTo(carousel, 0.9)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(Math.round(carousel.scrollLeft)).toBe(Math.round(0.9 * panel))

		await settleFlush(carousel)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(panelsIn(canvasElement)).toHaveLength(3)
		await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
			leftOf(carousel),
			0,
		)

		await userEvent.keyboard("{Meta>}3{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("atelier")
		await waitFor(async () => {
			await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
				leftOf(carousel),
				0,
			)
		}, FRAME_POLL)
	},
})

export const SpaceBoundaryWobble = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A slow scroll parked on the boundary, which is where reporting on the larger half falls apart if the half is read literally: a trackpad dragged gently sits at half a panel and trembles there for as long as the reader holds it, and a row that reads each tremor swings the selection between two spaces several times a second, re-rendering the panels inside the scroll frame and catching the row under the fingers. So a crossing is not half, it is half and a little past — the space keeps the reader until the row is clear of the boundary, and it takes the same margin again to give them back. Check the tremor is silent: parked exactly on half it reports nothing, carried clear it reports the next space once, and dithering back and forth across the boundary from there reports nothing further. Check the reader can still change their mind: carried clear the other way, the space they came from is reported, once. Check nothing of this moves the row — every stop is where it was put — and that the rest is silent too. Pick `SpaceFlickMomentum` for the crossing at speed, `SpaceSwipeTakenBack` for the swipe made and unmade.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const carousel = carouselIn(canvasElement)
		const panel = carousel.clientWidth

		await carryTo(carousel, 0.5)
		await expect(args.onSelectSpace).not.toHaveBeenCalled()
		await expect(Math.abs(carousel.scrollLeft - 0.5 * panel)).toBeLessThan(1)

		await carryTo(carousel, 0.6)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("vocca")

		await carryTo(carousel, 0.52)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)

		await carryTo(carousel, 0.58)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(Math.abs(carousel.scrollLeft - 0.58 * panel)).toBeLessThan(1)

		await carryTo(carousel, 0.4)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("perso")

		await settleFlush(carousel)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
			leftOf(carousel),
			0,
		)
	},
})

export const SpaceSwipeTakenBack = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: FIVE_ROSTERS,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"A swipe the reader thinks better of: the row is dragged past half a panel, far enough that the next space covers more of the row than the one they are in, and then dragged back and let go where it started. Both crossings count, and that is the point — the way back is as live as the way out, so a reader who changes their mind mid-swipe is handed the space they came from there and then rather than held in one they only half entered until the row settles. Check the pair reports twice, the next space on the way out and the original on the way back, and that the rest adds nothing to it: the reader is left exactly where they began, the space in view the one the host had open, the row flush on it. Check the row is honest again straight after: swiped on and let go flush, it reports the new space once. Pick `SpaceFlickMomentum` for the crossing that stands, `SpaceLanding` for the walk across every space.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement }) => {
		const carousel = carouselIn(canvasElement)

		await carryTo(carousel, 0.6)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(1)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("vocca")

		await carryTo(carousel, 0.2)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("perso")

		await settleFlush(carousel)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(2)
		await expect(
			canvas.getByRole("button", { name: "Change space, Perso open" }),
		).toBeVisible()
		await expect(leftOf(panelInView(canvasElement))).toBeCloseTo(
			leftOf(carousel),
			0,
		)

		await swipeBeside(carousel, 1)
		await expect(args.onSelectSpace).toHaveBeenCalledTimes(3)
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("vocca")
	},
})

export const SpaceSwitchingOff = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: FIVE_ROSTERS,
		isSpaceSwitchingEnabled: false,
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same panel with space switching turned off, which is how a host holds the reader still while a dialog or a running turn owns the screen. Check the row is not the reader's to scroll at all — the box refuses the gesture itself rather than answering it and thinking better of it — that the meta-digit chord reports nothing and is left unprevented so whatever else the app binds to it still hears it, and that the dot strip and the switcher menu keep working — a deliberate press is never the thing being guarded against. Pick `FiveSpaces` for the same panel with switching on.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const carousel = carouselIn(canvasElement)

		await expect(getComputedStyle(carousel).overflowX).toBe("hidden")
		await expect(args.onSelectSpace).not.toHaveBeenCalled()

		let prevented = true
		const watch = (event: KeyboardEvent) => {
			prevented = event.defaultPrevented
		}
		window.addEventListener("keydown", watch)
		await userEvent.keyboard("{Meta>}4{/Meta}")
		window.removeEventListener("keydown", watch)
		await expect(args.onSelectSpace).not.toHaveBeenCalled()
		await expect(prevented).toBe(false)

		await userEvent.click(spaceDotsIn(canvasElement)[3])
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("veille")
	},
})

export const SpacesWithoutRosters = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		user: READER,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Five spaces and no roster handed over per space, which is every host that has not wired `botsBySpaceId` yet. Check the row is not drawn at all — one list, scrolling in the content region as it did before the carousel existed — that it does not scroll sideways at all, because a row towards panels a host never filled would be a promise the sidebar cannot keep, and that the dots and the meta-digit chord still change space. Pick `FiveSpaces` for the same five spaces once their rosters arrive.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(slotsIn(canvasElement, "space-carousel")).toHaveLength(0)
		await expect(rowsIn(canvasElement)).toHaveLength(ROSTER.length)

		const content = slotIn(canvasElement, "sidebar-content")
		await expect(getComputedStyle(content).overflowY).toBe("auto")

		await expect(content.scrollWidth).toBe(content.clientWidth)
		await expect(args.onSelectSpace).not.toHaveBeenCalled()

		await userEvent.click(spaceDotsIn(canvasElement)[3])
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("veille")

		await userEvent.keyboard("{Meta>}1{/Meta}")
		await expect(args.onSelectSpace).toHaveBeenLastCalledWith("perso")

		await expect(
			canvas.getByRole("button", { name: "Change space, Vocca open" }),
		).toBeVisible()
	},
})

export const SpaceScrollMemory = meta.story({
	render: (args) => <LiveSpaces {...args} />,
	globals: { viewport: { value: "short" } },
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "perso",
		botsBySpaceId: Object.fromEntries(
			FIVE_SPACES.map((space) => [space.id, ROSTER]),
		),
		user: READER,
	},
	parameters: {
		viewport: { options: SHORT_VIEWPORT },
		docs: {
			description: {
				story:
					"A window too short to show a roster whole, which is where a space has to remember where its reader had got to — and the only shape in which a panel is a scrolling box at all, so it is also where a panel could swallow the sideways gesture meant for the row. Only the space in view and the one waiting off each edge are drawn, so a space walked two along leaves the row entirely — check that scrolling one space down, walking two spaces on and walking back finds it exactly where it was left rather than back at the top, and that a space arriving starts at its own top rather than inheriting the scroll of the one before it. Pick `SpaceScrolling` for the gesture itself, `NineSpaces` for the row at its widest.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const carousel = carouselIn(canvasElement)
		const left = panelInView(canvasElement)
		await expect(left.scrollHeight).toBeGreaterThan(left.clientHeight)
		await expect(getComputedStyle(left).overscrollBehaviorX).toBe("auto")

		left.scrollTop = 90
		await nextTask()
		await expect(left.scrollTop).toBe(90)

		await swipeBeside(carousel, 1)
		await expect(panelInView(canvasElement).scrollTop).toBe(0)

		await swipeBeside(carousel, 1)
		await expect(panelsIn(canvasElement)).toHaveLength(3)

		await swipeBeside(carousel, -1)
		await swipeBeside(carousel, -1)
		await waitFor(async () => {
			await expect(panelInView(canvasElement).scrollTop).toBe(90)
		}, FRAME_POLL)
	},
})

const HEADER_HEIGHT = 48

const WINDOW_CONTROLS_RESERVE = 78

const WINDOW_CONTROLS_END = 69.5

const WINDOW_CONTROLS_LEADING_INSET = 17.5

const SPACE_NAME_START = WINDOW_CONTROLS_END + WINDOW_CONTROLS_LEADING_INSET

const HEADER_PADDING = 10

const headerIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "sidebar-header")

const RESERVE_ARGS = {
	spaces: FIVE_SPACES,
	selectedSpaceId: FIVE_SPACES[0].id,
	botsBySpaceId: FIVE_ROSTERS,
}

export const WindowControlsReserved = meta.story({
	args: { ...RESERVE_ARGS, insetWindowControls: true },
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this in a desktop window whose title bar is transparent, so the OS paints its close/minimise/zoom buttons over the top of this panel. Check that the header holds a gutter wide enough that the space switcher and the create button both start past those buttons, that the space name reads as far from the last button as the first button is from the window edge, and that the list below is untouched — the reserve is owed by the header alone. The gutter is measured to the first glyph of the name, not to the switcher's box, so it subtracts the padding the switcher already carries. Pick `NoWindowControlsReserve` in a browser tab or on a host that draws its own title bar, `WindowControlsReservedOnRail` for the same window with the panel collapsed.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const header = headerIn(canvasElement)
		await expect(getComputedStyle(header).paddingLeft).toBe(
			`${WINDOW_CONTROLS_RESERVE}px`,
		)

		const headerStart = header.getBoundingClientRect().left
		const controls = within(header).getAllByRole("button")
		await expect(controls.length).toBeGreaterThan(1)
		for (const control of controls) {
			await expect(
				control.getBoundingClientRect().left - headerStart,
			).toBeGreaterThanOrEqual(WINDOW_CONTROLS_END)
		}

		const name = slotIn(header, "space-switcher-name")
		await expect(name.getBoundingClientRect().left - headerStart).toBeCloseTo(
			SPACE_NAME_START,
			0,
		)
	},
})

export const NoWindowControlsReserve = meta.story({
	args: RESERVE_ARGS,
	parameters: {
		docs: {
			description: {
				story:
					"The same panel where nothing is owed: a browser tab, or a Windows or Linux window whose system title bar sits above the web view rather than over it. Check that the header opens on the same narrow gutter as every other row in the panel, so the space switcher starts at the leading edge instead of a third of the way in. Pick `WindowControlsReserved` for the macOS window.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const header = headerIn(canvasElement)
		await expect(getComputedStyle(header).paddingLeft).toBe(
			`${HEADER_PADDING}px`,
		)
		await expect(
			slotIn(header, "space-switcher").getBoundingClientRect().left -
				header.getBoundingClientRect().left,
		).toBeLessThan(WINDOW_CONTROLS_END)
	},
})

export const WindowControlsReservedOnRail = meta.story({
	args: { ...RESERVE_ARGS, insetWindowControls: true },
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The reserved header on the icon rail, which is narrower than the window controls are wide — there is no room left of them to put anything, so the header keeps its height and gives up its contents rather than parking the switcher under a button the reader cannot see through. Check that the rail header holds no control at all, that it is gone from the accessibility tree rather than merely faded, and that the first row still starts below it. Pick `Collapsed` for the same rail with nothing owed.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(
				railWidth(),
				0,
			)
		}, FRAME_POLL)

		const header = headerIn(canvasElement)
		await expect(within(header).queryAllByRole("button")).toHaveLength(0)
		await expect(header.getBoundingClientRect().height).toBe(HEADER_HEIGHT)
		await expect(
			rowsIn(canvasElement)[0].getBoundingClientRect().top,
		).toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom)
	},
})

const SECTIONS: AppSidebarSection[] = [
	{ id: "research", name: "Research", position: 0 },
	{ id: "shipping", name: "Shipping", position: 3 },
	{ id: "archive", name: "Archive", position: 6 },
]

const PLACEMENTS: Record<string, [string, number] | null> = {
	atlas: null,
	beacon: ["research", 1],
	cinder: null,
	dune: ["shipping", 4],
	ember: ["research", 2],
	flint: ["shipping", 5],
}

const SECTIONED_ROSTER: AppSidebarBot[] = ROSTER.slice(0, 6).map((bot) => ({
	...bot,
	sectionId: PLACEMENTS[bot.id]?.[0] ?? null,
	pinPosition: PLACEMENTS[bot.id]?.[1] ?? null,
}))

const GROUPED_ORDER = ["Beacon", "Ember", "Dune", "Flint", "Atlas", "Cinder"]

const PINNED_NOW: [string, string | null][] = [
	["research", null],
	["beacon", "research"],
	["ember", "research"],
	["shipping", null],
	["dune", "shipping"],
	["flint", "shipping"],
	["archive", null],
]

const pinsFor = (order: [string, string | null][]) =>
	order.map(([id, sectionId]) => ({ id, sectionId }))

const HOME = "personal"

const sectionArgs = () => ({
	bots: SECTIONED_ROSTER,
	sections: SECTIONS,
	selectedBotId: "beacon",
	selectedSpaceId: HOME,
	onCreateSection: fn(),
	onRenameSection: fn(),
	onDeleteSection: fn(),
	onCollapseSection: fn(),
	onPinRoster: fn(),
})

const LiveSections = (args: AppSidebarProps) => {
	const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([])

	return (
		<WorkspaceShell
			defaultOpen
			sidebar={
				<AppSidebar
					{...args}
					collapsedSectionIds={collapsedSectionIds}
					onCollapseSection={(id, isCollapsed) => {
						args.onCollapseSection?.(id, isCollapsed)
						setCollapsedSectionIds((held) =>
							isCollapsed
								? [...held, id]
								: held.filter((collapsed) => collapsed !== id),
						)
					}}
				/>
			}
		>
			{null}
		</WorkspaceShell>
	)
}

const rowNames = (canvasElement: HTMLElement) =>
	rowsIn(canvasElement).map(
		(row) => slotIn(row, "roster-row-name").textContent ?? "",
	)

const inACard = (row: HTMLElement) =>
	Boolean(row.closest('[data-slot="sidebar-group"]'))

const cardRows = (canvasElement: HTMLElement) =>
	rowsIn(canvasElement).filter(inACard)

const looseRows = (canvasElement: HTMLElement) =>
	rowsIn(canvasElement).filter((row) => !inACard(row))

const sectionHeadersIn = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="roster-section-name"]',
		),
	)

const sectionNames = (canvasElement: HTMLElement) =>
	sectionHeadersIn(canvasElement).map((name) => name.textContent ?? "")

const sectionHeader = (canvasElement: HTMLElement, name: string) => {
	const header = sectionHeadersIn(canvasElement).find(
		(node) => node.textContent === name,
	)?.parentElement
	if (!header) throw new Error(`No section header named ${name}`)
	return header
}

const openSectionMenu = async (canvasElement: HTMLElement, name: string) => {
	fireEvent.contextMenu(sectionHeader(canvasElement, name))
	return within(
		await shown(
			await screen.findByRole("menu", {
				name: `Actions for the ${name} section`,
			}),
		),
	)
}

const sectionCard = (canvasElement: HTMLElement, name: string) => {
	const card = sectionHeader(canvasElement, name).closest<HTMLElement>(
		'[data-slot="sidebar-group"]',
	)
	if (!card) throw new Error(`No section card around ${name}`)
	return card
}

const chevronOf = (canvasElement: HTMLElement, name: string) => {
	const chevron = sectionHeader(canvasElement, name).querySelector("svg")
	if (!chevron) throw new Error(`No chevron on the ${name} header`)
	return chevron
}

const sectionField = (canvasElement: HTMLElement) => {
	const field = canvasElement.querySelector<HTMLInputElement>(
		'[data-slot="roster-section-field"]',
	)
	if (!field) throw new Error("Nothing here draws a section field")
	return field
}

const MOVE_TO = "Move to section"

const NEW_SECTION = "New section"

const openMoveToBranch = async (
	canvasElement: HTMLElement,
	bot: string,
	userEvent: Gestures,
) => {
	const menu = await openRowMenu(canvasElement, bot)
	await userEvent.hover(menu.getByRole("menuitem", { name: MOVE_TO }))
	const panel = await settled(
		await screen.findByRole("menu", { name: MOVE_TO }),
	)
	await crossSafePolygon(panel)
	return within(panel)
}

const startRename = async (
	canvasElement: HTMLElement,
	name: string,
	userEvent: Gestures,
) => {
	const menu = await openSectionMenu(canvasElement, name)
	await userEvent.click(menu.getByRole("menuitem", { name: "Rename" }))
	return sectionField(canvasElement)
}

const typeOf = (node: HTMLElement) => {
	const style = getComputedStyle(node)
	return {
		fontFamily: style.fontFamily,
		fontSize: style.fontSize,
		fontWeight: style.fontWeight,
		letterSpacing: style.letterSpacing,
		textTransform: style.textTransform,
	}
}

export const Sections = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"The roster carved into sections. The companions holding no section come first, on the bare panel under no header at all and in the order they arrived, so an account that never made a section reads exactly as `Roster` does. Each section follows in the order the host gave, drawn as a rounded card holding its header and its rows together — the card is a translucent wash over the sidebar, never an opaque fill, so the tint the space gives the panel reads straight through it. The header carries the name in semibold, heavier than any companion's, and it is a disclosure: it opens and shuts the group under it, and a chevron sits one gap after the name, travelling with it rather than parked against the far edge. The actions that rename, reorder and delete the section live behind a right-click on the header, exactly as a row\u2019s actions do, so the plain click is never spent on a menu. Check the rows keep one column down the whole panel whatever section they sit in — a header must never indent the companions under it — that every row is still one stop and one button, and that the headers are stops of their own between the groups they open. Pick `SectionCollapse` for the disclosure, `EmptySection` for a section nothing has been filed into yet, `MoveBotToSection` for the branch that files a companion.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)
		await expect(sectionNames(canvasElement)).toEqual([
			"Research",
			"Shipping",
			"Archive",
		])

		await expectAlignedRows(cardRows(canvasElement))
		await expectAlignedRows(looseRows(canvasElement))

		const research = sectionHeader(canvasElement, "Research")
		await expect(research).toHaveAttribute("aria-expanded", "true")
		await expect(research.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			rowFor(canvasElement, "Beacon").getBoundingClientRect().top,
		)
		await expect(research.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			rowFor(canvasElement, "Cinder").getBoundingClientRect().top,
		)
	},
})

export const MissionStripPinned = meta.story({
	args: {
		...sectionArgs(),
		bots: SECTIONED_ROSTER.map((bot) =>
			bot.id === "ember"
				? { ...bot, missions: [missionOf("waiting", 0)] }
				: bot,
		),
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A sectioned roster where the second row of Research carries a mission waiting on its reader. Check the section renders in the order the reader pinned it and the waiting row stays second: a rank a person set by hand is not a guess the panel may improve on, so a mission never reorders a section any more than it reorders the pinned zone. Check the row still wears its strip in the waiting state, so the news reaches the reader through the strip where the order will not carry it. Pick `MissionStripRaised` for the zone where the waiting row does move up, `Sections` for the same roster with no mission in it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)
		await expect(stripStatesIn(rowFor(canvasElement, "Ember"))).toEqual([
			"waiting",
		])
	},
})

export const EmptySection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"A section nothing has been filed into. It is drawn, not hidden: the header stays where the host put it and a dashed zone under it stands in for the rows that are not there yet. The zone wears a faded companion of its own, drawn from the section\u2019s name so it is the same companion every time that section is empty rather than a new face on every render — it is at rest and never animates, since a placeholder that moves competes with the companions that are actually working. It is decoration and is kept out of the accessibility tree; the invitation beside it is what a reader hears. Check it is drawn under the Archive header, that no row is drawn with it, and that it goes with the headers on the icon rail, where there is nothing to drop onto.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const invitation = canvas.getByText("Drop a companion here")
		await expect(invitation).toBeVisible()

		const zone = slotIn(canvasElement, "roster-section-drop")
		const placeholder = zone.querySelector("svg")
		await expect(placeholder?.closest("[aria-hidden='true']")).not.toBeNull()
		await expect(placeholder).toHaveAttribute(
			"aria-label",
			expect.stringMatching(/^Companion avatar \w+, (?!idle)\w+$/),
		)
		await expect(getComputedStyle(zone).color).toBe(
			tokenColor(canvasElement, "--muted-foreground"),
		)
		await expect(
			sectionHeader(canvasElement, "Archive").getBoundingClientRect().bottom,
		).toBeLessThanOrEqual(invitation.getBoundingClientRect().top)
		await expect(rowsIn(canvasElement)).toHaveLength(GROUPED_ORDER.length)
	},
})

export const SectionCollapse = meta.story({
	args: sectionArgs(),
	render: (args) => <LiveSections {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"The header as a disclosure. A plain click shuts the group under it and another opens it back, the card shrinking away with the rows it holds as one movement, the chevron turning from right to down to say which way it stands, and `aria-expanded` saying the same thing to a reader — Enter and Space do it too, since the header is a real button. Which sections stand shut is the host's to hold: the header reports the section and whether it is now collapsed through `onCollapseSection`, and draws itself from the `collapsedSectionIds` it is given back, so the reader finds their panel as they left it after a space switch or a restart. Shutting a section never touches the sections around it. The rows of a shut section stay in the markup rather than being torn out, so the rail still lists every companion when the panel itself is collapsed and no header is left to reopen anything. Check both directions, that the companions of the other sections hold their place, and that the chevron turn is dropped under `prefers-reduced-motion`. Pick `SectionRename` for what a right-click on the same header offers.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const header = sectionHeader(canvasElement, "Research")
		await expect(header).toHaveAttribute("aria-expanded", "true")
		await expect(rowFor(canvasElement, "Beacon")).toBeVisible()

		await userEvent.click(header)
		await expect(header).toHaveAttribute("aria-expanded", "false")
		await expect(rowFor(canvasElement, "Beacon")).not.toBeVisible()
		await expect(rowFor(canvasElement, "Ember")).not.toBeVisible()
		await expect(rowFor(canvasElement, "Dune")).toBeVisible()
		await expect(rowFor(canvasElement, "Atlas")).toBeVisible()
		await expect(sectionNames(canvasElement)).toEqual([
			"Research",
			"Shipping",
			"Archive",
		])

		await expect(header).toHaveFocus()
		await userEvent.keyboard("{Enter}")
		await expect(header).toHaveAttribute("aria-expanded", "true")
		await expect(rowFor(canvasElement, "Beacon")).toBeVisible()

		await expect(args.onCollapseSection).toHaveBeenNthCalledWith(
			1,
			"research",
			true,
		)
		await expect(args.onCollapseSection).toHaveBeenNthCalledWith(
			2,
			"research",
			false,
		)
		await expect(args.onPinRoster).not.toHaveBeenCalled()
		await expect(args.onDeleteSection).not.toHaveBeenCalled()
	},
})

export const SectionCard = meta.story({
	args: sectionArgs(),
	render: (args) => <LiveSections {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"What an open section is drawn as. Header and rows are held in one rounded card, so a section reads as a single object the eye can take in rather than a title with a list loose beneath it. The card is a wash laid over the panel and never a colour of its own — a sister branch tints the sidebar with the colour of the space on screen, and that tint has to survive under every card. Its rows sit on the card's own gutter, half a step in from the companions filed under no section, so the wash and that hair of an inset say together that a row is held by something without either of them shouting it. Shut the section and the card goes with the rows it held — a closed section is a bare title line on the panel, with no surface and no border left behind. The name carries the section on weight alone — semibold where a companion's name is medium, at the same size, so the header leads the card without shouting over the rows it holds — and the chevron travels one gap behind it instead of sitting against the far edge. Check the open card is painted and holds its rows, that the loose companions sit on no card at all, and that shutting Research strips the surface. Pick `SectionCollapse` for the movement between the two, `DragBotToSection` for the card under a lifted companion.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		const research = sectionCard(canvasElement, "Research")
		await expect(isLightened(research)).toBe(true)

		const beacon = rowFor(canvasElement, "Beacon").getBoundingClientRect()
		const card = research.getBoundingClientRect()
		await expect(card.top).toBeLessThanOrEqual(beacon.top)
		await expect(card.bottom).toBeGreaterThanOrEqual(beacon.bottom)
		await expect(
			rowFor(canvasElement, "Cinder").closest('[data-slot="sidebar-group"]'),
		).toBeNull()

		const heading = typeOf(sectionHeader(canvasElement, "Research"))
		const row = typeOf(
			slotIn(rowFor(canvasElement, "Beacon"), "roster-row-name"),
		)
		await expect(Number(heading.fontWeight)).toBeGreaterThan(
			Number(row.fontWeight),
		)

		const name = sectionHeadersIn(canvasElement)[0].getBoundingClientRect()
		const chevron = chevronOf(canvasElement, "Research").getBoundingClientRect()
		await expect(chevron.left - name.right).toBeLessThanOrEqual(8)
		await expect(card.right - chevron.right).toBeGreaterThan(16)

		const header = sectionHeader(canvasElement, "Research")
		await userEvent.click(header)
		await expect(header).toHaveAttribute("aria-expanded", "false")
		await userEvent.unhover(header)
		await waitFor(() => expect(isLightened(research)).toBe(false), FRAME_POLL)
	},
})

export const SectionHeaderHover = meta.story({
	args: sectionArgs(),
	render: (args) => <LiveSections {...args} />,
	parameters: {
		pseudo: {
			hover:
				'[data-slot="roster-drop-area"] > [data-slot="roster-drop-area"]:first-of-type [data-slot="roster-section-trigger"]',
		},
		docs: {
			description: {
				story:
					"The header under the pointer. It grows no pill of its own: pointing at it deepens the wash of the whole card instead, so what lights up is exactly what the click acts on — the section and every row it holds, opening or shutting as one object. A pill drawn around the name alone would promise a smaller target than the header really is and would read as a second row stacked over the companions. Only the card under the pointer answers, the sections either side keep their resting wash, and a companion row hovered inside a card lights the row alone and leaves the card where it was. The keyboard gets the same answer: the header taking focus deepens the card as the pointer does, with the focus ring still drawn on the header so the caret is never lost inside the surface. Pick `SectionCard` for the card at rest, `SectionCollapse` for what the click does.",
			},
		},
	},
})

export const SectionRename = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"Renaming a section where it stands, from the right-click menu on its header. The name does not open a dialogue over the panel and does not grow a boxed field: it simply becomes editable in place, in the same type and at the same spot, with no border and no fill of its own, so the only thing that changes is that there is now a caret in the name. The old name arrives selected, so typing replaces it. Enter confirms and reports the new name. Escape reports nothing and puts the old name back, and so does confirming an empty field: a section is never left nameless by a slip of the keyboard. Check all three, and that the field is named for the section it renames so a screen reader says which one is being typed over.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const headerType = typeOf(sectionHeader(canvasElement, "Research"))

		const field = await startRename(canvasElement, "Research", userEvent)
		await expect(field).toHaveFocus()
		await expect(field).toHaveAccessibleName("Rename Research")
		await expect(field).toHaveValue("Research")
		await expect(typeOf(field)).toEqual(headerType)

		await userEvent.keyboard("Reading{Enter}")
		await expect(args.onRenameSection).toHaveBeenCalledWith(
			"research",
			"Reading",
		)
		await expect(sectionNames(canvasElement)).toContain("Research")

		await startRename(canvasElement, "Shipping", userEvent)
		await userEvent.keyboard("Sent{Escape}")
		await expect(args.onRenameSection).toHaveBeenCalledTimes(1)
		await expect(sectionNames(canvasElement)).toContain("Shipping")

		await userEvent.clear(
			await startRename(canvasElement, "Shipping", userEvent),
		)
		await userEvent.keyboard("{Enter}")
		await expect(args.onRenameSection).toHaveBeenCalledTimes(1)
		await expect(sectionNames(canvasElement)).toContain("Shipping")
	},
})

export const SectionReorder = meta.story({
	args: sectionArgs(),
	parameters: {
		a11y: A11Y_FLOATING_FOCUS_GUARDS,
		docs: {
			description: {
				story:
					"Moving a section up or down the panel. The header reports the whole new order of section ids rather than the one step it took, so a host writes the order it was given and never replays a move. The first section cannot go up and the last cannot go down — those entries are drawn disabled rather than dropped, so the menu keeps the same shape wherever it is opened. Check the two edges and one move in each direction. `DragSectionToPlace` is the same order reported from a drag on the header, and `DragBotToSection` the one that files a companion.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const first = await openSectionMenu(canvasElement, "Research")
		await expect(
			first.getByRole("menuitem", { name: "Move up" }),
		).toHaveAttribute("aria-disabled", "true")
		await userEvent.click(first.getByRole("menuitem", { name: "Move down" }))
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["research", null],
				["beacon", "research"],
				["ember", "research"],
				["archive", null],
			]),
		)

		const last = await openSectionMenu(canvasElement, "Archive")
		await expect(
			last.getByRole("menuitem", { name: "Move down" }),
		).toHaveAttribute("aria-disabled", "true")
		await userEvent.click(last.getByRole("menuitem", { name: "Move up" }))
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["beacon", "research"],
				["ember", "research"],
				["archive", null],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
			]),
		)
	},
})

export const SectionDelete = meta.story({
	args: sectionArgs(),
	parameters: {
		a11y: mergeA11y(
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_FLOATING_FOCUS_GUARDS,
		),
		docs: {
			description: {
				story:
					"Deleting a section from its own header. It reads as destructive, sits last under the reordering entries, and reports only the section — what becomes of the companions filed under it is the host's decision, not this panel's, so nothing is removed here and the panel redraws from the props it is given next. Delete carries `--destructive`, which does not clear AA against a light popup at this size, the same open token question `RowContextMenu` already carries.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const menu = await openSectionMenu(canvasElement, "Shipping")
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Rename", "Move up", "Move down", "Delete"])

		await userEvent.click(menu.getByRole("menuitem", { name: "Delete" }))
		await expect(args.onDeleteSection).toHaveBeenCalledWith("shipping")
		await expect(sectionNames(canvasElement)).toContain("Shipping")
	},
})

export const FullRowMenu = meta.story({
	args: {
		...sectionArgs(),
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: BEACON_IN_TWO_SPACES,
		user: READER,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"Every branch a row can carry, shut, in the account that has sections to file under and spaces to belong to — the only place the middle entries are read side by side. They are ordered by how far they reach: the plain duplicate makes a second companion, the section branch files the companion inside the space it is read in, and the spaces branch says which spaces hold it at all, so the band widens downward and the entry with the longest reach sits nearest delete. The two branches name what they land in and are told apart with both shut: `Move to section` under a folder, `Spaces` under the layers glyph. Pin leads the menu with a rule under it, and the middle stays one band: the other rules are spent under settings and over delete and nowhere else, so a hand aimed anywhere in the middle can never land on delete. Pick `RowSpaces` for the spaces branch opened, `MoveBotToSection` for the section one.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const menu = await openRowMenu(canvasElement, "Beacon")

		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual([
			"Pin",
			"Settings",
			"Duplicate",
			MOVE_TO,
			SPACES_BRANCH,
			"Delete",
		])
		await expect(menu.getAllByRole("separator")).toHaveLength(3)
	},
})

export const MoveBotToSection = meta.story({
	args: sectionArgs(),
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"The branch under a row that files the companion. It sits directly under the plain duplicate, in the same band as it — copying a companion and filing a companion both act inside the space it is read in, so nothing is drawn between them and the branch that says which spaces hold the companion at all comes after; the rules are spent where they matter, one under the leading pin, one under settings and one over delete, so a hand aimed at anything in the middle can never land on delete. It offers every section plus the entry that files it under none, and it marks the one the companion holds now, so the branch reads as where the companion is before it reads as where it could go — Beacon sits in Research here. Choosing one reports the companion and the section, and the entry that clears it reports `null` rather than an empty string, so a host never has to guess what no section means. The branch is only drawn to a host that listens for it: `RowContextMenu` passes no section handlers and keeps the plain actions it always had.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const menu = await openRowMenu(canvasElement, "Beacon")
		const branch = menu.getByRole("menuitem", { name: MOVE_TO })
		await expect(branch).toHaveAttribute("aria-haspopup", "menu")
		await expect(menu.getAllByRole("separator")).toHaveLength(3)

		await userEvent.hover(branch)
		const surface = await shown(
			await screen.findByRole("menu", { name: MOVE_TO }),
		)
		await crossSafePolygon(surface)
		const panel = within(surface)
		const targets = panel.getAllByRole("menuitemradio")
		await expect(targets.map((item) => item.textContent)).toEqual([
			"No section",
			"Research",
			"Shipping",
			"Archive",
		])
		await expect(targets[1]).toHaveAttribute("aria-checked", "true")
		await expect(targets[0]).toHaveAttribute("aria-checked", "false")

		await userEvent.click(targets[2])
		await waitFor(async () => {
			await expect(screen.queryByRole("menu")).toBeNull()
		}, FRAME_POLL)
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["ember", "research"],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["beacon", "shipping"],
				["archive", null],
			]),
		)

		const again = await openMoveToBranch(canvasElement, "Beacon", userEvent)
		await userEvent.click(again.getAllByRole("menuitemradio")[0])
		await expect(args.onPinRoster).toHaveBeenLastCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["ember", "research"],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["archive", null],
			]),
		)
	},
})

export const NewSectionForABot = meta.story({
	args: sectionArgs(),
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"Making a section from the companion that needs it. The last entry under `Move to section` opens a field at the foot of the roster instead of a dialogue, so the reader stays in the panel and names the thing they are about to fill. The section is drawn whole the moment it opens — the companion already filed under it, the field carrying `New section` with the name selected — so the reader sees what they are naming rather than a blank line. The first keystroke replaces the name, and Enter on an untouched field still makes something. Enter reports the name together with the companion it was made for, and the host is the one that creates the section and files the companion — nothing is drawn here until it comes back through the props. Escape and an empty name both close the field and report nothing.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const openNewSection = async () => {
			const branch = await openMoveToBranch(canvasElement, "Atlas", userEvent)
			await userEvent.click(branch.getByRole("menuitem", { name: NEW_SECTION }))
		}

		await openNewSection()

		const field = sectionField(canvasElement)
		await expect(field).toHaveFocus()
		await expect(field).toHaveAccessibleName("New section name")
		await expect(field).toHaveValue(NEW_SECTION)
		await expect(field.selectionStart).toBe(0)
		await expect(field.selectionEnd).toBe(NEW_SECTION.length)
		await expect(rowNames(canvasElement)).toEqual([
			...GROUPED_ORDER.filter((name) => name !== "Atlas"),
			"Atlas",
		])

		await userEvent.keyboard("Reading{Escape}")
		await expect(args.onCreateSection).not.toHaveBeenCalled()
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)

		await openNewSection()
		await userEvent.keyboard("{Enter}")
		await expect(args.onCreateSection).toHaveBeenCalledWith(
			NEW_SECTION,
			"atlas",
		)

		await openNewSection()
		await userEvent.keyboard("Reading{Enter}")
		await expect(args.onCreateSection).toHaveBeenCalledWith("Reading", "atlas")
	},
})

const openSurfaceMenu = async (canvasElement: HTMLElement) => {
	const surface = canvasElement.querySelector<HTMLElement>(
		'[data-slot="roster-surface"]',
	)
	if (!surface) throw new Error("Nothing here draws a roster surface")
	fireEvent.contextMenu(surface)
	return within(await shown(await screen.findByRole("menu", { name: CREATE })))
}

export const RosterSurfaceMenu = meta.story({
	args: { ...sectionArgs(), onCreateConversation: fn() },
	parameters: {
		a11y: mergeA11y(
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_FLOATING_FOCUS_GUARDS,
		),
		docs: {
			description: {
				story:
					"The panel itself answers a right-click. Everything the sidebar can make used to need a row to start from — a companion to hang a section on, a header menu to open for a conversation — so the empty ground under the roster was the one place a reader could aim and get nothing. It now carries the three things this panel makes on its own — a companion, a conversation, a section — and, under a rule that closes them off, the way into the space's own settings. The ground is the leftover column under the last row, so it is only ever reached when the aim missed every row, every section header and the header above them: those keep their own menus and take the click first. Check the menu names the three, in the order the panel builds them, that space settings sits last behind its rule, and that a right-click on a row still opens that row's actions and not this. Pick `RosterSurfaceWithoutSpaceSettings` for the panel given no settings handler.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const menu = await openSurfaceMenu(canvasElement)
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual([
			"New companion",
			"New conversation",
			NEW_SECTION,
			"Space settings",
		])
		await expect(menu.getAllByRole("separator")).toHaveLength(1)

		await userEvent.click(menu.getByRole("menuitem", { name: "New companion" }))
		await expect(args.onCreateBot).toHaveBeenCalled()

		await userEvent.click(
			(await openSurfaceMenu(canvasElement)).getByRole("menuitem", {
				name: "Space settings",
			}),
		)
		await expect(args.onOpenSpaceSettings).toHaveBeenCalled()

		await userEvent.click(
			(await openSurfaceMenu(canvasElement)).getByRole("menuitem", {
				name: "New conversation",
			}),
		)
		await expect(args.onCreateConversation).toHaveBeenCalled()

		const row = await openRowMenu(canvasElement, "Beacon")
		await expect(row.getByRole("menuitem", { name: "Settings" })).toBeVisible()
	},
})

export const RosterSurfaceWithoutSpaceSettings = meta.story({
	args: {
		...sectionArgs(),
		onCreateConversation: fn(),
		onOpenSpaceSettings: undefined,
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_FLOATING_FOCUS_GUARDS,
		),
		docs: {
			description: {
				story:
					"The same ground, for a host that has no settings dialog to open. The menu keeps the three things the panel makes and drops both the space settings entry and the rule that would have led to it, so the menu never ends on a rule with nothing under it. Pick `RosterSurfaceMenu` for the full menu.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const menu = await openSurfaceMenu(canvasElement)
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["New companion", "New conversation", NEW_SECTION])
		await expect(menu.queryAllByRole("separator")).toHaveLength(0)
	},
})

export const NewSectionFromNothing = meta.story({
	args: sectionArgs(),
	parameters: {
		a11y: mergeA11y(
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_FLOATING_FOCUS_GUARDS,
		),
		docs: {
			description: {
				story:
					"A section born from nothing. Picked from the panel's own menu, the naming field opens at the foot of the roster exactly as it does when a companion starts it — same field, same `New section` already selected — but with no row under it, because there is nothing to show yet. The roster above it is left untouched: no row moves, nothing is borrowed to fill the new group. Enter reports the name alone, and the host makes an empty section in the space on screen. Escape leaves the roster exactly as it was.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const openNewSection = async () => {
			const menu = await openSurfaceMenu(canvasElement)
			await userEvent.click(menu.getByRole("menuitem", { name: NEW_SECTION }))
		}

		await openNewSection()

		const field = sectionField(canvasElement)
		await expect(field).toHaveFocus()
		await expect(field).toHaveAccessibleName("New section name")
		await expect(field).toHaveValue(NEW_SECTION)
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)

		await userEvent.keyboard("Reading{Escape}")
		await expect(args.onCreateSection).not.toHaveBeenCalled()
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)

		await openNewSection()
		await userEvent.keyboard("Reading{Enter}")
		await expect(args.onCreateSection).toHaveBeenCalledWith(
			"Reading",
			undefined,
		)
	},
})

const SORTED_ZONE_LANDING = "__sorted__"

const PINNED_ZONE_LANDING = "__pinned__"

const dropAreaFor = (canvasElement: HTMLElement, landing: string) => {
	const area = canvasElement.querySelector<HTMLElement>(
		`[data-roster-drop="${landing}"]`,
	)
	if (!area) throw new Error(`No drop area for ${landing}`)
	return area
}

const isLightened = (node: HTMLElement) =>
	getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)"

const POINTER = {
	button: 0,
	isPrimary: true,
	pointerId: 1,
	pointerType: "mouse",
}

const centreOf = (node: Element) => {
	const box = node.getBoundingClientRect()
	return {
		clientX: Math.round(box.left + box.width / 2),
		clientY: Math.round(box.top + box.height / 2),
	}
}

const liftedBot = () =>
	document.querySelector<HTMLElement>('[data-slot="roster-lifted-bot"]')

const lift = (handle: HTMLElement) => {
	const from = centreOf(handle)
	fireEvent.pointerDown(handle, { ...POINTER, ...from })
	fireEvent.pointerMove(handle, {
		...POINTER,
		clientX: from.clientX,
		clientY: from.clientY + 12,
	})
}

const moveOver = (handle: HTMLElement, onto: Element) => {
	fireEvent.pointerMove(handle, { ...POINTER, ...centreOf(onto) })
}

const under = (node: Element) => ({
	clientX: centreOf(node).clientX,
	clientY: Math.round(node.getBoundingClientRect().bottom) - 2,
})

const inTheGutterUnder = (node: Element) => {
	const { bottom } = node.getBoundingClientRect()
	const below = node.nextElementSibling?.getBoundingClientRect()
	return {
		clientX: centreOf(node).clientX,
		clientY: Math.round(below ? (bottom + below.top) / 2 : bottom + 4),
	}
}

const moveUnder = (handle: HTMLElement, onto: Element) => {
	fireEvent.pointerMove(handle, { ...POINTER, ...under(onto) })
}

const dropOver = (handle: HTMLElement, onto: Element) => {
	fireEvent.pointerUp(handle, { ...POINTER, ...centreOf(onto) })
	fireEvent.click(handle)
}

const dragOnto = (handle: HTMLElement, onto: Element) => {
	lift(handle)
	moveOver(handle, onto)
	dropOver(handle, onto)
}

export const DragBotIntoAnEmptyPinnedZone = meta.story({
	args: {
		bots: ROSTER.slice(0, 3),
		selectedSpaceId: HOME,
		onSelectBot: fn(),
		onPinRoster: fn(),
	},
	parameters: {
		docs: {
			description: {
				story:
					"The invitation to pin a first row. A space where nothing is pinned draws no zone and no rule at rest — the roster is one plain list, and a band of empty space above it would only ask the reader to wonder what it is for. The moment a row is lifted the zone appears at the top with the rule under it, so the gesture teaches its own target: the reader sees a place to aim at exactly when there is something to aim with, and the panel goes back to one list the instant the row is put down. Releasing over it reports the row as the only pin. Check the row refuses text selection, so dragging it lifts the row rather than highlighting the name and the preview under the pointer. Pick `DragBotToSection` for the zone once it holds sections, `DragBotOutOfSection` for the way back down.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Cinder"))
		await expect(getComputedStyle(handle).userSelect).toBe("none")
		await expect(
			canvasElement.querySelector(
				`[data-roster-drop="${PINNED_ZONE_LANDING}"]`,
			),
		).toBeNull()

		lift(handle)
		const pinned = await settled(
			dropAreaFor(canvasElement, PINNED_ZONE_LANDING),
		)
		await expect(pinned).toBeVisible()
		await expect(slotIn(canvasElement, "roster-zone-separator")).toBeVisible()

		moveOver(handle, pinned)
		await waitFor(async () => {
			await expect(isLightened(pinned)).toBe(true)
		}, FRAME_POLL)

		dropOver(handle, pinned)
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([["cinder", null]]),
		)
		await expect(args.onSelectBot).not.toHaveBeenCalled()
		await expect(
			canvasElement.querySelector(
				`[data-roster-drop="${PINNED_ZONE_LANDING}"]`,
			),
		).toBeNull()
	},
})

export const DragBotToSection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					'Filing a companion by hand. A press on a row that then moves lifts the companion: it is reduced to its avatar alone, which follows the pointer, while the row itself stays exactly where it stood — the roster is the host\'s to redraw, so nothing is torn out of the list on the strength of a gesture that has not landed yet. The area the companion would land in lightens under it, header and rows together, so the target is a whole section rather than a slot between two rows: a section is always ordered by last message, so a drop changes which group a companion belongs to and nothing else. Releasing reports the companion and the section, the same call the `Move to section` branch makes, and the click that a release would otherwise fire is swallowed so a drag never doubles as a selection. The row and every drop area carry `data-tauri-drag-region="false"`, which is what keeps the gesture on the companion instead of on the frameless window the panel is mounted in. Keyboard readers are not asked to drag: `MoveBotToSection` is the same move from the menu.',
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Atlas"))
		const shipping = dropAreaFor(canvasElement, "shipping")

		lift(handle)
		await expect(liftedBot()).not.toBeNull()
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)

		moveOver(handle, shipping)
		const ghost = liftedBot()
		if (!ghost) throw new Error("Nothing is lifted")
		await expect(
			Math.abs(centreOf(ghost).clientY - centreOf(shipping).clientY),
		).toBeLessThanOrEqual(1)
		await expect(isLightened(shipping)).toBe(true)
		await expect(isLightened(dropAreaFor(canvasElement, "research"))).toBe(
			false,
		)

		dropOver(handle, shipping)
		await expect(args.onPinRoster).toHaveBeenCalledTimes(1)
		await expect(args.onSelectBot).not.toHaveBeenCalled()
		await expect(liftedBot()).toBeNull()
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)
	},
})

export const DragBotOutOfSection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"Taking a companion back out. The companions holding no section are a drop area like any other, so the gesture that files a companion is the gesture that unfiles it, and the release reports `null` rather than an empty string — a host never has to guess what no section means. When every companion has been filed there is nothing left to aim at, so the empty band draws the same dashed invitation an empty section draws, but only while something is lifted: at rest the roster is exactly what it was before any of this existed. Dropping a companion back on the section it already holds reports nothing at all, and so does a release over the panel's chrome — a gesture that lands nowhere is not a change.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Beacon"))
		const loose = dropAreaFor(canvasElement, SORTED_ZONE_LANDING)

		lift(handle)
		moveOver(handle, loose)
		await expect(isLightened(loose)).toBe(true)
		dropOver(handle, loose)
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["ember", "research"],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["archive", null],
			]),
		)

		const research = dropAreaFor(canvasElement, "research")
		dragOnto(handle, research)
		await expect(args.onPinRoster).toHaveBeenCalledTimes(1)
	},
})

export const DragBotUnderASection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"The boundary between the inside of a section and the space under it. Where a row lands is read off what the hand is actually over, never off the rows it has passed: over a card the row joins that section, in the gutter between two cards it stays loose at that place. Without that rule a row let go just under the last row of a section is filed into it, since the two land at the same rank — the reader aims at empty panel and the row disappears into a group. Check that a companion released in the gutter under Research comes back loose, sitting between the two sections rather than inside either. `DragBotToSection` is the same gesture aimed one row higher.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Atlas"))
		const research = dropAreaFor(canvasElement, "research")

		lift(handle)
		const gutter = inTheGutterUnder(research)
		fireEvent.pointerMove(handle, { ...POINTER, ...gutter })
		await expect(isLightened(research)).toBe(false)

		fireEvent.pointerUp(handle, { ...POINTER, ...gutter })
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["beacon", "research"],
				["ember", "research"],
				["atlas", null],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["archive", null],
			]),
		)
	},
})

export const DragBotToTheEndOfASection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"The line that tells the two ends apart. Landing last inside a section and landing under it are one rank apart and would draw the same mark, so the line is attached to the row it belongs beside rather than to the rank: under Research's last row while the hand is over the card, above the next card once the hand is in the gutter. Without it the reader aims at the bottom of a group and reads a mark drawn outside it. Check both marks from the same two pixels of travel. `DragBotUnderASection` is what each one reports on release.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Atlas"))
		const research = dropAreaFor(canvasElement, "research")
		const ember = rowFor(canvasElement, "Ember")

		lift(handle)
		fireEvent.pointerMove(handle, { ...POINTER, ...under(research) })
		await expect(slotIn(canvasElement, "roster-insertion").parentElement).toBe(
			ember,
		)

		fireEvent.pointerMove(handle, {
			...POINTER,
			...inTheGutterUnder(research),
		})
		await expect(slotIn(canvasElement, "roster-insertion").parentElement).toBe(
			dropAreaFor(canvasElement, "shipping"),
		)
	},
})

export const DragBotIntoEmptySection = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"The first companion into a section nothing has been filed into yet. The dashed zone is not a separate mechanism — the whole section, header and zone together, is the target, so a hand that lands anywhere near it lands. Check that Archive lightens under the lifted companion and that the release reports the companion and `archive`; the zone stays drawn until the host answers, since this panel never files a companion on its own.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Cinder"))
		const archive = dropAreaFor(canvasElement, "archive")

		lift(handle)
		moveOver(handle, archive)
		await expect(isLightened(archive)).toBe(true)

		dropOver(handle, archive)
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([...PINNED_NOW, ["cinder", "archive"]]),
		)
		await expect(slotIn(canvasElement, "roster-section-drop")).toBeVisible()
	},
})

export const DragBotNowhere = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"Every way a lift ends in nothing. A press that never moves is still a plain click and selects the companion, so the gesture costs the reader nothing to start. A release outside any drop area reports nothing and leaves the roster as it stands. An interrupted pointer — a stream the browser takes back, a touch turned into a scroll — puts the companion down where it was and reports nothing, rather than filing it wherever the last move happened to be. Check all three, and that no lift starts at all from a press that carries a right button.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const handle = rowButton(rowFor(canvasElement, "Ember"))

		await userEvent.click(handle)
		await expect(args.onSelectBot).toHaveBeenCalledWith("ember")
		await expect(args.onPinRoster).not.toHaveBeenCalled()

		lift(handle)
		await expect(liftedBot()).not.toBeNull()
		fireEvent.pointerCancel(handle, POINTER)
		await expect(liftedBot()).toBeNull()
		await expect(args.onPinRoster).not.toHaveBeenCalled()

		lift(handle)
		fireEvent.pointerMove(handle, { ...POINTER, clientX: 4, clientY: 4 })
		fireEvent.pointerUp(handle, { ...POINTER, clientX: 4, clientY: 4 })
		await expect(args.onPinRoster).not.toHaveBeenCalled()
		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)

		fireEvent.pointerDown(handle, {
			...POINTER,
			...centreOf(handle),
			button: 2,
		})
		moveOver(handle, dropAreaFor(canvasElement, "shipping"))
		await expect(liftedBot()).toBeNull()
	},
})

export const DragSectionToPlace = meta.story({
	args: sectionArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"Placing a section by hand. A section is not filed into anything — it takes a place in an order — so this gesture is not the one that files a companion: there is no zone to land in and nothing lightens. The header is the handle, a press that moves lifts the whole group, companions and all, and it comes off the panel as a card — a shade smaller, with a shadow under it — so what it passes over stays readable. A line is drawn at the boundary the section would take, above whichever section its middle has not yet passed, or under the last one when it has passed them all. Letting go reports the full new order of section ids — the same call the menu's `Move up` and `Move down` make, which stay exactly where they were for keyboard readers and for a reader who would rather not drag at all. A section released where it already stood reports nothing, an interrupted pointer reports nothing, and a press that never moves is still the plain click that folds the group. The companions holding no section are never a target: they stay pinned above every section, so the first boundary a section can take is under them.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = sectionHeader(canvasElement, "Shipping")
		const research = dropAreaFor(canvasElement, "research")

		const dune = rowFor(canvasElement, "Dune")
		const restsAt = dune.getBoundingClientRect().top
		const lifted = dropAreaFor(canvasElement, "shipping")
		const liftedAt = lifted.getBoundingClientRect().top

		lift(handle)
		await expect(lifted.getBoundingClientRect().top - liftedAt).toBeCloseTo(
			12,
			0,
		)
		await expect(dune.getBoundingClientRect().top).toBeGreaterThan(restsAt)

		moveOver(handle, research)
		await expect(slotIn(canvasElement, "roster-insertion").parentElement).toBe(
			research,
		)
		await expect(isLightened(research)).toBe(false)

		dropOver(handle, research)
		await expect(args.onPinRoster).toHaveBeenCalledWith(
			HOME,
			pinsFor([
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
				["research", null],
				["beacon", "research"],
				["ember", "research"],
				["archive", null],
			]),
		)
		await expect(handle).toHaveAttribute("aria-expanded", "true")
		await expect(dune.getBoundingClientRect().top).toBeCloseTo(restsAt, 0)

		lift(handle)
		dropOver(handle, handle)
		await expect(args.onPinRoster).toHaveBeenCalledTimes(1)

		const archive = dropAreaFor(canvasElement, "archive")
		lift(handle)
		moveUnder(handle, archive)
		await expect(slotIn(canvasElement, "roster-insertion").parentElement).toBe(
			archive,
		)
		fireEvent.pointerUp(handle, { ...POINTER, ...under(archive) })
		await expect(args.onPinRoster).toHaveBeenLastCalledWith(
			HOME,
			pinsFor([
				["research", null],
				["beacon", "research"],
				["ember", "research"],
				["archive", null],
				["shipping", null],
				["dune", "shipping"],
				["flint", "shipping"],
			]),
		)

		lift(handle)
		fireEvent.pointerCancel(handle, POINTER)
		await expect(args.onPinRoster).toHaveBeenCalledTimes(2)
		await expect(handle).toHaveAttribute("aria-expanded", "true")
	},
})

export const CollapsedSections = meta.story({
	args: sectionArgs(),
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The sectioned roster on the icon rail. There is no room for a header a reader could read, so the headers go from the picture and from the accessibility tree entirely rather than shrinking into an unreadable stub, and the invitation under an empty section goes with them. The companions stay in exactly the order the sections gave them, so collapsing never reshuffles the rail. Nothing lifts here either: with no header to read and no zone to aim at there is nowhere to drop a companion, so a press that moves on the rail is a press that moves nothing. Check the rail holds the same six avatars in the same order as `Sections`, that no header is reachable by Tab, and that the create button is still the first stop.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await waitFor(async () => {
			await expect(
				canvas
					.getByRole("complementary", { name: "Conversations" })
					.getBoundingClientRect().width,
			).toBeCloseTo(railWidth(), 0)
		}, FRAME_POLL)

		await expect(rowNames(canvasElement)).toEqual(GROUPED_ORDER)
		for (const header of sectionHeadersIn(canvasElement)) {
			await expect(header).not.toBeVisible()
		}
		await expect(canvas.queryByRole("button", { name: "Research" })).toBeNull()
		await expect(canvas.getByText("Drop a companion here")).not.toBeVisible()

		await userEvent.tab()
		await expect(
			canvas.getByRole("button", { name: "New companion" }),
		).toHaveFocus()
		await userEvent.tab()
		await expect(rowButton(rowsIn(canvasElement)[0])).toHaveFocus()

		lift(rowButton(rowsIn(canvasElement)[0]))
		await expect(liftedBot()).toBeNull()
	},
})

const SECTIONS_IN_VIEW_ONLY = { vocca: SECTIONS }

export const SectionsPerSpace = meta.story({
	args: {
		spaces: FIVE_SPACES,
		selectedSpaceId: "vocca",
		botsBySpaceId: FIVE_ROSTERS,
		sectionsBySpaceId: SECTIONS_IN_VIEW_ONLY,
		user: READER,
		onCreateSection: fn(),
		onRenameSection: fn(),
		onDeleteSection: fn(),
		onPinRoster: fn(),
	},
	parameters: {
		docs: {
			description: {
				story:
					"Sections belong to a space, not to the panel. A host that keeps them per space passes `sectionsBySpaceId`, and from then on that map is the whole truth: a space it does not list holds no section and is drawn flat, rather than borrowing the sections of whichever space happens to be open. It matters at the edges of the carousel, which draws the panel waiting either side of the one in view — a host that has only loaded the space in view would otherwise see its headers bleed into both neighbours and watch them vanish mid-swipe. The `sections` prop stays for the single panel, where there is no map to consult. Check that Vocca carries its three headers and that the panel beside it carries none while listing its own companions.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const panels = panelsIn(canvasElement)
		await expect(sectionNames(panelInView(canvasElement))).toEqual([
			"Research",
			"Shipping",
			"Archive",
		])

		const waiting = panels.filter((panel) => panel.hasAttribute("inert"))
		await expect(waiting.length).toBeGreaterThan(0)
		for (const panel of waiting) {
			await expect(sectionNames(panel)).toEqual([])
			await expect(rowsIn(panel).length).toBeGreaterThan(0)
		}
	},
})

const atRest = (bot: AppSidebarBot): AppSidebarBot => ({
	...bot,
	status: undefined,
	pose: undefined,
	badge: undefined,
})

const participantsOf = (...ids: string[]) =>
	ids.map((id) => {
		const bot = ROSTER.find((held) => held.id === id)
		if (!bot) throw new Error(`No bot called ${id}`)
		return atRest(bot)
	})

const PAIR = participantsOf("atlas", "beacon")

const CROWD = participantsOf("atlas", "beacon", "cinder", "dune", "ember")

const CONVERSATIONS: AppSidebarConversation[] = [
	{
		id: "launch",
		name: "Launch review",
		participants: PAIR,
		lastMessage: "Atlas pulled the papers, Beacon is drafting the summary.",
		lastSpeaker: "Beacon",
		timestamp: "09:31",
	},
	{
		id: "migration",
		name: "Transport migration",
		participants: CROWD,
		lastMessage: LAST_MESSAGE,
		timestamp: "09:05",
	},
]

const conversationArgs = () => ({
	bots: ROSTER.slice(0, 4),
	conversations: CONVERSATIONS,
	selectedBotId: "beacon",
	onCreateConversation: fn(),
	onSelectConversation: fn(),
	onOpenConversationSettings: fn(),
	onDeleteConversation: fn(),
	onPinRoster: fn(),
	selectedSpaceId: HOME,
})

const stackIn = (row: HTMLElement) =>
	Array.from(
		slotIn(row, "conversation-avatar").querySelectorAll(
			'[data-slot="bot-identity-avatar"]',
		),
	)

const CREATE = "Create"

const LONG_SPEAKER = "Bartholomew Featherstonehaugh the Third"

export const Conversations = meta.story({
	args: conversationArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"A conversation is a room holding several companions of the space, and it lives in the roster among them rather than in a list of its own. Its row is built from the same parts as a companion row — a 40px avatar slot, the name, the time of the last message and one clipped line of that message — so the two kinds sit on the same columns and stand the same height, which is what this story checks across a mixed list. What changes is the slot: instead of one companion it carries the companions in the room, drawn small in a fixed square so the column never widens. A room of two draws two, a room of five draws three and writes how many it left out in the fourth corner of the square. Pick `ConversationParticipants` for the stack on its own, `ConversationSelected` for the room a reader is in, `ConversationRowMenu` for what a right-click offers.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		await expect(rows).toHaveLength(6)
		await expect(rowNames(canvasElement)).toEqual([
			"Launch review",
			"Transport migration",
			"Atlas",
			"Beacon",
			"Cinder",
			"Dune",
		])

		await expectAlignedRows(rows)

		const muted = tokenColor(canvasElement, "--muted-foreground")
		await expectMutedSecondaryText(
			rowFor(canvasElement, "Launch review"),
			muted,
		)
	},
})

export const ConversationParticipants = meta.story({
	args: conversationArgs(),
	parameters: {
		docs: {
			description: {
				story:
					"How many faces a room shows. Two companions draw two avatars, and the slot stays the same square a companion row gives one avatar — the tiles shrink, the column does not move. Past three the stack stops drawing and starts counting: three avatars and `+2` for the two it left out, so the slot never turns into a grid of specks nobody can tell apart. The count sits in the fourth cell of the square, the one the three faces leave free, rather than on the name line — the name reads as the name and nothing else. The square is the only thing that carries the count, so the row hands it to a screen reader as the label of that square; a room within its three faces stays decorative and hidden, since three avatar labels in front of the room name would bury the name.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const pair = rowFor(canvasElement, "Launch review")
		const crowd = rowFor(canvasElement, "Transport migration")

		await expect(stackIn(pair)).toHaveLength(2)
		await expect(stackIn(crowd)).toHaveLength(3)

		await expect(
			crowd.querySelector('[data-slot="roster-row-badge"]'),
		).toBeNull()
		await expect(
			slotIn(crowd, "conversation-avatar-overflow"),
		).toHaveTextContent("+2")

		await expect(slotIn(pair, "conversation-avatar")).toHaveAttribute(
			"aria-hidden",
			"true",
		)
		await expect(slotIn(crowd, "conversation-avatar")).toHaveAccessibleName(
			"+2",
		)

		const square = slotIn(crowd, "conversation-avatar").getBoundingClientRect()
		await expect(Math.round(square.width)).toBe(Math.round(square.height))
		await expect(Math.round(square.width)).toBe(
			Math.round(
				slotIn(
					rowFor(canvasElement, "Atlas"),
					"bot-identity-avatar",
				).getBoundingClientRect().width,
			),
		)

		const tiles = stackIn(crowd).map((tile) => tile.getBoundingClientRect())
		for (const tile of tiles) {
			await expect(Math.round(tile.width)).toBe(Math.round(tile.height))
			await expect(tile.left).toBeGreaterThanOrEqual(square.left)
			await expect(tile.right).toBeLessThanOrEqual(square.right)
			await expect(tile.top).toBeGreaterThanOrEqual(square.top)
			await expect(tile.bottom).toBeLessThanOrEqual(square.bottom)
		}
		await expect(tiles[0].right).toBeLessThanOrEqual(tiles[1].left)
		await expect(tiles[0].bottom).toBeLessThanOrEqual(tiles[2].top)

		const count = slotIn(
			crowd,
			"conversation-avatar-overflow",
		).getBoundingClientRect()
		await expect(count.left).toBeGreaterThanOrEqual(tiles[2].right)
		await expect(count.top).toBeGreaterThanOrEqual(tiles[1].bottom)
		await expect(Math.round(count.width)).toBe(Math.round(tiles[0].width))
	},
})

export const ConversationOfOneBot = meta.story({
	args: {
		...conversationArgs(),
		conversations: [
			{
				id: "solo",
				name: "Atlas one to one",
				participants: participantsOf("atlas"),
				lastMessage: "Pulled the papers, reading them now.",
				lastSpeaker: "Atlas",
				timestamp: "09:40",
			},
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A room holding one companion, sitting right above that same companion's own row. Nothing on the two lines of text says which is which — same name column, same preview, same time — so the kind is carried by the shape of the icon alone: a companion floats free at the full 40px of the slot, a room is drawn inside a frame with its companions held smaller within it. The footprint is identical, so the column never moves; only what fills it changes. A room of one is still a room, which is why it gets the frame rather than being flattened into the companion it holds.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const room = rowFor(canvasElement, "Atlas one to one")
		const bot = rowFor(canvasElement, "Atlas")

		const frame = slotIn(room, "conversation-avatar")
		const loose = slotIn(bot, "bot-identity-avatar")
		await expect(
			bot.querySelector('[data-slot="conversation-avatar"]'),
		).toBeNull()

		await expect(Math.round(frame.getBoundingClientRect().width)).toBe(
			Math.round(loose.getBoundingClientRect().width),
		)
		await expect(
			Number.parseFloat(getComputedStyle(frame).borderTopWidth),
		).toBeGreaterThan(0)

		const [held] = stackIn(room)
		await expect(held.getBoundingClientRect().width).toBeLessThan(
			loose.getBoundingClientRect().width,
		)
	},
})

export const ConversationPreview = meta.story({
	args: {
		...conversationArgs(),
		conversations: [
			CONVERSATIONS[0],
			{ ...CONVERSATIONS[1], lastMessage: "Rebuilt the bundle, both green." },
			{
				id: "handover",
				name: "Handover",
				participants: PAIR,
				lastMessage: LAST_MESSAGE,
				lastSpeaker: "Bartholomew Featherstonehaugh the Third",
				timestamp: "08:12",
			},
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"Who said the last word. A companion row needs no name — the row is the companion — but a room holds several, so the preview carries the name of whoever spoke, ahead of the word and separated from it. The second room shows the two cases that carry no name: the reader's own word, and a companion that has left the room or no longer exists, both of which would name somebody the reader cannot see in the stack. The third room checks that name and word are one string and not two columns: they clip together at the row width with a single ellipsis, and the line never wraps whatever the name is worth.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const named = slotIn(
			rowFor(canvasElement, "Launch review"),
			"roster-row-preview",
		)
		const unnamed = slotIn(
			rowFor(canvasElement, "Transport migration"),
			"roster-row-preview",
		)
		const long = slotIn(rowFor(canvasElement, "Handover"), "roster-row-preview")

		await expect(named).toHaveTextContent(
			"Beacon: Atlas pulled the papers, Beacon is drafting the summary.",
		)
		await expect(unnamed).toHaveTextContent("Rebuilt the bundle, both green.")

		await expect(isClipped(long)).toBe(true)
		await expect(long.getBoundingClientRect().height).toBeLessThanOrEqual(
			SINGLE_LINE_HEIGHT,
		)
	},
})

export const BareRows = meta.story({
	args: {
		...conversationArgs(),
		bots: [ROSTER[0], withoutHistory(ROSTER[1])],
		conversations: [
			CONVERSATIONS[0],
			{ id: "kickoff", name: "Kickoff", participants: PAIR },
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A companion nobody has written to and a room nobody has spoken in, each above one that carries a line. Check that a row with nothing to preview centres its name on the avatar instead of leaving it riding above the middle: the preview line owns its height only while it holds words, and the pair of lines keeps the height of a full row either way, so the list stays on one rhythm and no row grows or shrinks as the first message lands. Pick `NoHistory` for the bare companion among four, `ConversationPreview` for the room that has something to say.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)
		const bareBot = rowFor(canvasElement, "Beacon")
		const bareRoom = rowFor(canvasElement, "Kickoff")

		await expect(slotIn(bareBot, "roster-row-preview")).toBeEmptyDOMElement()
		await expect(slotIn(bareRoom, "roster-row-preview")).toBeEmptyDOMElement()

		await expectNameOnAvatarCentre(bareBot, "bot-identity-avatar")
		await expectNameOnAvatarCentre(bareRoom, "conversation-avatar")

		await expectAlignedRows(rows)
	},
})

export const ConversationWorking = meta.story({
	args: {
		...conversationArgs(),
		conversations: [
			{
				...CONVERSATIONS[0],
				status: "working" as const,
				participants: [
					{
						...PAIR[0],
						status: "working" as const,
						pose: "searching" as const,
					},
					{
						...PAIR[1],
						status: "working" as const,
						pose: "writing" as const,
						badge: "attention" as const,
					},
				],
			},
			CONVERSATIONS[1],
			{
				id: "handover",
				name: "Handover",
				participants: [{ ...PAIR[0], status: "working" as const }],
				lastMessage: "Rebuilt the bundle, both green.",
				lastSpeaker: "Atlas",
				timestamp: "08:12",
			},
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A room where companions are running. The companion animates inside the stack the way it would on its own row, and its badge is carried up onto the room: a reader scanning the roster sees the dot on the room rather than having to open it to find which of its companions wants them. Only one dot is drawn whatever the room holds — the badge slot is the same one a companion row uses, at the trailing edge under the timestamp, so a mixed list has one dot per row, on one column, and never a cluster over a stack of avatars. The preview line drops the last message for the work in progress, the way a companion row does, except a room names who is at it: the first room has two companions running and speaks of the one that spoke last, so the line never jumps between them mid-run. The third room holds a companion running without a pose and falls back to the same word a companion row falls back to. The quiet room in the middle keeps its message and wears no dot.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const busy = rowFor(canvasElement, "Launch review")
		const quiet = rowFor(canvasElement, "Transport migration")
		const poseless = rowFor(canvasElement, "Handover")

		await expect(badgeIn(busy)).toBe("attention")
		await expect(
			busy.querySelectorAll('[data-slot="bot-activity-dot"]'),
		).toHaveLength(1)
		await expect(badgeIn(quiet)).toBeUndefined()

		await expect(slotIn(busy, "roster-row-preview")).toHaveTextContent(
			"Beacon: writing…",
		)
		await expect(slotIn(quiet, "roster-row-preview")).toHaveTextContent(
			LAST_MESSAGE,
		)
		await expect(slotIn(poseless, "roster-row-preview")).toHaveTextContent(
			"Atlas: thinking…",
		)
	},
})

export const WorkingLongSummary = meta.story({
	args: {
		...conversationArgs(),
		selectedConversationId: "launch",
		conversations: [
			{
				...CONVERSATIONS[0],
				participants: [
					{
						...PAIR[0],
						name: LONG_SPEAKER,
						status: "working" as const,
						pose: "searching" as const,
					},
					PAIR[1],
				],
				lastSpeaker: LONG_SPEAKER,
			},
			CONVERSATIONS[1],
		],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A running line longer than the row it sits on, on the row the reader is in. Check that it clips to one line like any other message rather than wrapping — the shimmer is painted onto the glyphs, so a wrapped line would take the row taller and move every row under it — and that the ellipsis is drawn in the resting muted colour by the line itself rather than swept by the gradient, which keeps the clip readable at the darkest phase of the sweep. The selected row keeps the same reading: the sweep runs between the muted and the plain foreground on the selected surface too, so it never dims into the pill it sits on. Pick `Working` for the sweep on a line that fits, `ReducedMotion` for the same line held still.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const muted = tokenColor(canvasElement, "--muted-foreground")
		const row = rowFor(canvasElement, "Launch review")
		const preview = slotIn(row, "roster-row-preview")
		const quiet = slotIn(
			rowFor(canvasElement, "Transport migration"),
			"roster-row-preview",
		)

		const shimmer = slotIn(row, "text-shimmer")
		await expect(rowButton(row)).toHaveAttribute("aria-current", "page")
		await expect(preview).toHaveTextContent(`${LONG_SPEAKER}: searching…`)
		await expect(isClipped(preview)).toBe(true)
		await expect(getComputedStyle(shimmer).display).toBe("inline")
		await expect(colorOf(row, "roster-row-preview")).toBe(muted)
		await expect(preview.getBoundingClientRect().height).toBe(
			quiet.getBoundingClientRect().height,
		)
		await expect(uniqueCount(rowHeights(rowsIn(canvasElement)))).toBe(1)
	},
})

const MISSION_CONVERSATIONS: AppSidebarConversation[] = [
	{
		...CONVERSATIONS[0],
		lastActivityAt: 1,
		timestamp: "Tue",
		missions: [missionOf("waiting", 0), missionOf("working", 1)],
	},
	{ ...CONVERSATIONS[1], lastActivityAt: 3, timestamp: "now" },
]

const MISSION_CONVERSATION_ARGS = {
	...conversationArgs(),
	bots: [{ ...ROSTER[0], lastActivityAt: 2, timestamp: "5m" }],
	conversations: MISSION_CONVERSATIONS,
}

export const ConversationMissionStrips = meta.story({
	args: MISSION_CONVERSATION_ARGS,
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A mission belongs to the conversation it was opened from, so a room carrying open missions wears the strips its companions would otherwise wear alone. Check the strips sit under the room row, in the same lane and the same shapes a companion row gives them, and that the room draws one per open mission whichever of its companions runs it. Check the room whose mission waits on the reader is drawn first even though it spoke longest ago, exactly as a waiting companion row is raised, that it measures 108px for its two missions while the rows with none keep their 52px, and that the avatar stack stays centred on the row part. Pick `MissionStripStates` for the strip on a companion row, `ConversationMissionStripsOnRail` for the rail that drops it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const rows = rowsIn(canvasElement)

		await expect(rowNames(canvasElement)).toEqual([
			"Launch review",
			"Transport migration",
			"Atlas",
		])
		await expect(rows.map(stripStatesIn)).toEqual([
			["waiting", "working"],
			[],
			[],
		])
		await expect(rowHeights(rows)).toEqual([
			heightForStrips(2),
			heightForStrips(0),
			heightForStrips(0),
		])
		await expect(slotIn(rows[0], "roster-row-timestamp")).toHaveTextContent(
			"Tue",
		)
		await expectAvatarCentredOnRowPart(rows[0], "conversation-avatar")
		await expectAlignedRows(rows)
	},
})

export const ConversationMissionStripsOnRail = meta.story({
	args: MISSION_CONVERSATION_ARGS,
	render: renderShell(false),
	parameters: {
		docs: {
			description: {
				story:
					"The same room once the panel is down to its icon rail. Check no strip is drawn there either: the rail is the avatar stack and nothing else, and a room defers its missions to the open panel exactly as a companion does. Pick `ConversationMissionStrips` for the open panel, `MissionStripOnRail` for the companion row that drops them too.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Conversations" })
		const rail = railWidth()
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		await expect(slotsIn(canvasElement, "bot-mission-strip")).toHaveLength(0)
	},
})

export const ConversationSelected = meta.story({
	args: { ...conversationArgs(), selectedConversationId: "migration" },
	parameters: {
		docs: {
			description: {
				story:
					"The room a reader is in. It wears the same pill and the same `aria-current` a selected companion row wears, because a reader is in one place at a time and the panel must not suggest otherwise: while a room is selected no companion row is active, even though `selectedBotId` still names the last companion the reader was with and the host is free to keep it. Check that exactly one row in the panel is current and that it is the room, and that the live region names the room rather than falling back to the companion underneath it.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const room = rowFor(canvasElement, "Transport migration")
		const bot = rowFor(canvasElement, "Beacon")

		await expect(rowButton(room)).toHaveAttribute("aria-current", "page")
		await expect(rowButton(bot)).not.toHaveAttribute("aria-current")
		await expect(
			canvasElement.querySelectorAll('[aria-current="page"]'),
		).toHaveLength(1)
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Transport migration selected, idle",
		)

		await userEvent.click(rowButton(rowFor(canvasElement, "Launch review")))
		await expect(args.onSelectConversation).toHaveBeenCalledWith("launch")
		await expect(args.onSelectBot).not.toHaveBeenCalled()
	},
})

export const ConversationRowMenu = meta.story({
	args: {
		...conversationArgs(),
		bots: SECTIONED_ROSTER,
		sections: SECTIONS,
		conversations: [{ ...CONVERSATIONS[0], sectionId: "research" }],
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"The actions behind a room, reached the same way a companion's are: a right-click on the row, no button on hover. A room offers less than a companion, and deliberately — pin leading the menu with a rule under it, then settings, the branch that files it, and delete. There is nothing to duplicate, because a room is the companions in it and copying it would fork a history rather than a template. The branch is the one a companion row uses, so it marks the section the room sits in now and reports `null` for the entry that clears it; a rule sits over delete and nowhere else, so a hand aimed at moving can never land on removing.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const menu = await openRowMenu(canvasElement, "Launch review")
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Pin", "Settings", MOVE_TO, "Delete"])
		await expect(menu.queryByRole("menuitem", { name: "Duplicate" })).toBeNull()
		await expect(menu.getAllByRole("separator")).toHaveLength(2)

		await userEvent.hover(menu.getByRole("menuitem", { name: MOVE_TO }))
		const surface = await shown(
			await screen.findByRole("menu", { name: MOVE_TO }),
		)
		await crossSafePolygon(surface)
		const branch = within(surface)
		const targets = branch.getAllByRole("menuitemradio")
		await expect(targets.map((item) => item.textContent)).toEqual([
			"No section",
			"Research",
			"Shipping",
			"Archive",
		])
		await expect(targets[1]).toHaveAttribute("aria-checked", "true")

		await userEvent.click(targets[2])
		await expect(args.onPinRoster).toHaveBeenCalledTimes(1)

		await userEvent.click(
			(await openRowMenu(canvasElement, "Launch review")).getByRole(
				"menuitem",
				{ name: "Settings" },
			),
		)
		await expect(args.onOpenConversationSettings).toHaveBeenCalledWith("launch")

		await userEvent.click(
			(await openRowMenu(canvasElement, "Launch review")).getByRole(
				"menuitem",
				{ name: "Delete" },
			),
		)
		await expect(args.onDeleteConversation).toHaveBeenCalledWith("launch")
	},
})

export const CreateMenu = meta.story({
	args: { ...conversationArgs(), onCreateSection: fn() },
	parameters: {
		a11y: mergeA11y(
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_FLOATING_FOCUS_GUARDS,
		),
		docs: {
			description: {
				story:
					"The plus in the header makes more than one thing, so it stops acting and starts asking. A press opens a menu under it — the same menu the space switcher beside it opens, on press rather than on right-click — with one entry per thing the panel can make: a companion on its own, a room to put several in, and the section that files them. The entries read in the order the panel builds them, so a section comes after the two things it holds. The button still says what it does before it is pressed and still reports that it carries a menu, so a keyboard reader is not surprised by a popup. A host that does not do rooms passes no `onCreateConversation` and keeps the plain button it always had, which is what every other story here shows — the menu is not the price of mounting this panel.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const create = canvas.getByRole("button", { name: CREATE })
		await expect(create).toHaveAttribute("aria-haspopup", "menu")

		await userEvent.tab()
		await expect(create).toHaveFocus()
		await userEvent.keyboard("{Enter}")

		const menu = within(await screen.findByRole("menu", { name: CREATE }))
		await expect(
			menu.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["New companion", "New conversation", NEW_SECTION])
		await expect(args.onCreateBot).not.toHaveBeenCalled()

		const pick = async (name: string) => {
			await userEvent.click(create)
			await userEvent.click(
				within(await screen.findByRole("menu", { name: CREATE })).getByRole(
					"menuitem",
					{ name },
				),
			)
		}

		await userEvent.click(menu.getByRole("menuitem", { name: "New companion" }))
		await expect(args.onCreateBot).toHaveBeenCalled()

		await pick("New conversation")
		await expect(args.onCreateConversation).toHaveBeenCalled()

		await pick(NEW_SECTION)
		await expect(sectionField(canvasElement)).toHaveFocus()
	},
})

export const NewSectionForAConversation = meta.story({
	args: {
		...conversationArgs(),
		bots: SECTIONED_ROSTER,
		sections: SECTIONS,
		onCreateSection: fn(),
	},
	parameters: {
		a11y: mergeA11y(
			A11Y_FLOATING_FOCUS_GUARDS,
			A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
			A11Y_SUBMENU_PORTAL_GUARD,
		),
		docs: {
			description: {
				story:
					"A room makes a section the same way a companion does. `Move to section` carries the same last entry, under the same label and behind the same rule, so a reader who learned the gesture on a companion row does not have to learn it twice. Picking it draws the section whole at the foot of the roster with the room already filed under it, and Enter reports the name together with the room it was made for — the host creates the section and files the room, and nothing is drawn here until it comes back through the props.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const branch = await openMoveToBranch(
			canvasElement,
			"Launch review",
			userEvent,
		)
		await expect(
			branch.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual([NEW_SECTION])

		await userEvent.click(branch.getByRole("menuitem", { name: NEW_SECTION }))

		const field = sectionField(canvasElement)
		await expect(field).toHaveFocus()
		await expect(field).toHaveValue(NEW_SECTION)
		await expect(rowNames(canvasElement).at(-1)).toBe("Launch review")

		await userEvent.keyboard("Reading{Enter}")
		await expect(args.onCreateSection).toHaveBeenCalledWith("Reading", "launch")
	},
})

export const DragConversationToSection = meta.story({
	args: {
		...conversationArgs(),
		bots: SECTIONED_ROSTER,
		sections: SECTIONS,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Filing a room by hand, which is the gesture a companion row already answers to. A press that then moves lifts the room: it is reduced to the stack of its companions, which follows the pointer while the row stays where it stood. Releasing reports the whole pinned zone through `onPinRoster` — the same call the menu branch makes for a companion, so a host writes one order rather than telling rooms and companions apart. The click a release would fire is swallowed, so a drag never doubles as opening the room.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		const handle = rowButton(rowFor(canvasElement, "Transport migration"))
		const shipping = dropAreaFor(canvasElement, "shipping")

		lift(handle)
		await expect(liftedBot()).not.toBeNull()

		moveOver(handle, shipping)
		await expect(isLightened(shipping)).toBe(true)

		dropOver(handle, shipping)
		await expect(args.onPinRoster).toHaveBeenCalledTimes(1)
		await expect(args.onSelectConversation).not.toHaveBeenCalled()
		await expect(liftedBot()).toBeNull()
	},
})

const SEARCH_TO_ROSTER_AIR = 9

export const WithSearch = meta.story({
	args: {
		botsBySpaceId: { perso: ROSTER },
		onOpenSearch: fn(),
		selectedSpaceId: "perso",
		spaces: [SPACES[0]],
	},
	parameters: {
		docs: {
			description: {
				story:
					"The roster with the search field mounted above it. Check that the field sits between the pinned header and the first row rather than inside either, so it never scrolls away with the list, that its box lands in the lane a roster row's fill holds — same start edge, same end edge — and that the column leaves 9px of air between the box and the first row's fill, so the field reads as its own box on the surface rather than a lid glued on top of the list. Pressing it reports and nothing else: the palette it opens is the host's to mount. A sidebar given no `onOpenSearch` draws no field at all, which is what `Roster` shows.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const slot = slotIn(canvasElement, "sidebar-search-field")
		const header = slotIn(canvasElement, "sidebar-header")
		const content = slotIn(canvasElement, "sidebar-content")

		await expect(
			header.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		await expect(
			content.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_PRECEDING,
		).toBeTruthy()
		await expect(header.contains(slot)).toBe(false)
		await expect(content.contains(slot)).toBe(false)

		const field = within(slot).getByRole("button", { name: /Search/ })
		const [first] = rowsIn(canvasElement)
		const fieldBox = field.getBoundingClientRect()
		const firstFill = rowButton(first).getBoundingClientRect()

		await expect(Math.round(fieldBox.left)).toBe(Math.round(firstFill.left))
		await expect(Math.round(fieldBox.right)).toBe(Math.round(firstFill.right))
		await expect(Math.round(firstFill.top - fieldBox.bottom)).toBe(
			SEARCH_TO_ROSTER_AIR,
		)

		await userEvent.click(field)
		await expect(args.onOpenSearch).toHaveBeenCalledTimes(1)
	},
})
