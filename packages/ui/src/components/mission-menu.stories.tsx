import type { CSSProperties } from "react"
import { expect, fireEvent, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_FLOATING_FOCUS_GUARDS,
	A11Y_SUBMENU_PORTAL_GUARD,
	FRAME_POLL,
	mergeA11y,
	shown,
	slotIn,
	withStoryProps,
} from "@workspace/storybook/story-utils"
import type { MissionState } from "@workspace/ui/components/mission"
import { MissionCard } from "@workspace/ui/components/mission-card"
import {
	MissionMenu,
	type MissionMenuProps,
} from "@workspace/ui/components/mission-menu"
import { WAITING_MISSION_CARD } from "@workspace/ui/components/missions.fixtures"
import { ROUTINES_PANEL_WIDTH } from "@workspace/ui/components/routines-panel"
import { Sidebar, SidebarProvider } from "@workspace/ui/components/ui/sidebar"

type MissionMenuStoryArgs = Omit<MissionMenuProps, "children">

const MENU_LABEL = "Mission actions"

const OPEN_SHORTCUT = "↵"

const CLOSE_SHORTCUT = "⌘⌫"

const SUMMARY = "Shipped behind the flag"

const PANEL_WIDTH = {
	"--sidebar-width": `${ROUTINES_PANEL_WIDTH}px`,
} as CSSProperties

const LEADING_ENTRIES = ["Open mission↵", "Open in Linear"]

const OPEN_ENTRIES = [...LEADING_ENTRIES, "Copy"]

const AGENT_RUNNING_ENTRIES = [
	...OPEN_ENTRIES,
	"Message the agent",
	"Stop the agent",
	"Close mission⌘⌫",
]

const CLOSED_ENTRIES = [...OPEN_ENTRIES, "Reopen"]

const ENTRIES_WITHOUT_A_PULL_REQUEST: Record<MissionState, string[]> = {
	working: AGENT_RUNNING_ENTRIES,
	waiting_bot: AGENT_RUNNING_ENTRIES,
	waiting_human: [...OPEN_ENTRIES, "Answer the question", "Close mission⌘⌫"],
	ready_to_merge: [...OPEN_ENTRIES, "Close mission⌘⌫"],
	failed: CLOSED_ENTRIES,
	done: CLOSED_ENTRIES,
}

const entriesFor = (state: MissionState, hasPullRequest: boolean) => {
	const [open, ticket, ...rest] = ENTRIES_WITHOUT_A_PULL_REQUEST[state]
	return hasPullRequest
		? [open, ticket, "Open PR", ...rest]
		: [open, ticket, ...rest]
}

const cardIn = (state: MissionState, density: string) => ({
	...WAITING_MISSION_CARD,
	id: `mission-${state}-${density}`,
	state,
	isWorking: state === "working",
	isClosed: state === "done" || state === "failed",
})

const Densities = (args: MissionMenuStoryArgs) => (
	<div className="flex w-[36rem] max-w-full flex-col gap-6">
		<SidebarProvider style={PANEL_WIDTH}>
			<Sidebar collapsible="none">
				<ul className="flex flex-col gap-0.5">
					<MissionMenu {...args}>
						<MissionCard
							{...cardIn(args.state, "row")}
							density="row"
							onOpen={fn()}
						/>
					</MissionMenu>
				</ul>
			</Sidebar>
		</SidebarProvider>
		<MissionMenu {...args}>
			<MissionCard
				{...cardIn(args.state, "card")}
				density="card"
				onOpen={fn()}
			/>
		</MissionMenu>
	</div>
)

const openMenu = async () =>
	within(await shown(await screen.findByRole("menu", { name: MENU_LABEL })))

const entriesIn = async () =>
	(await openMenu()).getAllByRole("menuitem").map((item) => item.textContent)

const dismissMenu = async () => {
	fireEvent.keyDown(document.activeElement ?? document.body, {
		key: "Escape",
	})
	await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), FRAME_POLL)
}

const rowIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "mission-card-row")

const cardSurfaceIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "message-bubble-content")

const menuButtonIn = (surface: HTMLElement) =>
	within(surface).getByRole("button", { name: MENU_LABEL })

type EntriesCheck = {
	canvasElement: HTMLElement
	expected: string[]
}

