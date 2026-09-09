import { useState } from "react"
import { expect, fn, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
	FRAME_POLL,
	slotIn,
	slotsIn,
} from "@workspace/storybook/story-utils"
import { AppHeader } from "@workspace/ui/components/app-header"
import { Icons } from "@workspace/ui/components/icons"
import {
	CLOSED_MISSION,
	EARLIER_TODAY_ROWS,
	LATE_REPORTED_RUN,
	NO_EARLIER_TODAY,
	NO_MISSIONS,
	OPEN_MISSIONS,
	REPORTED_RUN,
	WAITING_HUMAN_MISSION,
} from "@workspace/ui/components/missions.fixtures"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import type { RoutineDetailModel } from "@workspace/ui/components/routine-detail"
import {
	EMPTY_ROUTINE_VALUES,
	type RoutineFormModel,
} from "@workspace/ui/components/routine-form"
import type { RoutineRowModel } from "@workspace/ui/components/routine-row"
import {
	CLEANUP_DETAIL,
	DIGEST_DETAIL,
	DIGEST_RUNS,
	INBOX_FORM,
	MORNING_DIGEST,
	RELEASE_WATCH,
	ROUTINES,
	SCHEDULED_FORM,
	SOURCE_NAMED_BY_ID,
	TRIGGER_SOURCES,
	WATCH_DETAIL,
	WATCHING_FORM,
} from "@workspace/ui/components/routines.fixtures"
import {
	RoutinesPanel,
	type RoutinesPanelProps,
	RoutinesPanelTrigger,
} from "@workspace/ui/components/routines-panel"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import { ThreadLayout } from "@workspace/ui/components/thread-layout"
import { AssistantTurn, UserTurn } from "@workspace/ui/components/turn"
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

const ANSWER =
	"Three routines watch this conversation: a digest, a changelog watch and a nightly cleanup."

const THREAD = (
	<ThreadLayout
		composer={<PromptInput onSubmit={fn()} />}
		header={<AppHeader trailing={<RoutinesPanelTrigger />} />}
	>
		<UserTurn>What runs on its own here?</UserTurn>
		<AssistantTurn copyText={ANSWER}>{ANSWER}</AssistantTurn>
	</ThreadLayout>
)

const FORMS: Record<string, RoutineFormModel> = {
	[MORNING_DIGEST.id]: SCHEDULED_FORM,
	[RELEASE_WATCH.id]: WATCHING_FORM,
	[SOURCE_NAMED_BY_ID.id]: INBOX_FORM,
}

const DETAILS: Record<string, RoutineDetailModel> = {
	[MORNING_DIGEST.id]: DIGEST_DETAIL,
	[RELEASE_WATCH.id]: WATCH_DETAIL,
	[SOURCE_NAMED_BY_ID.id]: CLEANUP_DETAIL,
}

const PanelHost = ({
	isOpen,
	routines,
	form,
	detail,
	...props
}: RoutinesPanelProps) => {
	const [open, setOpen] = useState(isOpen)
	const [held, setHeld] = useState(routines)
	const [shown, setShown] = useState<RoutineFormModel | null>(
		form?.open ?? null,
	)
	const [opened, setOpened] = useState<RoutineDetailModel | null>(
		detail?.open ?? null,
	)

	const answer = (id: string, isEnabled: boolean) =>
		setHeld((rows) =>
			rows.map((row) =>
				row.id === id
					? {
							...row,
							isEnabled,
							hasStoppedItself: row.hasStoppedItself && !isEnabled,
						}
					: row,
			),
		)

	return (
		<RoutinesPanel
			{...props}
			detail={
				detail && {
					...detail,
					onClose: () => {
						detail.onClose()
						setOpened(null)
					},
					onOpen: (routineId) => {
						detail.onOpen(routineId)
						setOpened(DETAILS[routineId] ?? null)
					},
					open: opened,
				}
			}
			form={
				form && {
					...form,
					onClose: () => {
						form.onClose()
						setShown(null)
					},
					onNew: () => {
						form.onNew()
						setShown({ id: null, values: EMPTY_ROUTINE_VALUES })
					},
					onOpen: (routineId) => {
						form.onOpen(routineId)
						setShown(FORMS[routineId] ?? null)
					},
					onSave: (values) => {
						form.onSave(values)
						setShown(null)
						setOpened((current) =>
							current ? { ...current, title: values.title } : current,
						)
					},
					open: shown,
				}
			}
			isOpen={open}
			onDelete={(id) => {
				props.onDelete(id)
				setHeld((rows) => rows.filter((row) => row.id !== id))
			}}
			onEnabledChange={(id, isEnabled) => {
				props.onEnabledChange(id, isEnabled)
				answer(id, isEnabled)
			}}
			onOpenChange={(next) => {
				props.onOpenChange(next)
				setOpen(next)
			}}
			routines={held}
		/>
	)
}