const expectEntriesInBothDensities = async ({
	canvasElement,
	expected,
}: EntriesCheck) => {
	for (const surface of [rowIn(canvasElement), cardSurfaceIn(canvasElement)]) {
		fireEvent.contextMenu(surface, { clientX: 40, clientY: 20 })
		await expect(await entriesIn()).toEqual(expected)
		await dismissMenu()

		menuButtonIn(surface).click()
		await expect(await entriesIn()).toEqual(expected)
		await dismissMenu()
	}
}

const meta = preview.meta({
	title: "Overlays/MissionMenu",
	component: withStoryProps<MissionMenuStoryArgs>(MissionMenu),
	parameters: {
		layout: "centered",
		a11y: mergeA11y(A11Y_FLOATING_FOCUS_GUARDS, A11Y_SUBMENU_PORTAL_GUARD),
		docs: {
			description: {
				component:
					"Everything a person can do to one mission, in one menu. It wraps a `MissionCard` in either density: a right click on the card and a press on the trailing ellipsis it puts in the card's menu slot open the same list. Only the entries that apply to the mission's state are drawn, never a greyed one: Open mission and Open in Linear always, Open PR when there's a pull request, the Copy branch, Message the agent and Stop the agent while the agent runs, Answer the question while the mission waits on the person, then Close mission on an open mission or Reopen on a closed one. Close as done and Close as failed open a small popover under the card, with an optional summary and one confirm button. The component calls nothing on its own: every entry calls the callback it was given.",
			},
		},
	},
	args: {
		state: "working",
		hasPullRequest: true,
		hasBranch: true,
		hasWorkspacePath: true,
		openShortcut: OPEN_SHORTCUT,
		closeShortcut: CLOSE_SHORTCUT,
		onOpen: fn(),
		onOpenTicket: fn(),
		onOpenPullRequest: fn(),
		onCopy: fn(),
		onMessageAgent: fn(),
		onStopAgent: fn(),
		onAnswer: fn(),
		onClose: fn(),
		onReopen: fn(),
	},
	render: (args) => <Densities {...(args as MissionMenuStoryArgs)} />,
})

type StateStory = {
	state: MissionState
	hasPullRequest: boolean
	story: string
}

type StatePlay = {
	canvasElement: HTMLElement
}

const stateStoryOf = ({ state, hasPullRequest, story }: StateStory) => ({
	args: { state, hasPullRequest },
	parameters: { docs: { description: { story } } },
	play: async ({ canvasElement }: StatePlay) => {
		await expectEntriesInBothDensities({
			canvasElement,
			expected: entriesFor(state, hasPullRequest),
		})
	},
})

export const Working = meta.story(
	stateStoryOf({
		state: "working",
		hasPullRequest: true,
		story:
			"A mission the agent is working on, with a pull request. Check that a right click on the row and a press on the card's ellipsis both open the list Open mission, Open in Linear, Open PR, Copy, Message the agent, Stop the agent and Close mission, and that Open mission and Close mission carry their shortcut. Pick `WorkingWithoutAPullRequest` for the same mission before its pull request.",
	}),
)

export const WorkingWithoutAPullRequest = meta.story(
	stateStoryOf({
		state: "working",
		hasPullRequest: false,
		story:
			"A mission the agent is working on, before any pull request. Check that Open PR isn't drawn and that the rest of the list is the one `Working` draws.",
	}),
)

export const WaitingOnTheCompanion = meta.story(
	stateStoryOf({
		state: "waiting_bot",
		hasPullRequest: true,
		story:
			"A mission waiting on the companion. Check that it keeps Message the agent and Stop the agent, like a working mission.",
	}),
)

export const WaitingOnThePerson = meta.story(
	stateStoryOf({
		state: "waiting_human",
		hasPullRequest: true,
		story:
			"A mission blocked on the person. Check that Answer the question takes the place of the two agent entries.",
	}),
)

export const ReadyToMerge = meta.story(
	stateStoryOf({
		state: "ready_to_merge",
		hasPullRequest: true,
		story:
			"A mission ready to merge. Check that no agent entry and no Merge entry is drawn, and that Close mission is still there.",
	}),
)

export const Failed = meta.story(
	stateStoryOf({
		state: "failed",
		hasPullRequest: true,
		story:
			"A mission closed as failed. Check that Reopen takes the place of Close mission and that no Relaunch or Re-run entry is drawn.",
	}),
)