const NO_ROUTINES: RoutineRowModel[] = []

const NO_MISSION_AT_ALL = {
	open: NO_MISSIONS,
	earlierToday: NO_EARLIER_TODAY,
	onOpen: fn(),
}

const shownMissionRows = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "mission-row").filter((row) => row.checkVisibility())

const shownActivityRows = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="mission-row"], [data-slot="reported-run-row"]',
		),
	).filter((row) => row.checkVisibility())

const listNamedBy = (head: HTMLElement) => {
	const listId = head.getAttribute("aria-controls")
	const list = listId && head.ownerDocument.getElementById(listId)
	if (!list) throw new Error("the fold names no list of this document")
	return list
}

const openRoutines = async (
	canvasElement: HTMLElement,
	userEvent: { click: (element: Element) => Promise<void> },
) => {
	await userEvent.click(slotIn(canvasElement, "routines-entry"))
}

const WORKSPACE_SIDEBAR = (
	<Sidebar aria-label="Workspace" collapsible="icon" role="complementary">
		<SidebarHeader>
			<SidebarTrigger aria-label="Toggle workspace">
				<Icons.Sidebar className="size-4" />
			</SidebarTrigger>
		</SidebarHeader>
		<SidebarContent>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuRow label="Shift log">Shift log</SidebarMenuRow>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarContent>
	</Sidebar>
)

const CARD_GUTTER = 4

const renderInShell = (args: RoutinesPanelProps) => (
	<WorkspaceShell sidebar={WORKSPACE_SIDEBAR}>
		<PanelHost {...args} />
	</WorkspaceShell>
)

const meta = preview.meta({
	title: "Conversation/Routines/RoutinesPanel",
	component: RoutinesPanel,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The activity of one conversation, on the trailing edge of its thread: the missions running on it above the routines watching it, each list under its own section head. It carries a sidebar provider of its own, so opening or resizing it says nothing to the workspace sidebar on the other side of the window, and it owns no shortcut — the control in the thread header is the only way in and out. Closed, it takes no room at all and the transcript spans the thread. The lists are the whole surface: no mission running gets a dotted line rather than a gap, nothing at all gets an empty state rather than a bare list, a read that failed gets the failure and a retry rather than a list that looks empty, and a change that could not be written says so in its own words rather than borrowing the read's.",
			},
		},
	},
	args: {
		children: THREAD,
		detail: {
			onClose: fn(),
			onOpen: fn(),
			onRetryRuns: fn(),
			onRunNow: fn(),
			open: null,
		},
		failure: null,
		form: {
			canCreate: true,
			onClose: fn(),
			onNew: fn(),
			onOpen: fn(),
			onSave: fn(),
			open: null,
			sources: TRIGGER_SOURCES,
		},
		isOpen: true,
		missions: {
			open: OPEN_MISSIONS,
			earlierToday: EARLIER_TODAY_ROWS,
			onOpen: fn(),
		},
		onDelete: fn(),
		onEnabledChange: fn(),
		onOpenChange: fn(),
		onRetry: fn(),
		routines: ROUTINES,
	},
	render: (args) => <PanelHost {...args} />,
})

export const Default = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"Six missions of three bots, spread over the three groups the panel knows: what waits on the reader first, what is in progress under it, then what closed earlier today, folded. Check that every group carries its count, that the rows are bare — no border, no surface — that a mission closed earlier today keeps its rows out of sight until its head is opened, that no routine is listed in the body, and that the routines of the conversation sit behind the entry at the foot carrying their count.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const panel = canvas.getByRole("complementary", { name: "Activity" })
		await expect(panel).toBeVisible()
		await expect(
			within(panel).getByRole("button", { name: "Close activity" }),
		).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: "Activity" }),
		).not.toBeInTheDocument()

		await expect(
			canvas.getByRole("heading", { name: "Waiting on you" }),
		).toBeVisible()
		await expect(
			canvas.getByRole("heading", { name: "In progress" }),
		).toBeVisible()
		await expect(
			slotIn(canvasElement, "missions-waiting").compareDocumentPosition(
				slotIn(canvasElement, "missions-inProgress"),
			),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

		await expect(shownMissionRows(canvasElement)).toHaveLength(
			OPEN_MISSIONS.length,
		)
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(0)
		await expect(
			within(slotIn(canvasElement, "routines-entry")).getByText(
				String(ROUTINES.length),
			),
		).toBeVisible()
	},
})