export const Done = meta.story(
	stateStoryOf({
		state: "done",
		hasPullRequest: true,
		story:
			"A mission closed as done, with its pull request. Check that Reopen takes the place of Close mission and that no Pin, Hide, Mark done or Delete worktree entry is drawn. Pick `DoneWithoutAPullRequest` for a mission closed with no pull request.",
	}),
)

export const DoneWithoutAPullRequest = meta.story(
	stateStoryOf({
		state: "done",
		hasPullRequest: false,
		story:
			"A mission closed as done with no pull request. Check that Open PR isn't drawn.",
	}),
)

const openSubmenu = async (label: string) => {
	const menu = await openMenu()
	fireEvent.click(menu.getByRole("menuitem", { name: new RegExp(`^${label}`) }))
	return within(
		await shown(
			(await screen.findAllByRole("menu")).find(
				(candidate) => candidate.getAttribute("aria-label") !== MENU_LABEL,
			) as HTMLElement,
		),
	)
}

export const CopyChoices = meta.story({
	args: { hasBranch: false, hasWorkspacePath: false, hasPullRequest: false },
	parameters: {
		docs: {
			description: {
				story:
					"The Copy branch on a mission with no branch, no workspace and no pull request. Check that it offers Issue ID alone, and that choosing it calls `onCopy` with `issue_id`. Branch, PR URL and Workspace path each appear only when the mission has one.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		fireEvent.contextMenu(rowIn(canvasElement), { clientX: 40, clientY: 20 })
		const copy = await openSubmenu("Copy")

		await expect(
			copy.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Issue ID"])
		fireEvent.click(copy.getByRole("menuitem", { name: "Issue ID" }))
		await expect(args.onCopy).toHaveBeenCalledWith("issue_id")
	},
})

export const EveryCopyChoice = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The Copy branch on a mission with a branch, a workspace and a pull request. Check the order Issue ID, Branch, PR URL, Workspace path, and that each calls `onCopy` with its own kind.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		fireEvent.contextMenu(rowIn(canvasElement), { clientX: 40, clientY: 20 })
		const copy = await openSubmenu("Copy")

		await expect(
			copy.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual(["Issue ID", "Branch", "PR URL", "Workspace path"])
		fireEvent.click(copy.getByRole("menuitem", { name: "Workspace path" }))
		await expect(args.onCopy).toHaveBeenCalledWith("workspace_path")
	},
})

const expectAnchoredTo = async (popover: HTMLElement, card: HTMLElement) => {
	const panel = popover.getBoundingClientRect()
	const anchor = card.getBoundingClientRect()
	const gap = Math.min(
		Math.abs(panel.top - anchor.bottom),
		Math.abs(anchor.top - panel.bottom),
	)

	await expect(gap).toBeLessThanOrEqual(8)
	await expect(Math.abs(panel.right - anchor.right)).toBeLessThanOrEqual(1)
}

const chooseCloseAs = async (canvasElement: HTMLElement, label: string) => {
	menuButtonIn(cardSurfaceIn(canvasElement)).click()
	const close = await openSubmenu("Close mission")

	await expect(
		close.getAllByRole("menuitem").map((item) => item.textContent),
	).toEqual(["Close as done", "Close as failed"])
	fireEvent.click(close.getByRole("menuitem", { name: label }))

	const popover = await shown(
		await waitFor(() => {
			const found = document.querySelector<HTMLElement>(
				'[data-slot="mission-close-popover"]',
			)
			if (!found) throw new Error("the close popover isn't open")
			return found
		}, FRAME_POLL),
	)
	await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), FRAME_POLL)
	return popover
}

export const ClosePopover = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The popover Close as done opens. Check that it hangs under the card rather than over a backdrop, that it holds one optional summary field and one confirm button, and that confirming calls `onClose` with `done` and the summary typed. Pick `ClosingWithoutASummary` for a confirm with the field left empty.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const popover = await chooseCloseAs(canvasElement, "Close as done")
		const panel = within(popover)
		const summary = panel.getByRole("textbox", { name: "Summary (optional)" })

		await waitFor(() => expect(summary).toHaveFocus(), FRAME_POLL)
		await expect(panel.getAllByRole("textbox")).toHaveLength(1)
		await expect(panel.getAllByRole("button")).toHaveLength(1)
		await expectAnchoredTo(popover, cardSurfaceIn(canvasElement))
		await expect(popover).not.toHaveAttribute("aria-modal", "true")

		await userEvent.type(summary, SUMMARY)
		await userEvent.click(panel.getByRole("button", { name: "Close mission" }))

		await expect(args.onClose).toHaveBeenCalledWith("done", SUMMARY)
		await waitFor(
			() => expect(menuButtonIn(cardSurfaceIn(canvasElement))).toHaveFocus(),
			FRAME_POLL,
		)
	},
})