export const OneMission = meta.story({
	args: {
		missions: {
			open: [WAITING_HUMAN_MISSION],
			earlierToday: NO_EARLIER_TODAY,
			onOpen: fn(),
		},
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A conversation holding one mission, and that mission waiting on the reader. Check that only the group it belongs to is drawn — a group with nothing in it is left out rather than shown empty — and that the row reads its bot, its ticket and its age on two lines.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(slotsIn(canvasElement, "mission-row")).toHaveLength(1)
		await expect(
			canvas.getByRole("heading", { name: "Waiting on you" }),
		).toBeVisible()
		await expect(
			canvas.queryByRole("heading", { name: "In progress" }),
		).not.toBeInTheDocument()
		await expect(
			canvas.queryByRole("button", { name: /Earlier today/ }),
		).not.toBeInTheDocument()
		await expect(canvas.getByText("Ada Martin")).toBeVisible()
		await expect(canvas.getByText("OPE-51")).toBeVisible()
	},
})

export const EarlierTodayUnfolded = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"What the conversation closed and what its routines reported since midnight, unfolded from their head. Check that the head reports itself expanded once activated, that closed missions and reported runs read as one list ordered most recent first, that a closed mission reads muted with the time of day it closed, that a reported run names its routine, its trigger, its bot and the word reported, and that a run row answers no pointer.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const head = canvas.getByRole("button", { name: /Earlier today/ })
		await expect(head).toHaveAttribute("aria-expanded", "false")

		await userEvent.click(head)
		await expect(head).toHaveAttribute("aria-expanded", "true")
		await expect(shownActivityRows(canvasElement)).toHaveLength(
			OPEN_MISSIONS.length + EARLIER_TODAY_ROWS.length,
		)

		const group = within(slotIn(canvasElement, "missions-earlierToday"))
		await expect(
			[
				LATE_REPORTED_RUN.routineTitle,
				CLOSED_MISSION.objective,
				REPORTED_RUN.routineTitle,
			].map((title) => group.getByText(title)),
		).toHaveLength(3)
		await expect(
			group
				.getByText(LATE_REPORTED_RUN.routineTitle)
				.compareDocumentPosition(group.getByText(CLOSED_MISSION.objective)),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
		await expect(
			group
				.getByText(CLOSED_MISSION.objective)
				.compareDocumentPosition(group.getByText(REPORTED_RUN.routineTitle)),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

		await expect(group.getByText("09:12")).toBeVisible()
		await expect(group.getByText(REPORTED_RUN.timestamp)).toBeVisible()
		await expect(group.getByText(REPORTED_RUN.triggerSourceTitle)).toBeVisible()
		await expect(group.getAllByText("reported")).toHaveLength(2)
		await expect(
			within(slotIn(canvasElement, "reported-run-row")).queryByRole("button"),
		).not.toBeInTheDocument()
	},
})

export const EarlierTodayFoldTarget = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The list the fold speaks for, in both of its states. Check that the id named by aria-controls resolves in the document while the group is folded as well as once it is unfolded, that the folded list is hidden from view and from assistive technology rather than removed, and that its rows stay out of the tab order until the group is opened.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const head = canvas.getByRole("button", { name: /Earlier today/ })
		const folded = listNamedBy(head)

		await expect(folded).not.toBeVisible()
		await expect(shownMissionRows(canvasElement)).toHaveLength(
			OPEN_MISSIONS.length,
		)

		head.focus()
		await userEvent.tab()
		await expect(head.ownerDocument.activeElement).not.toBe(
			folded.querySelector("button"),
		)

		await userEvent.click(head)
		await expect(listNamedBy(head)).toBe(folded)
		await expect(folded).toBeVisible()
		await expect(
			within(folded).getByText(CLOSED_MISSION.objective),
		).toBeVisible()
	},
})

export const Closed = meta.story({
	args: { isOpen: false },
	parameters: {
		docs: {
			description: {
				story:
					"The panel folded away. Check that the thread card takes the whole room the folded panel leaves, keeping nothing but its own gutter, that the control in the app header reports the panel closed rather than merely looking unpressed, that it points at nothing while there is nothing to point at — a folded panel is out of the document, so an `aria-controls` naming it would name an element a screen reader cannot reach — and that the panel is out of the document entirely rather than a column of no width.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const control = canvas.getByRole("button", { name: "Activity" })
		await expect(control).toHaveAttribute("aria-expanded", "false")
		await expect(control).not.toHaveAttribute("aria-controls")

		const thread = slotIn(canvasElement, "sidebar-inset")
		await expect(
			canvas.queryByRole("complementary", { name: "Activity" }),
		).toBeNull()
		await expect(thread.getBoundingClientRect().width).toBe(
			(thread.parentElement?.getBoundingClientRect().width ?? 0) -
				CARD_GUTTER * 2,
		)
	},
})

export const Toggling = meta.story({
	args: { isOpen: false },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The way in and the way out, each in its own place. Check that the control in the app header opens the panel and then leaves the header, that opening hands the keyboard to the close control inside the panel rather than dropping it on the body, that this control closes the panel, and that closing hands the keyboard back to the control in the app header.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Activity" }))
		await expect(args.onOpenChange).toHaveBeenCalledWith(true)

		const panel = canvas.getByRole("complementary", { name: "Activity" })
		await expect(panel.getBoundingClientRect().width).toBeGreaterThan(0)
		await expect(
			canvas.queryByRole("button", { name: "Activity" }),
		).not.toBeInTheDocument()

		const close = within(panel).getByRole("button", { name: "Close activity" })
		await waitFor(() => expect(close).toHaveFocus(), FRAME_POLL)

		await userEvent.click(close)
		await expect(args.onOpenChange).toHaveBeenCalledWith(false)

		const control = canvas.getByRole("button", { name: "Activity" })
		await expect(control).toHaveAttribute("aria-expanded", "false")
		await waitFor(() => expect(control).toHaveFocus(), FRAME_POLL)
	},
})

export const Empty = meta.story({
	args: { missions: NO_MISSION_AT_ALL, routines: NO_ROUTINES },
	parameters: {
		docs: {
			description: {
				story:
					"A conversation nothing runs on yet, neither mission nor routine. Check that the empty body names what would land here rather than showing three empty groups, that the entry at the foot still counts the routines it holds — none — and that the way to write the first routine is one screen behind it. Pick `NoMission` for a conversation whose routines are written but whose missions are all closed and gone.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await expect(canvas.getByText("Nothing is running here")).toBeVisible()
		await expect(slotsIn(canvasElement, "mission-row")).toHaveLength(0)
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(0)

		await openRoutines(canvasElement, userEvent)
		await expect(canvas.getByText("No routine yet")).toBeVisible()

		await userEvent.click(canvas.getByRole("button", { name: "New routine" }))
		await expect(slotIn(canvasElement, "routine-form")).toBeVisible()
	},
})

export const NoMission = meta.story({
	args: { missions: NO_MISSION_AT_ALL },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A conversation whose routines are written and whose missions are all closed before today. Check that the body reads as the empty one rather than as a blank column, and that the routines are still counted at the foot.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Nothing is running here")).toBeVisible()
		await expect(slotsIn(canvasElement, "mission-row")).toHaveLength(0)
		await expect(
			within(slotIn(canvasElement, "routines-entry")).getByText(
				String(ROUTINES.length),
			),
		).toBeVisible()
	},
})

export const OpeningTheRoutines = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The routines of the conversation, one screen behind the entry at the foot. Check that the entry pushes them over the panel rather than growing the body, that the missions are gone while they are up, that every routine row names its routine and the source that fires it — including the routine whose source no read named, which falls back to the source id rather than leaving the line blank — that flipping a switch reports the routine it belongs to, and that coming back hands the keyboard to the entry that opened it.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)

		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(
			ROUTINES.length,
		)
		await expect(slotsIn(canvasElement, "mission-row")).toHaveLength(0)
		await expect(canvas.getByText("Every day at 08:00")).toBeVisible()
		await expect(
			canvas.getByText(SOURCE_NAMED_BY_ID.triggerSourceTitle),
		).toBeVisible()

		await userEvent.click(
			canvas.getByRole("switch", { name: "Morning digest" }),
		)
		await expect(args.onEnabledChange).toHaveBeenCalledWith(
			"routine-morning-digest",
			false,
		)

		await userEvent.click(
			canvas.getByRole("button", { name: "Back to the activity" }),
		)
		await expect(shownMissionRows(canvasElement)).toHaveLength(
			OPEN_MISSIONS.length,
		)
		await waitFor(
			() => expect(slotIn(canvasElement, "routines-entry")).toHaveFocus(),
			FRAME_POLL,
		)
	},
})