const expectDismissedTo = async (
	canvasElement: HTMLElement,
	onClose: MissionMenuStoryArgs["onClose"] | undefined,
) => {
	await waitFor(
		() =>
			expect(
				document.querySelector('[data-slot="mission-close-popover"]'),
			).toBeNull(),
		FRAME_POLL,
	)
	await expect(onClose).not.toHaveBeenCalled()
	await waitFor(
		() => expect(menuButtonIn(cardSurfaceIn(canvasElement))).toHaveFocus(),
		FRAME_POLL,
	)

	const reopened = await chooseCloseAs(canvasElement, "Close as done")
	await expect(within(reopened).getByRole("textbox")).toHaveValue("")
}

export const DismissedByEscape = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The close popover dismissed with Escape after a summary was typed. Check that `onClose` isn't called, that focus goes back to the card's ellipsis, and that the summary field is empty the next time the popover opens.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const popover = await chooseCloseAs(canvasElement, "Close as done")

		await userEvent.type(within(popover).getByRole("textbox"), SUMMARY)
		await userEvent.keyboard("{Escape}")

		await expectDismissedTo(canvasElement, args.onClose)
	},
})

export const DismissedByAnOutsideClick = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The close popover dismissed by a click outside it after a summary was typed. Check that `onClose` isn't called, that focus goes back to the card's ellipsis, and that the summary field is empty the next time the popover opens.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const popover = await chooseCloseAs(canvasElement, "Close as done")

		await userEvent.type(within(popover).getByRole("textbox"), SUMMARY)
		await userEvent.click(document.body)

		await expectDismissedTo(canvasElement, args.onClose)
	},
})

export const ClosingWithoutASummary = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Close as failed confirmed with the summary left empty. Check that `onClose` is called with `failed` and the empty string.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const popover = await chooseCloseAs(canvasElement, "Close as failed")

		await userEvent.click(
			within(popover).getByRole("button", { name: "Close mission" }),
		)

		await expect(args.onClose).toHaveBeenCalledWith("failed", "")
	},
})

export const CloseFromTheKeyboard = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Cmd+Backspace pressed while the card's open button has focus. Check that the Close as done popover opens under the card with its summary field focused, and that confirming calls `onClose` with `done`.",
			},
		},
	},
	play: async ({ args, canvasElement, userEvent }) => {
		const surface = cardSurfaceIn(canvasElement)
		within(surface)
			.getByRole("button", { name: /^Open the mission/ })
			.focus()

		await userEvent.keyboard("{Meta>}{Backspace}{/Meta}")

		const popover = await shown(
			await waitFor(() => {
				const found = document.querySelector<HTMLElement>(
					'[data-slot="mission-close-popover"]',
				)
				if (!found) throw new Error("the close popover isn't open")
				return found
			}, FRAME_POLL),
		)
		const panel = within(popover)
		await expect(panel.getByText("Close as done")).toBeVisible()
		await waitFor(
			() => expect(panel.getByRole("textbox")).toHaveFocus(),
			FRAME_POLL,
		)

		await userEvent.click(panel.getByRole("button", { name: "Close mission" }))

		await expect(args.onClose).toHaveBeenCalledWith("done", "")
	},
})

export const KeyboardTrigger = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The ellipsis reached from the keyboard. Check that Tab lands on it with its name, that it draws the focus ring, and that Enter opens the menu.",
			},
		},
	},
	play: async ({ canvasElement, userEvent }) => {
		const button = menuButtonIn(rowIn(canvasElement))

		for (
			let presses = 0;
			presses < 10 && document.activeElement !== button;
			presses++
		)
			await userEvent.tab()

		await expect(button).toHaveAccessibleName(MENU_LABEL)
		await expect(button).toHaveAttribute("aria-haspopup", "menu")
		await expect(button).toHaveClass("focus-visible:ring-3")
		await expect(getComputedStyle(button).boxShadow).not.toBe("none")

		await userEvent.keyboard("{Enter}")
		await expect(await entriesIn()).toEqual(entriesFor("working", true))
	},
})