export const OpeningAMission = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A mission picked from a group. Check that the whole row is what answers the pointer and the keyboard — the row carries no control of its own — that it reports the mission it belongs to rather than opening anything inside the panel, and that a row reached by keyboard wears a focus ring.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByText(WAITING_HUMAN_MISSION.objective))
		await expect(args.missions.onOpen).toHaveBeenCalledWith(
			WAITING_HUMAN_MISSION.id,
		)

		await userEvent.keyboard("{Enter}")
		await expect(args.missions.onOpen).toHaveBeenCalledTimes(2)

		const row = canvas
			.getByText(WAITING_HUMAN_MISSION.objective)
			.closest("button") as HTMLElement
		await expect(row).toHaveFocus()
		await expect(getComputedStyle(row).boxShadow).not.toBe("none")
	},
})

export const RoutinesReadFailed = meta.story({
	args: { failure: "routines", routines: NO_ROUTINES },
	parameters: {
		docs: {
			description: {
				story:
					"The routines could not be read, the missions could. Check that the notice names the routines rather than the activity as a whole, that the missions the app did read stay on screen under it, and that the retry is the only thing asked of the reader. Pick `MissionsReadFailed` for the other way round.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(canvas.getByText("Routines could not be read")).toBeVisible()
		await expect(
			canvas.queryByText("Missions could not be read"),
		).not.toBeInTheDocument()
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(0)

		await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
		await expect(args.onRetry).toHaveBeenCalled()
	},
})

export const MissionsReadFailed = meta.story({
	args: { failure: "missions", missions: NO_MISSION_AT_ALL },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The missions could not be read, the routines could. Check that the notice names the missions rather than blaming a routines read that never failed, that it sits above the body rather than inside a group, and that the routines the app did read are still counted at the foot.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Missions could not be read")).toBeVisible()
		await expect(
			canvas.queryByText("Routines could not be read"),
		).not.toBeInTheDocument()
		await expect(
			within(slotIn(canvasElement, "routines-entry")).getByText(
				String(ROUTINES.length),
			),
		).toBeVisible()
	},
})

export const ActivityReadFailed = meta.story({
	args: {
		failure: "activity",
		missions: NO_MISSION_AT_ALL,
		routines: NO_ROUTINES,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Neither read came back. Check that one notice covers both rather than two stacked on top of each other, that it takes the place of the empty state — a conversation whose activity could not be read has not lost it — and that its retry asks for both reads at once.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await expect(
			canvas.getByText("The activity of this conversation could not be read"),
		).toBeVisible()
		await expect(slotsIn(canvasElement, "chat-notice")).toHaveLength(1)
		await expect(
			canvas.queryByText("Nothing is running here"),
		).not.toBeInTheDocument()

		await userEvent.click(canvas.getByRole("button", { name: "Retry" }))
		await expect(args.onRetry).toHaveBeenCalled()
	},
})

export const WriteFailed = meta.story({
	args: { failure: "write" },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A switch that could not be written. Check that the panel says a change failed rather than blaming a read that never happened, that the notice follows the reader onto the routines screen, that the routines the app is holding stay on screen under it, and that the switch reads as it did before the attempt.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await expect(
			canvas.getByText("The routine could not be changed"),
		).toBeVisible()
		await expect(
			canvas.queryByText("Routines could not be read"),
		).not.toBeInTheDocument()
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(
			ROUTINES.length,
		)
	},
})

export const Creating = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The new routine action of the header, from the list to the empty form and back. Check that the form takes the place of the list inside the panel rather than opening a dialog over the thread, that the keyboard lands in the form when it opens, and that leaving hands focus back to the action that opened it with the list where it was. Pick `Editing` for the same form filled from a row.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await userEvent.click(canvas.getByRole("button", { name: "New routine" }))
		await expect(args.form?.onNew).toHaveBeenCalled()

		const form = canvas.getByRole("form", { name: "New routine" })
		await waitFor(() => expect(form).toHaveFocus(), FRAME_POLL)
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(0)
		await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument()

		await userEvent.click(
			canvas.getByRole("button", { name: "Back to the routines" }),
		)
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(
			ROUTINES.length,
		)
		await waitFor(
			() =>
				expect(
					canvas.getByRole("button", { name: "New routine" }),
				).toHaveFocus(),
			FRAME_POLL,
		)
	},
})

export const Opening = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A row picked from the list. Check that the detail takes the place of the list inside the panel, that it repeats the title and the trigger source the row carried rather than a shortened version of them, that the runs are read as it opens, that the close control still holds the end of the header row behind the back control, and that leaving returns focus to the row that opened it. Pick `Editing` for the form reached from here.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await userEvent.click(canvas.getByText("Morning digest"))
		await expect(args.detail?.onOpen).toHaveBeenCalledWith(MORNING_DIGEST.id)

		const detail = slotIn(canvasElement, "routine-detail")
		await waitFor(() => expect(detail).toHaveFocus(), FRAME_POLL)
		await expect(slotsIn(canvasElement, "routine-row")).toHaveLength(0)
		await expect(canvas.getByText("Every day at 08:00")).toBeVisible()
		await expect(slotsIn(canvasElement, "routine-run")).toHaveLength(
			DIGEST_RUNS.length,
		)

		const back = canvas.getByRole("button", { name: "Back to the routines" })
		await expect(
			back.compareDocumentPosition(
				slotIn(canvasElement, "routines-panel-close"),
			),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

		await userEvent.click(back)
		const rows = slotsIn(canvasElement, "routine-row")
		await expect(rows).toHaveLength(ROUTINES.length)
		await waitFor(
			() => expect(rows[0]?.querySelector("button[data-opens]")).toHaveFocus(),
			FRAME_POLL,
		)
	},
})

export const Editing = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The form as it is really reached: from the detail, not from the list. Check that it opens filled with that routine — its title, its expression, its trigger read as text rather than a list — that leaving it lands back on the detail rather than on the list two screens down, and that focus returns to the edit control that opened it. Pick `Saving` for what the detail shows once the form is submitted.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await userEvent.click(canvas.getByText("Morning digest"))
		await userEvent.click(canvas.getByRole("button", { name: "Edit routine" }))
		await expect(args.form?.onOpen).toHaveBeenCalledWith(MORNING_DIGEST.id)

		await expect(canvas.getByDisplayValue("Morning digest")).toBeVisible()
		await expect(canvas.getByDisplayValue("0 8 * * *")).toBeVisible()
		await expect(canvas.getByDisplayValue("On a schedule")).toHaveAttribute(
			"readonly",
		)

		await userEvent.click(
			canvas.getByRole("button", { name: "Back to the routine" }),
		)
		await expect(slotIn(canvasElement, "routine-detail")).toBeVisible()
		await waitFor(
			() =>
				expect(
					canvas.getByRole("button", { name: "Edit routine" }),
				).toHaveFocus(),
			FRAME_POLL,
		)
	},
})

export const Saving = meta.story({
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A routine renamed from the form the detail opened. Check that saving lands back on the detail rather than leaving the form on screen, and that the detail reads the title just saved while keeping the trigger source, which a written routine cannot change.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await userEvent.click(canvas.getByText("Morning digest"))
		await userEvent.click(canvas.getByRole("button", { name: "Edit routine" }))

		const title = canvas.getByLabelText("Title")
		await userEvent.clear(title)
		await userEvent.type(title, "Overnight digest")
		await userEvent.click(canvas.getByRole("button", { name: "Save routine" }))

		const detail = within(slotIn(canvasElement, "routine-detail"))
		await expect(detail.getByText("Overnight digest")).toBeVisible()
		await expect(detail.getByText("Every day at 08:00")).toBeVisible()
	},
})

export const RunNowFailed = meta.story({
	args: {
		detail: {
			onClose: fn(),
			onOpen: fn(),
			onRetryRuns: fn(),
			onRunNow: fn(),
			open: DIGEST_DETAIL,
		},
		failure: "write",
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A Run now the app could not even send. Check that the detail borrows the write failure the panel already carries rather than growing a notice of its own, that the notice sits above the detail with the history left as it was, and that the runs are not blamed for a failure that never reached them. Pick the `Error` story of `RoutineDetail` for the runs that could not be read.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByText("The routine could not be changed"),
		).toBeVisible()
		await expect(slotIn(canvasElement, "routine-detail")).toBeVisible()
		await expect(slotsIn(canvasElement, "routine-run")).toHaveLength(
			DIGEST_RUNS.length,
		)
	},
})

export const WithoutSeatedLead = meta.story({
	args: {
		form: {
			canCreate: false,
			onClose: fn(),
			onNew: fn(),
			onOpen: fn(),
			onSave: fn(),
			open: null,
			sources: TRIGGER_SOURCES,
		},
	},
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"A conversation with no lead bot seated: a routine written here would have nobody to run it. Check that the new routine action is left out of the routines screen rather than shown and refused on save, and that the routines already written stay readable and editable.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await openRoutines(canvasElement, userEvent)
		await expect(
			canvas.queryByRole("button", { name: "New routine" }),
		).not.toBeInTheDocument()
		await expect(canvas.getByText("Morning digest")).toBeVisible()
	},
})

export const InWorkspaceShell = meta.story({
	args: { isOpen: false },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The panel where it really lives: inside the shell, opposite the workspace sidebar. This is the one to open when the two panels are suspected of sharing a context. Check that opening the routines panel leaves the sidebar on the other side expanded and exactly as wide as it was: each panel carries a provider of its own, so neither open state can reach the other.",
			},
		},
	},
	render: renderInShell,
	play: async ({ canvas, userEvent }) => {
		const workspace = canvas.getByRole("complementary", { name: "Workspace" })
		const widthBefore = workspace.getBoundingClientRect().width

		await userEvent.click(canvas.getByRole("button", { name: "Activity" }))
		const panel = canvas.getByRole("complementary", { name: "Activity" })
		await waitFor(
			() => expect(panel.getBoundingClientRect().width).toBeGreaterThan(0),
			FRAME_POLL,
		)

		await expect(
			workspace.closest("[data-slot=sidebar]")?.getAttribute("data-state"),
		).toBe("expanded")
		await expect(workspace.getBoundingClientRect().width).toBe(widthBefore)
	},
})

const TRANSPARENT = "rgba(0, 0, 0, 0)"

const paintOf = (element: HTMLElement) =>
	getComputedStyle(element).backgroundColor

const shellPaint = () => {
	const swatch = document.createElement("div")
	swatch.className = "surface-shell"
	document.body.append(swatch)
	const painted = paintOf(swatch)
	swatch.remove()
	return painted
}

const cardIn = (canvasElement: HTMLElement) => {
	const cards = canvasElement.querySelectorAll<HTMLElement>(
		"[data-content-card]",
	)
	return cards[cards.length - 1] as HTMLElement
}

const panelSurfaceIn = (panel: HTMLElement) =>
	panel.querySelector<HTMLElement>('[data-slot="sidebar-inner"]') ?? panel

const expectPanelOnShellSurface = async (panel: HTMLElement) => {
	const surface = panelSurfaceIn(panel)
	const painted = getComputedStyle(surface)

	await expect(paintOf(surface)).toBe(TRANSPARENT)
	await expect(painted.borderInlineStartWidth).toBe("0px")
	await expect(paintOf(panel.parentElement as HTMLElement)).toBe(shellPaint())
}

const expectCardFramed = async (card: HTMLElement) => {
	const painted = getComputedStyle(card)

	await expect(painted.borderInlineEndWidth).toBe(
		painted.borderInlineStartWidth,
	)
	await expect(painted.borderStartEndRadius).toBe(
		painted.borderStartStartRadius,
	)
	await expect(painted.borderStartStartRadius).not.toBe("0px")
	await expect(painted.overflow).toBe("hidden")
	await expect(paintOf(card)).not.toBe(TRANSPARENT)
}

const activityPanelIn = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("complementary", { name: "Activity" })

const expectShellSurfaceAround = async (canvasElement: HTMLElement) => {
	const panel = activityPanelIn(canvasElement)
	const card = cardIn(canvasElement)

	await expectPanelOnShellSurface(panel)
	await expectCardFramed(card)

	await waitFor(async () => {
		const edges = card.getBoundingClientRect()
		const panelEdges = panel.getBoundingClientRect()
		await expect(panelEdges.left - edges.right).toBe(CARD_GUTTER)
		await expect(window.innerWidth - panelEdges.right).toBe(0)
	}, FRAME_POLL)
}

const OPEN_ON_SHELL_SURFACE =
	"The panel open on the shell surface: the surface reaches the trailing window edge and the thread floats on it as a single card, framed on the edge it shares with the panel exactly as on the edge it shares with the sidebar. Check that the panel paints no background and no border of its own, that the missions and the routines read against the shell surface as the sidebar rows do on the other side, and that the card keeps its gutter against the panel. Pick `OnShellSurfaceClosed` for the panel gone from the document."

const CLOSED_ON_SHELL_SURFACE =
	"The panel closed, which is what most of a session looks like: the thread card keeps the same gutter, radius, border and background it had before the panel existed, and the shell surface is all that shows around it. Check that the trailing gutter matches the leading one now that the panel is gone from the document. Pick `OnShellSurfaceOpen` for the panel holding room beside the card."

export const OnShellSurfaceOpen = meta.story({
	args: { isOpen: true },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: { description: { story: OPEN_ON_SHELL_SURFACE } },
	},
	render: renderInShell,
	play: async ({ canvasElement }) => {
		await expectShellSurfaceAround(canvasElement)
	},
})

export const OnShellSurfaceOpenDark = meta.story({
	args: { isOpen: true },
	globals: { theme: "dark" },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: { description: { story: OPEN_ON_SHELL_SURFACE } },
	},
	render: renderInShell,
	play: async ({ canvasElement }) => {
		await expectShellSurfaceAround(canvasElement)
	},
})

const expectShellSurfaceWithoutPanel = async (canvasElement: HTMLElement) => {
	const card = cardIn(canvasElement)

	await expect(
		within(canvasElement).queryByRole("complementary", { name: "Activity" }),
	).toBeNull()
	await expectCardFramed(card)

	const edges = card.getBoundingClientRect()
	await expect(window.innerWidth - edges.right).toBe(CARD_GUTTER)
	await expect(edges.top).toBe(CARD_GUTTER)
	await expect(window.innerHeight - edges.bottom).toBe(CARD_GUTTER)
}

export const OnShellSurfaceClosed = meta.story({
	args: { isOpen: false },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: { description: { story: CLOSED_ON_SHELL_SURFACE } },
	},
	render: renderInShell,
	play: async ({ canvasElement }) => {
		await expectShellSurfaceWithoutPanel(canvasElement)
	},
})

export const OnShellSurfaceClosedDark = meta.story({
	args: { isOpen: false },
	globals: { theme: "dark" },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: { description: { story: CLOSED_ON_SHELL_SURFACE } },
	},
	render: renderInShell,
	play: async ({ canvasElement }) => {
		await expectShellSurfaceWithoutPanel(canvasElement)
	},
})

export const OnShellSurfaceTinted = meta.story({
	args: { isOpen: true },
	parameters: {
		a11y: A11Y_CONTRAST_AWAITING_DESIGN_DECISION,
		docs: {
			description: {
				story:
					"The panel open in a space that carries a colour, which is the only state where the panel could betray the surface it sits on. Check that the panel is washed with exactly the tint the sidebar wears on the other side of the window and not with the untinted surface, so a panel that stops resolving the tint of the space in view reads as a plain grey column beside a coloured one. Pick `OnShellSurfaceOpen` for the untinted surface.",
			},
		},
	},
	render: (args) => (
		<WorkspaceShell sidebar={WORKSPACE_SIDEBAR} spaceTint="blue">
			<PanelHost {...args} />
		</WorkspaceShell>
	),
	play: async ({ canvas, canvasElement }) => {
		const panel = activityPanelIn(canvasElement)
		const shell = canvas.getByRole("main").parentElement as HTMLElement

		await expect(paintOf(panelSurfaceIn(panel))).toBe(TRANSPARENT)

		await waitFor(async () => {
			const tinted = paintOf(panel.parentElement as HTMLElement)
			await expect(tinted).toBe(paintOf(shell))
			await expect(tinted).not.toBe(shellPaint())
		}, FRAME_POLL)
	},
})
