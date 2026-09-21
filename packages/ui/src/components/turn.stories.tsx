import { useState } from "react"
import { expect, fireEvent, fn, screen, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	botIdentityAvatars,
	expectCompanionPictureSquare,
	shown,
	slotIn,
	slotsIn,
	UPLOADED_AVATAR_IMAGE,
} from "@workspace/storybook/story-utils"
import { ActivityIndicator } from "@workspace/ui/components/activity-indicator"
import {
	CompanionMenuContent,
	CompanionMenuProvider,
} from "@workspace/ui/components/companion-menu"
import { CompanionSelectProvider } from "@workspace/ui/components/companion-select"
import { MarkProvider } from "@workspace/ui/components/mark-context"
import { Markdown } from "@workspace/ui/components/markdown"
import type { MessageAuthor } from "@workspace/ui/components/message"
import { type RosterBot, RosterProvider } from "@workspace/ui/components/roster"
import type { RosterMenuSection } from "@workspace/ui/components/roster-menu-items"
import type { Space } from "@workspace/ui/components/space"
import {
	AssistantTurn,
	TURN_AVATAR_SIZE,
	type TurnCause,
	TurnGroup,
	type TurnState,
	UserTurn,
} from "@workspace/ui/components/turn"
import { Button } from "@workspace/ui/components/ui/button"

const ANSWER =
	"The workspace has two packages: `@workspace/ui` holds the design system, `app` holds the Tauri shell. Nothing crosses that line in the other direction."

const RUN = [
	"Two packages, and the line between them only runs one way.",
	"`@workspace/ui` holds the design system: primitives, tokens and the stories that document them.",
	"`app` holds the Tauri shell and consumes that system. Nothing goes back the other way.",
]

const QUEUED = "And then run the test suite once that lands."

const cancelQueued = fn()

const reply = fn()

const pin = fn()

const jumpToQuoted = fn()

const QUESTION = "Is any of that destructive?"

const KEPT_SKILL =
	"Atlas kept a skill. You can read it, and undo it, in its History."

const QUOTED_BOT = {
	author: "Skippy",
	excerpt: ANSWER,
	from: "assistant",
	onJump: jumpToQuoted,
} as const

const QUOTED_READER = {
	author: "You",
	excerpt: QUESTION,
	from: "user",
	onJump: jumpToQuoted,
} as const

const rightClickOn = async (target: HTMLElement) => {
	const bounds = target.getBoundingClientRect()
	const coords = { clientX: bounds.left + 8, clientY: bounds.top + 8 }

	fireEvent.pointerDown(target, { button: 2, ...coords })
	const defaulted = fireEvent.contextMenu(target, coords)

	return { defaulted }
}

const openTurnMenu = async (target: HTMLElement) => {
	await rightClickOn(target)
	return shown(await screen.findByRole("menu", { name: "Message actions" }))
}

const PASTED = `Walk me through every package.\n\nStart with the design system, then the Tauri shell, and call out anything that crosses between them.`

const TABLE_INTRO = "Here is what each chapter covers."

const TABLE = `| § | Subject |
| --- | --- |
| 1–2 | The right mental model |
| 3 | Context as a scarce resource |
| 4–5 | Framing a request, writing a ticket |`

const LEAD: MessageAuthor = {
	id: "bot-atlas",
	name: "Atlas",
	animal: "owl",
	blot: "blue",
	isLead: true,
}

const SECOND: MessageAuthor = {
	id: "bot-basile",
	name: "Basile",
	animal: "cat",
	blot: "purple",
}

const GONE: MessageAuthor = {
	id: "bot-elia",
	name: "Elia",
	animal: "mouse",
	isDeleted: true,
}

const ROOM: RosterBot[] = [LEAD, SECOND]

const RELEASE_MANAGER = "Release manager"

const TITLED_ROOM: { author: MessageAuthor; message: string }[] = [
	{
		author: { ...LEAD, title: "Ops" },
		message: "The release notes are ready to read.",
	},
	{
		author: SECOND,
		message: "The migration is green on a fresh database.",
	},
	{
		author: {
			id: "bot-elia",
			name: "Elia of the Migration and Release Desk",
			animal: "mouse",
			title: RELEASE_MANAGER,
		},
		message: "I am holding the tag until both of you sign off.",
	},
	{
		author: {
			id: "bot-nyx",
			name: "Nyx",
			animal: "bear",
			title: "Release manager for the whole platform",
		},
		message: "I will publish once the tag is cut.",
	},
]

const DELETED_TITLED: MessageAuthor = {
	...GONE,
	title: RELEASE_MANAGER,
}

const firstCharacterLeft = (element: HTMLElement) =>
	element.getBoundingClientRect().left +
	Number.parseFloat(getComputedStyle(element).paddingInlineStart)

const LEAD_RUN = [
	"I have the release notes. The migration is not mine.",
	"<@bot-basile> owns that script, and <@bot-elia> wrote the fixture it reads.",
]

const SECOND_REPLY =
	"Taken. The migration is green on a fresh database, so <@bot-atlas> can publish."

const MENTION_OPENING = "<@bot-basile> has the fixture."

const WORD_OPENING = "Basile has the fixture."

const GONE_REPLY =
	"The fixture still names the old columns. Somebody will have to rewrite it."

const TURN_STATES: TurnState[] = [
	"streaming",
	"complete",
	"cancelled",
	"failed",
]

const BOT: RosterBot = {
	id: "bot-skippy",
	name: "Skippy",
	animal: "owl",
	blot: "blue",
}

const NO_SPACES: Space[] = []

const NO_MEMBERSHIPS: string[] = []

const NO_SECTIONS: RosterMenuSection[] = []

const stopTurn = fn()

const expectNoStop = async (
	canvas: ReturnType<typeof within>,
	canvasElement: HTMLElement,
) => {
	const [gutter] = slotsIn(canvasElement, "message-gutter")

	await expect(canvas.queryByRole("button", { name: /^Stop/ })).toBeNull()
	await expect(gutter).toHaveAttribute("aria-hidden", "true")
}

const expectStop = async (
	canvas: ReturnType<typeof within>,
	canvasElement: HTMLElement,
) => {
	const [gutter] = slotsIn(canvasElement, "message-gutter")
	const stop = canvas.getByRole("button", { name: `Stop ${LEAD.name}` })

	await expect(gutter).not.toHaveAttribute("aria-hidden")
	stop.focus()
	await expect(stop).toHaveFocus()
}

const PICTURED: MessageAuthor = { ...LEAD, image: UPLOADED_AVATAR_IMAGE }

const PARTIAL = ANSWER.slice(0, 48)

type StoppableTurnProps = {
	state: TurnState
	stoppable?: boolean
	author?: MessageAuthor
}

const StoppableTurn = ({
	state,
	stoppable = false,
	author = LEAD,
}: StoppableTurnProps) => {
	const text = state === "cancelled" ? PARTIAL : ANSWER

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn
				author={author}
				copyText={text}
				onStop={stopTurn}
				state={state}
				stoppable={stoppable}
			>
				{text}
			</AssistantTurn>
		</div>
	)
}

const MARKED_BOT_ID = "bot-lyra"

const MARKED_FACE: RosterBot = {
	id: MARKED_BOT_ID,
	name: "Lyra",
	animal: "rabbit",
	blot: "purple",
}

const bubbleStyleOf = (node: Element) => {
	const bubble = node.closest<HTMLElement>(
		'[data-slot="message-bubble-content"]',
	)
	if (!bubble) throw new globalThis.Error("This node sits in no bubble")
	return getComputedStyle(bubble)
}

const MarkHandoff = () => {
	const [delivered, setDelivered] = useState(false)

	return (
		<MarkProvider>
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<Button
					size="sm"
					variant="outline"
					className="self-start"
					onClick={() => setDelivered(!delivered)}
				>
					{delivered ? "Rewind to working" : "Land the turn"}
				</Button>
				<UserTurn>How is this workspace laid out?</UserTurn>
				{delivered ? (
					<AssistantTurn
						botId={MARKED_BOT_ID}
						identity={MARKED_FACE}
						carriesMark
						copyText={ANSWER}
					>
						{ANSWER}
					</AssistantTurn>
				) : (
					<ActivityIndicator botId={MARKED_BOT_ID} kind="thinking" />
				)}
			</div>
		</MarkProvider>
	)
}

const TESTS =
	"Beside what they test: Vitest drives the stories in `@workspace/ui`, and `cargo test` covers the Tauri host."

const MarkedHistory = () => {
	const [working, setWorking] = useState(false)

	return (
		<MarkProvider>
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<Button
					size="sm"
					variant="outline"
					className="self-start"
					onClick={() => setWorking(!working)}
				>
					{working ? "Land the turn" : "Start a new turn"}
				</Button>
				<UserTurn>How is this workspace laid out?</UserTurn>
				<TurnGroup>
					<AssistantTurn
						botId={MARKED_BOT_ID}
						identity={MARKED_FACE}
						copyText={ANSWER}
					>
						{ANSWER}
					</AssistantTurn>
				</TurnGroup>
				<UserTurn>And where do the tests live?</UserTurn>
				<TurnGroup carriesMark>
					<AssistantTurn
						identity={working ? undefined : MARKED_FACE}
						botId={MARKED_BOT_ID}
						copyText={TESTS}
					>
						{TESTS}
					</AssistantTurn>
				</TurnGroup>
				{working ? (
					<ActivityIndicator botId={MARKED_BOT_ID} kind="thinking" />
				) : null}
			</div>
		</MarkProvider>
	)
}

const RENDERED_BY_THE_THREAD =
	"`apps/app/src/components/thread-turn.tsx:98` renders the companion row of every transcript, from the row `apps/app/src/lib/chat/screen-model.ts:101` publishes."

const STOPPED_BY_THE_SCREEN =
	"`apps/app/src/components/thread-screen.tsx:642` hands the row a stop for as long as the screen holds a seat for that companion, and `apps/app/src/components/thread-turn.tsx:67` turns it into `stoppable`, whatever state the row landed in."

const CAUSED_BY_THE_RUN =
	"`apps/app/src/components/thread-screen.tsx:637` passes the cause of the run, from the reported runs and the mission summons the thread holds."

const meta = preview.meta({
	title: "Conversation/Message/Turn",
	component: AssistantTurn,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"The two transcript rows, one per side. `UserTurn` is a bubble that can offer a retry when the prompt never reached Claude, and that holds the wait for a prompt written while another turn runs — `queued` draws it a step back from a sent prompt, with its own way out; `AssistantTurn` is a bubble on the other side with a gutter for the companion's avatar. Only the companions are named here — the reader's side carries no avatar at all. A long answer arrives as a run of rows, one per paragraph: wrap those in `TurnGroup` and it tells each row where it sits, so nothing counts rows by hand, and pass `identity` on the row that closes the run — a row with no `identity` falls back to the `author` it closes its run with, and both draw the same companion avatar. A block that already draws its own frame — a table — takes `bare`, which drops the bubble behind it rather than boxing the same grid twice. `copyText` is per bubble and holds that bubble's own words — a row handed an empty one, as a turn that stopped before writing is, offers no copy at all. Both take the transport's completion verbatim as `state`, so a screen maps nothing. A row given `onReply` reveals a second action ahead of copy, and a row given `repliedTo` is wrapped in the quote of the message it answers — both report to the screen and neither knows what is being quoted. `messageId` anchors the row so the scroller can be asked to bring it back, and it is set once per message: a message split into a run puts it on the group instead of on every paragraph. `stoppable` comes in from the screen and turns the gutter avatar into the stop for that one companion, so a wave is ended one seat at a time; it is never read off `state`, since a turn can be read back as `streaming` from a crash and stop nothing, and a row the screen still holds a seat for carries its stop whatever state it landed in, and it is named and shaped after the very identity the gutter draws, since a stop named after another companion stops the wrong one. `footer` puts a line of the screen's own under the bubble, in the very slot a completion label uses, so a row never carries two footers and the label wins whenever the state produces one. Neither scrolls or animates the list — that belongs to the scroller around them.",
			},
		},
	},
	args: { children: ANSWER, state: "complete", copyText: ANSWER },
})

export const Default = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText="How is this workspace laid out?">
				How is this workspace laid out?
			</UserTurn>
			<AssistantTurn copyText={ANSWER} identity={BOT}>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this for the nominal exchange: a prompt that landed and an answer that finished. Check that the prompt sits right with no avatar beside it while the answer sits left behind one, and that hovering either bubble fades in a copy action on its outer side — the reader's own words are as copyable as the companion's. Pick `Run` for an answer that arrived in several parts. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByLabelText("user message")).toBeVisible()
		await expect(canvas.getByLabelText("assistant message")).toBeVisible()
	},
})

export const Run = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<TurnGroup>
				<UserTurn copyText="How is this workspace laid out?">
					How is this workspace laid out?
				</UserTurn>
				<UserTurn copyText="Keep it short.">Keep it short.</UserTurn>
			</TurnGroup>
			<TurnGroup>
				{RUN.map((paragraph, index) => (
					<AssistantTurn
						key={paragraph}
						identity={index === RUN.length - 1 ? BOT : undefined}
						copyText={paragraph}
					>
						{paragraph}
					</AssistantTurn>
				))}
			</TurnGroup>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this for the shape a real answer takes: one paragraph per row, published as each one closes. Check that the run reads as one block — tight spacing, and the corner facing a neighbour pulled in to less than half the corner facing away, which is what makes the rows read as one bubble rather than three — and that a single avatar marks it from the last row while the rows above keep the gutter empty. Every bubble carries its own copy, and copying one takes that paragraph alone: there is no action anywhere for the answer entire, because the reader points at the part they want. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getAllByLabelText("assistant message")).toHaveLength(3)
		await expect(canvas.getAllByRole("button", { name: "Copy" })).toHaveLength(
			5,
		)

		const closing = canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="message-bubble-content"]',
		)[1]
		const corners = getComputedStyle(closing)
		await expect(Number.parseFloat(corners.borderEndEndRadius)).toBeGreaterThan(
			Number.parseFloat(corners.borderStartEndRadius) * 2,
		)
	},
})

export const Mark = meta.story({
	render: () => <MarkHandoff />,
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this to watch the companion's mark change homes. While the turn runs the mark belongs to the working row; when the turn lands that row goes and the closing `AssistantTurn` claims it in the gutter. Both name the same companion: the mark is that companion's, inside this transcript — `ThreadLayout` names the transcript for a real screen — and whichever of the two is on screen claims it, so it travels instead of blinking. Check that the avatar never disappears mid-move, that the bubble simply appears beside it while the row itself holds still, and that with reduced motion the mark simply arrives. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const marks = () =>
			canvasElement.querySelectorAll('[data-slot="shared-mark"]')

		await expect(marks()).toHaveLength(1)

		await userEvent.click(canvas.getByRole("button", { name: "Land the turn" }))
		await waitFor(() =>
			expect(getComputedStyle(canvas.getByText(ANSWER)).opacity).toBe("1"),
		)

		await expect(marks()).toHaveLength(1)

		const gutter = canvasElement.querySelector<HTMLElement>(
			'[data-slot="message-gutter"]',
		)
		const landed = gutter?.firstElementChild

		await expect(landed).toBeInTheDocument()
		await expect(gutter?.getBoundingClientRect().height).toBe(
			landed?.getBoundingClientRect().height,
		)
	},
})

export const MarkAcrossRuns = meta.story({
	render: () => <MarkedHistory />,
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this once the transcript has history: every answered run keeps its own avatar, but only the newest group is told `carriesMark`, so only its closing row answers to the transcript's mark. Start a new turn and check that the mark leaves the newest gutter for the working row while the avatar above it does not budge. Pick `Mark` for the handoff itself, and `Primitives/SharedMark` for the invariant underneath it. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const gutterAvatars = () =>
			canvasElement.querySelectorAll('[data-slot="message-gutter"] > *')
		const marked = () => canvasElement.querySelectorAll('[data-state="marked"]')

		await expect(gutterAvatars()).toHaveLength(2)
		await expect(marked()).toHaveLength(1)

		const settled = gutterAvatars()[0].getBoundingClientRect()

		await userEvent.click(
			canvas.getByRole("button", { name: "Start a new turn" }),
		)
		await waitFor(() => expect(gutterAvatars()).toHaveLength(1))

		await expect(marked()).toHaveLength(1)
		await expect(gutterAvatars()[0].getBoundingClientRect().top).toBe(
			settled.top,
		)
	},
})

export const Variants = meta.story({
	tags: ["test-only"],
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			{TURN_STATES.map((state) => {
				const text = state === "streaming" ? ANSWER.slice(0, 48) : ANSWER
				return (
					<AssistantTurn
						key={state}
						state={state}
						copyText={text}
						identity={BOT}
					>
						{text}
					</AssistantTurn>
				)
			})}
			<AssistantTurn state="cancelled" copyText="" identity={BOT}>
				{""}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Every completion the transport can report, in order, then the row a turn stopped before writing anything leaves behind. Check that `cancelled` keeps the partial text it had when Stop was pressed and marks it `Stopped` rather than treating it as an error, that `failed` still offers its copy since the words it did write are worth taking, and that the empty row is the only one without one — an empty bubble has nothing to hand over. Pick `Error` for the user side of a prompt that never reached Claude at all. The four states are stacked in a column no transcript assembles, and `streaming` is in it only to keep the list exhaustive: `apps/app/src/lib/chat/screen-model.ts:102` closes every block it publishes, so no row ever reaches a screen while its answer is still arriving. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getAllByRole("button", { name: "Copy" })).toHaveLength(
			4,
		)
	},
})

export const Table = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText="What does the guide cover?">
				What does the guide cover?
			</UserTurn>
			<TurnGroup>
				<AssistantTurn copyText={TABLE_INTRO}>{TABLE_INTRO}</AssistantTurn>
				<AssistantTurn bare copyText={TABLE} identity={BOT}>
					<Markdown>{TABLE}</Markdown>
				</AssistantTurn>
			</TurnGroup>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this for the row a table lands in. A table frames and fills itself, so the row is `bare`: no bubble behind it, no padding around it, and one box around the grid instead of two. Check that the sentence above it keeps its bubble, that the table sits flush against the gutter and still marks the run with its avatar, and that the row's copy stays beside the frame rather than out at the edge of the transcript. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas }) => {
		const table = canvas.getByRole("group", { name: "Table" })

		await expect(table).toBeVisible()
		await expect(
			bubbleStyleOf(canvas.getByText(TABLE_INTRO)).paddingLeft,
		).not.toBe("0px")
		await expect(bubbleStyleOf(table).paddingLeft).toBe("0px")
	},
})

export const Error = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn
				state="failed"
				copyText="How is this workspace laid out?"
				onRetry={fn()}
			>
				How is this workspace laid out?
			</UserTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this when the write to the CLI was rejected, so the prompt exists in the transcript but Claude never saw it. Both actions live left of the bubble, on the outer side as on every row, but they do not behave alike: the retry is pinned, since a way out nobody can see is not offered at all, while the copy stays behind a hover like every other. Check that the retry is there before the pointer is, that it sits nearest the bubble, and that the text is preserved verbatim for the resend. Pick `Variants` when Claude did answer and it was the turn that failed. `apps/app/src/components/thread-turn.tsx:81` renders the reader row of every transcript.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const retry = canvas.getByRole("button", { name: "Retry" })

		await expect(retry).toBeVisible()

		await userEvent.click(retry)
		await waitFor(() => expect(retry).toBeVisible())
	},
})

export const LongContent = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText={PASTED}>{PASTED}</UserTurn>
			<AssistantTurn copyText={`${ANSWER}\n\n${ANSWER}`} identity={BOT}>
				{`${ANSWER}\n\n${ANSWER}`}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"Reach for this to check the two multi-line paths: a pasted prompt keeps its blank lines in one bubble, and a companion row that was handed more than one paragraph still renders them verbatim. Check that both bubbles stop widening at their cap. Pick `Run` for the split the screen normally performs before it gets here. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
})

export const Pending = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText={ANSWER}>{ANSWER}</UserTurn>
			<UserTurn state="queued" copyText={QUEUED} onCancel={cancelQueued}>
				{QUEUED}
			</UserTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The composer stays writable while a turn runs, so a prompt that cannot be sent yet waits here instead. A sent prompt tops the stack, then the `queued` one below it: one step back from the reader's own fill, a spinner beside it and its footer naming the wait. Check that the queued row offers no retry, that its cancel is pinned rather than waiting for a hover, and that only the spinner moves. Pick `Error` for a prompt that was sent and never landed. `apps/app/src/components/thread-turn.tsx:81` renders the reader row of every transcript.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		cancelQueued.mockClear()

		const cancel = canvas.getByRole("button", { name: "Cancel this message" })

		await expect(slotsIn(canvasElement, "turn-pending-spinner")).toHaveLength(1)
		await expect(cancel).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: "Retry" }),
		).not.toBeInTheDocument()
		await expect(canvas.getByText("Waiting to be sent")).toBeVisible()

		await userEvent.click(cancel)
		await expect(cancelQueued).toHaveBeenCalledTimes(1)
	},
})

export const Reply = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText={QUESTION} onReply={reply}>
				{QUESTION}
			</UserTurn>
			<AssistantTurn copyText={ANSWER} identity={BOT} onReply={reply}>
				{ANSWER}
			</AssistantTurn>
			<AssistantTurn copyText={TESTS} identity={BOT}>
				{TESTS}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The affordance that starts a reply, on both sides of the transcript: a row given `onReply` reveals it beside copy on hover or on keyboard focus, and the last row here, given none, offers nothing at all — a screen that cannot answer a message must not draw the invitation. Check that pressing it reports the row it belongs to and changes nothing in the transcript: staging the reply is the screen's business, and `AI/PromptReply` is where it lands. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		reply.mockClear()

		const replies = canvas.getAllByRole("button", { name: "Reply" })

		await expect(replies).toHaveLength(2)

		await userEvent.click(replies[0])
		await expect(reply).toHaveBeenCalledTimes(1)
	},
})

export const Pinned = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText={QUESTION} onReply={reply} onPin={pin}>
				{QUESTION}
			</UserTurn>
			<AssistantTurn
				copyText={ANSWER}
				identity={BOT}
				onReply={reply}
				pinned
				onPin={pin}
			>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The bookmark a reader drops on a row, beside the reply it sits next to. A row given `onPin` offers it on hover or on keyboard focus like the rest; a row already pinned keeps the control on screen without hover and names it `Unpin`, so the transcript shows at a glance what is bookmarked. Pressing it reports the row and changes nothing here — holding the list is the screen's business, and `AI/PinnedMessages` is where it reads. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		pin.mockClear()

		const unpin = canvas.getByRole("button", { name: "Unpin" })

		await expect(unpin).toBeVisible()
		await expect(unpin).not.toHaveClass(/opacity-0/)

		await userEvent.click(canvas.getByRole("button", { name: "Pin" }))
		await expect(pin).toHaveBeenCalledTimes(1)
	},
})

export const Menu = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<UserTurn copyText={QUESTION} onReply={reply} onPin={pin}>
				{QUESTION}
			</UserTurn>
			<AssistantTurn
				copyText={ANSWER}
				identity={BOT}
				onReply={reply}
				pinned
				onPin={pin}
			>
				{ANSWER}
			</AssistantTurn>
			<AssistantTurn identity={BOT}>{TESTS}</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The same actions the hover row offers, reached by right-clicking the bubble instead of hunting for a button: pin, then reply and copy behind a separator, each carrying the icon and the label its button carries — a pinned row says `Unpin` in both places. A row is handed only the actions it was given a handler for, and the last row here, given none at all, keeps the browser's own menu rather than drawing an empty one. Check that the menu grows out of the pointer, that choosing a row reports it and closes, and that right-clicking a second bubble hands the menu over rather than leaving two open. The bubble stays selectable under the menu, because a reader copies a passage of an answer far more often than they right-click it; the registry trigger's own `select-none` is overridden here and only comes back on a coarse pointer, where a drag is a scroll and a long press is the way in. That coarse branch is a media query the runner cannot emulate, so the play reads the rule rather than the effect. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		reply.mockClear()

		const surface = slotIn(canvasElement, "message-actions")

		await expect(getComputedStyle(surface).userSelect).toBe("text")
		await expect(surface.className).toContain("pointer-coarse:select-none")

		const menu = await openTurnMenu(canvas.getByText(QUESTION))
		const items = within(menu).getAllByRole("menuitem")

		await expect(items.map((item) => item.textContent)).toEqual([
			"Pin",
			"Reply",
			"Copy",
		])
		await expect(within(menu).getByRole("separator")).toBeInTheDocument()

		const pinned = await openTurnMenu(canvas.getByText(ANSWER))

		await expect(screen.getAllByRole("menu")).toHaveLength(1)
		await expect(
			within(pinned).getByRole("menuitem", { name: "Unpin" }),
		).toBeVisible()

		await userEvent.click(
			within(pinned).getByRole("menuitem", { name: "Reply" }),
		)
		await expect(reply).toHaveBeenCalledTimes(1)
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())

		const { defaulted } = await rightClickOn(canvas.getByText(TESTS))

		await expect(defaulted).toBe(true)
		await expect(screen.queryByRole("menu")).toBeNull()
	},
})

export const Quoted = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn copyText={ANSWER} identity={BOT}>
				{ANSWER}
			</AssistantTurn>
			<UserTurn copyText={QUESTION} repliedTo={QUOTED_BOT}>
				{QUESTION}
			</UserTurn>
			<AssistantTurn copyText={TESTS} identity={BOT} repliedTo={QUOTED_READER}>
				{TESTS}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A message that answers another one is wrapped in a frame that carries the quote above the bubble, both on the same secondary fill. Check that the frame hugs the bubble on both sides of the transcript, that the excerpt stays on one line whatever it quotes, and that pressing it asks the screen to jump rather than moving anything here. Pick `AI/MessageScroller → Jump` for the other end of that request. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		jumpToQuoted.mockClear()

		const quotes = canvas.getAllByRole("button", { name: /Skippy|You/ })

		await expect(quotes).toHaveLength(2)

		await userEvent.click(quotes[0])
		await expect(jumpToQuoted).toHaveBeenCalledTimes(1)
	},
})

export const Authored = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A conversation held by several bots, where every row has to say who wrote it. Hand `AssistantTurn` an `author` and it names the bot above the bubble and draws that bot's avatar in the gutter — the row keeps the gutter it always had, so nothing is passed twice. The bot that leads wears a crown beside its name. In a run the name is written once, on the row that opens it, while the avatar stays on the row that closes it: the block reads as one bot speaking, not as the same name repeated. `<@bot-id>` in the text is drawn as a chip by `Markdown`, resolved against `RosterProvider`, and an id the conversation does not know still draws as an unknown bot rather than leaking the raw text. Check that Atlas is named once over its two rows, that the crown is on Atlas alone, and that a message from a conversation with a single bot — every other story here — is untouched by all of this. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<RosterProvider bots={ROOM}>
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<UserTurn>Who is taking the migration?</UserTurn>
				<TurnGroup>
					{LEAD_RUN.map((paragraph) => (
						<AssistantTurn key={paragraph} author={LEAD} copyText={paragraph}>
							<Markdown>{paragraph}</Markdown>
						</AssistantTurn>
					))}
				</TurnGroup>
				<AssistantTurn author={SECOND} copyText={SECOND_REPLY}>
					<Markdown>{SECOND_REPLY}</Markdown>
				</AssistantTurn>
			</div>
		</RosterProvider>
	),
	play: async ({ canvas, canvasElement }) => {
		const named = [
			...canvasElement.querySelectorAll('[data-slot="message-author"]'),
		].map((header) => header.textContent)

		await expect(named).toHaveLength(2)
		await expect(named[0]).toContain("Atlas")
		await expect(named[1]).toContain("Basile")
		await expect(
			canvasElement.querySelectorAll('[data-slot="message-author-lead"]'),
		).toHaveLength(1)
		await expect(canvas.getByText("Unknown companion")).toBeVisible()

		const [name] = canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="message-author"]',
		)
		const [bubble] = canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="message-content"]:has([data-slot="message-author"]) [data-slot="message-bubble-content"]',
		)
		await expect(firstCharacterLeft(name)).toBeCloseTo(
			firstCharacterLeft(bubble),
			0,
		)
	},
})

export const Titled = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A conversation where three of the four companions carry a title. The title is written in a pill right after the name, the same pill the roster row wears, so a reader tells an ops companion from a release companion without opening the roster. A companion with no title keeps the bare name, no pill and no gap held for one. The column here is 320px wide on purpose: the pill has no width cap of its own, so a long title is written whole beside a short name, gives way beside a name long enough to fill the line, and never pushes the crown or the header out of the column. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<div className="flex w-80 flex-col gap-6">
			{TITLED_ROOM.map(({ author, message }) => (
				<AssistantTurn author={author} copyText={message} key={author.id}>
					{message}
				</AssistantTurn>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const headers = slotsIn(canvasElement, "message-author")
		const [titled, untitled, longName, longTitle] = headers

		await expect(headers).toHaveLength(4)
		await expect(slotIn(titled, "bot-title-badge")).toHaveTextContent("Ops")
		await expect(
			untitled.querySelector('[data-slot="bot-title-badge"]'),
		).toBeNull()

		const yielded = slotIn(longName, "bot-title-badge")
		const name = longName.firstElementChild as HTMLElement

		await expect(yielded).toHaveTextContent(RELEASE_MANAGER)
		await expect(yielded.scrollWidth).toBeGreaterThan(yielded.clientWidth)
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)

		const room = slotIn(longTitle, "bot-title-badge")

		await expect(room.scrollWidth).toBeLessThanOrEqual(room.clientWidth)

		const column = slotIn(canvasElement, "message").parentElement as HTMLElement

		for (const header of headers) {
			await expect(header.getBoundingClientRect().right).toBeLessThanOrEqual(
				column.getBoundingClientRect().right,
			)
		}
	},
})

export const TitledDeleted = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"An author deleted since it wrote, still carrying its title. The name dims, and the pill dims with it, so the two read as one line written by someone who has left rather than a dead name next to a live label. Check that the pill sits at the same weight as the name, before the bin, and that the message under it stays as readable as any other. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn author={DELETED_TITLED} copyText={ANSWER}>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const header = slotIn(canvasElement, "message-author")
		const badge = slotIn(header, "bot-title-badge")
		const name = header.firstElementChild as HTMLElement

		await expect(badge).toHaveTextContent(RELEASE_MANAGER)
		await expect(getComputedStyle(badge).color).toBe(
			getComputedStyle(name).color,
		)
		await expect(slotIn(header, "message-author-deleted")).toBeVisible()
	},
})

export const OpenedByMention = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A bubble whose first word is a companion. A mention is taller than the words around it, so a bubble that opens with one is padded evenly on the four sides instead of pressing the chip against its top edge — the space above the mention, below it and to its left is the same. A bubble that opens with words keeps the padding it always had, which is what the second row here is for. Check that the two bubbles read as the same bubble, one holding a chip and the other holding a sentence. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<RosterProvider bots={ROOM}>
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<AssistantTurn copyText={MENTION_OPENING} identity={BOT}>
					<Markdown>{MENTION_OPENING}</Markdown>
				</AssistantTurn>
				<AssistantTurn copyText={WORD_OPENING} identity={BOT}>
					<Markdown>{WORD_OPENING}</Markdown>
				</AssistantTurn>
			</div>
		</RosterProvider>
	),
	play: async ({ canvas, canvasElement }) => {
		const chip = canvasElement.querySelector<HTMLElement>(
			'[data-slot="bot-mention"]',
		)
		const bubble = chip?.closest<HTMLElement>(
			'[data-slot="message-bubble-content"]',
		)

		if (!chip || !bubble) throw new globalThis.Error("The bubble drew no chip")

		const around = bubble.getBoundingClientRect()
		const mention = chip.getBoundingClientRect()
		const left = mention.left - around.left

		await expect(mention.top - around.top).toBeCloseTo(left, 0)
		await expect(around.bottom - mention.bottom).toBeCloseTo(left, 0)

		const words = bubbleStyleOf(canvas.getByText(WORD_OPENING))

		await expect(words.paddingLeft).toBe(`${Math.round(left)}px`)
		await expect(words.paddingTop).toBe("10px")
	},
})

export const DeletedAuthor = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The companion that wrote this was deleted since. Its message is history and stays legible: the bubble is the ordinary one, only the name is dimmed and marked with a bin so a reader knows nobody is behind it any more. The mark is an icon in the line and *Deleted companion* under it — on hover, and to a screen reader — so the row keeps its length and still says what it means. Check that the icon reads as a state rather than an action nobody can take, and that the row copies and quotes like any other. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<RosterProvider bots={ROOM}>
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<AssistantTurn author={GONE} copyText={GONE_REPLY}>
					{GONE_REPLY}
				</AssistantTurn>
			</div>
		</RosterProvider>
	),
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-slot="message-author-deleted"]'),
		).toHaveAttribute("title", "Deleted companion")
		await expect(canvas.getByText(GONE_REPLY)).toBeVisible()
	},
})

export const CompleteStoppable = meta.story({
	render: () => <StoppableTurn state="complete" stoppable />,
	parameters: {
		docs: {
			description: {
				story:
					"The landed answer of a companion the screen still holds a seat for: `stoppable` turns the gutter avatar into the same control the waiting seat carries, named after the companion, and opens the gutter to assistive technology so the control can be reached at all. The wave keeps running around it — this stop ends one companion. Check that the control is the size of the avatar it rides, that pointing at it or reaching it by keyboard veils the animal with the stop glyph, that the ring shows where focus landed, and that pressing it reports the stop. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		stopTurn.mockClear()

		const stop = canvas.getByRole("button", { name: "Stop Atlas" })
		const [glyph] = slotsIn(canvasElement, "bot-working-stop-glyph")

		await expectStop(canvas, canvasElement)
		await expect(Math.round(stop.getBoundingClientRect().height)).toBe(
			TURN_AVATAR_SIZE,
		)
		await waitFor(() => expect(glyph).toBeVisible())

		await userEvent.click(stop)
		await expect(stopTurn).toHaveBeenCalledTimes(1)
	},
})

export const CompleteNotStoppable = meta.story({
	render: () => <StoppableTurn state="complete" />,
	parameters: {
		docs: {
			description: {
				story:
					"The same landed answer once the screen holds no seat for its companion, which is what a reopened conversation shows: the row still holds an `onStop`, and it draws no control, since the stop follows `stoppable` and never the handler. Check that the gutter is a drawing, hidden from assistive technology, with no button to reach. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expectNoStop(canvas, canvasElement)
	},
})

export const CancelledStoppable = meta.story({
	render: () => <StoppableTurn state="cancelled" stoppable />,
	parameters: {
		docs: {
			description: {
				story:
					"The turn that was already stopped, while the screen still says the companion can be stopped: the row keeps the words it had written and its `Stopped` footer, and the gutter still carries the control. The screen drops `stoppable` when it drops the seat, and the row follows. Check that the footer reads `Stopped`, that the control named after the companion is there, and that Tab reaches it. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Stopped")).toBeVisible()
		await expectStop(canvas, canvasElement)
	},
})

export const FailedStoppable = meta.story({
	render: () => <StoppableTurn state="failed" stoppable />,
	parameters: {
		docs: {
			description: {
				story:
					"The turn the transport gave up on, while the screen still says the companion can be stopped: the row keeps its failure footer and its copy, and the gutter still carries the control, since the state a row landed in never decides what the gutter draws. Check that the failure footer is there and that the control named after the companion is reachable by keyboard. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("This response failed")).toBeVisible()
		await expectStop(canvas, canvasElement)
	},
})

const accessibleNameOf = (mark: HTMLElement) => {
	const label = mark.getAttribute("aria-label")
	if (!label) throw new globalThis.Error("This mark carries no accessible name")
	return label
}

export const StoppableSameBotEitherWay = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-4xl gap-6">
			<div data-slot="author-named-row" className="min-w-0 flex-1">
				<AssistantTurn
					author={LEAD}
					copyText={PARTIAL}
					onStop={stopTurn}
					state="cancelled"
					stoppable
				>
					{PARTIAL}
				</AssistantTurn>
			</div>
			<div data-slot="identity-named-row" className="min-w-0 flex-1">
				<AssistantTurn
					copyText={PARTIAL}
					identity={LEAD}
					onStop={stopTurn}
					state="cancelled"
					stoppable
				>
					{PARTIAL}
				</AssistantTurn>
			</div>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The same companion reaching the gutter by either road: the row on the leading edge is named by `author`, the row beside it by `identity`, and nothing else differs. Check that both gutters draw the very same mark and offer a stop under the same name, and that only the `author` row carries the name line above its bubble, since `identity` says who is drawn and never who is speaking. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const authored = within(slotIn(canvasElement, "author-named-row"))
		const identified = within(slotIn(canvasElement, "identity-named-row"))
		const animal = new RegExp(LEAD.animal ?? "")
		const authoredMark = authored.getByRole("img", { name: animal })

		await expect(
			identified.getByRole("img", { name: animal }),
		).toHaveAccessibleName(accessibleNameOf(authoredMark))
		await expect(
			authored.getAllByRole("button", { name: `Stop ${LEAD.name}` }),
		).toHaveLength(1)
		await expect(
			identified.getAllByRole("button", { name: `Stop ${LEAD.name}` }),
		).toHaveLength(1)

		const nameLines = slotsIn(
			slotIn(canvasElement, "author-named-row"),
			"message-author",
		)

		await expect(nameLines).toHaveLength(1)
		await expect(nameLines[0]).toHaveTextContent(LEAD.name)
		await expect(
			slotsIn(slotIn(canvasElement, "identity-named-row"), "message-author"),
		).toHaveLength(0)
	},
})

export const StoppableOtherIdentity = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn
				author={LEAD}
				copyText={PARTIAL}
				identity={SECOND}
				onStop={stopTurn}
				state="cancelled"
				stoppable
			>
				{PARTIAL}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A row whose two identities disagree: `author` names the companion the words are attributed to, `identity` names the face the screen wants in the gutter, and the screen is free to send both. The gutter answers to `identity` alone — avatar, stop name and veil — while the line above the bubble keeps answering to `author`. Check that the control names the companion drawn under it and not the one written above the bubble, so a stop can never reach a companion the reader is not looking at. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [gutter] = slotsIn(canvasElement, "message-gutter")
		const drawn = within(gutter).getByRole("img")

		await expect(
			canvas.getByRole("button", { name: `Stop ${SECOND.name}` }),
		).toBeVisible()
		await expect(
			canvas.queryByRole("button", { name: `Stop ${LEAD.name}` }),
		).toBeNull()
		await expect(drawn).toHaveAccessibleName(new RegExp(`${SECOND.animal}`))
		await expect(drawn).not.toHaveAccessibleName(new RegExp(`${LEAD.animal}`))
		await expect(canvas.getByText(LEAD.name)).toBeVisible()
	},
})

export const StoppablePicture = meta.story({
	render: () => <StoppableTurn author={PICTURED} state="cancelled" stoppable />,
	parameters: {
		docs: {
			description: {
				story:
					"The same stop on a companion that uploaded its own picture. Name and veil both come from the identity the gutter draws, so neither can drift from the face under them. Check that the control is named after that companion and that the veil holds to the rounded square of the picture, corner for corner. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const [glyph] = slotsIn(canvasElement, "bot-working-stop-glyph")

		const [picture] = botIdentityAvatars(canvasElement)

		await expect(
			canvas.getByRole("button", { name: "Stop Atlas" }),
		).toBeVisible()
		await expectCompanionPictureSquare(picture)
		await expect(getComputedStyle(glyph).borderRadius).toBe("10px")
	},
})

export const PictureBesideBlot = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			{[PICTURED, SECOND].map((author) => (
				<AssistantTurn
					author={author}
					copyText={ANSWER}
					key={author.id}
					state="complete"
				>
					{ANSWER}
				</AssistantTurn>
			))}
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The gutter of a companion wearing its picture above the gutter of one drawn from a blot. Check that the picture fills its 40px slot as a rounded square with no border, and that the drawn companion below keeps its animal over its blot. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [picture, drawn] = botIdentityAvatars(canvasElement)

		await expectCompanionPictureSquare(picture)
		await expect(getComputedStyle(picture).borderRadius).toBe("10px")
		await expect(drawn.querySelector("img")).toBeNull()
		await expect(slotsIn(drawn, "bot-avatar-blot")).toHaveLength(1)
	},
})

export const StoppableIdentity = meta.story({
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn
				copyText={PARTIAL}
				identity={BOT}
				onStop={stopTurn}
				state="cancelled"
				stoppable
			>
				{PARTIAL}
			</AssistantTurn>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A row that names its gutter through `identity` rather than `author`: the screen hands the face it draws, so the stop can only ever be named after the companion under it. Check that the control is named after that companion and that the bubble carries no name line above it, since naming the row above the bubble is the author's job alone. " +
					STOPPED_BY_THE_SCREEN,
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByRole("button", { name: "Stop Skippy" }),
		).toBeVisible()
		await expect(slotsIn(canvasElement, "message-author")).toHaveLength(0)
	},
})

const SCHEDULED_CAUSE: TurnCause = {
	routineTitle: "Morning release digest",
	triggerSourceId: "schedule",
}

const UNNAMED_CAUSE: TurnCause = {
	routineTitle: "Inbox sweep",
	triggerSourceId: "matrix-poll",
}

const SUMMONS_CAUSE: TurnCause = {
	routineTitle: "Opened by the mission",
	triggerSourceId: "mission",
	kind: "mission",
}

const LONG_CAUSE: TurnCause = {
	routineTitle:
		"Morning release digest, then the migration checklist, then everything the night left open",
	triggerSourceId: "file-watch",
}

const REPORT =
	"Three pull requests landed overnight and the migration is green on a fresh database."

export const ReportedByRoutine = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A run a routine opened. The row is an ordinary companion turn, and the line above the bubble names the routine that produced it instead of the companion that wrote it: the icon says what fired it — a clock face for a schedule — and it is quieter than a name line, because who wrote the words is already the avatar\u2019s job. Only the run that carries a cause loses its name line; the run under it is untouched. Check that the gutter avatar and the stop are exactly the ones the row always had, and that a screen reader hears the line as a routine report before it hears the title. " +
					CAUSED_BY_THE_RUN,
			},
		},
	},
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn
				author={LEAD}
				cause={SCHEDULED_CAUSE}
				copyText={REPORT}
				onStop={stopTurn}
				stoppable
			>
				{REPORT}
			</AssistantTurn>
			<AssistantTurn author={SECOND} copyText={ANSWER}>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvas, canvasElement }) => {
		const cause = slotIn(canvasElement, "turn-cause")

		await expect(cause).toHaveTextContent("Routine report")
		await expect(slotIn(cause, "turn-cause-title")).toHaveTextContent(
			SCHEDULED_CAUSE.routineTitle,
		)
		await expect(cause.querySelector(".lucide-calendar")).toHaveAttribute(
			"aria-hidden",
			"true",
		)

		const named = slotsIn(canvasElement, "message-author")

		await expect(named).toHaveLength(1)
		await expect(named[0]).toHaveTextContent(SECOND.name)
		await expect(
			canvas.getByRole("button", { name: `Stop ${LEAD.name}` }),
		).toBeVisible()
		await expect(botIdentityAvatars(canvasElement)).toHaveLength(2)
	},
})

export const ReportedByUnnamedTrigger = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A routine fired by a trigger this design system names no icon for — any plugin may declare its own, so an unknown id is the ordinary case and never an error. The line falls back to a bell and writes the routine title exactly as it was handed over. Check that the row reads the same as the scheduled one, one icon apart. " +
					CAUSED_BY_THE_RUN,
			},
		},
	},
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn author={LEAD} cause={UNNAMED_CAUSE} copyText={REPORT}>
				{REPORT}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const cause = slotIn(canvasElement, "turn-cause")

		await expect(cause.querySelector(".lucide-bell")).toBeVisible()
		await expect(slotIn(cause, "turn-cause-title")).toHaveTextContent(
			UNNAMED_CAUSE.routineTitle,
		)
		await expect(slotsIn(canvasElement, "message-author")).toHaveLength(0)
	},
})

export const SummonedByMission = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A run a mission opened, not a routine. The line reads exactly like a routine report, and only the word a screen reader hears before the title changes: a mission summons, never a routine report. Check that the announcement names the mission and that the run still loses its name line. " +
					CAUSED_BY_THE_RUN,
			},
		},
	},
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn author={LEAD} cause={SUMMONS_CAUSE} copyText={REPORT}>
				{REPORT}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const cause = slotIn(canvasElement, "turn-cause")

		await expect(cause).toHaveTextContent("Mission summons")
		await expect(cause).not.toHaveTextContent("Routine report")
		await expect(slotIn(cause, "turn-cause-title")).toHaveTextContent(
			SUMMONS_CAUSE.routineTitle,
		)
		await expect(slotsIn(canvasElement, "message-author")).toHaveLength(0)
	},
})

export const ReportedByLongTitle = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A routine whose title outruns the width the transcript gives it. The line stays a single line and truncates, so the row above the bubble never grows a second line and never pushes the icon off it. Check the icon holds its size while the title alone gives way. " +
					CAUSED_BY_THE_RUN,
			},
		},
	},
	render: () => (
		<div className="flex max-w-xs flex-col gap-6">
			<AssistantTurn author={LEAD} cause={LONG_CAUSE} copyText={REPORT}>
				{REPORT}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const cause = slotIn(canvasElement, "turn-cause")
		const title = slotIn(cause, "turn-cause-title")
		const icon = cause.querySelector<HTMLElement>(".lucide-file-text")

		if (!icon) throw new globalThis.Error("The line drew no trigger icon")

		await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
		await expect(title.getBoundingClientRect().height).toBeLessThan(24)
		await expect(icon.getBoundingClientRect().width).toBeCloseTo(12, 0)
	},
})

export const Footnoted = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A row the screen hands a line to put under the bubble — here, the trace a companion leaves when it keeps a skill. The node lands in the slot a turn already reserves for the state it ended in, so a note and a completion label never draw two footers, and the state wins: the stopped row below writes `Stopped` and drops the note it was given. Check that the line sits under the bubble and outside it, quieter than the answer, and starts exactly where the bubble does. Pick `Variants` for the labels the state produces on its own. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<div className="mx-auto flex max-w-2xl flex-col gap-6">
			<AssistantTurn copyText={ANSWER} footer={KEPT_SKILL} identity={BOT}>
				{ANSWER}
			</AssistantTurn>
			<AssistantTurn
				copyText={ANSWER}
				footer={KEPT_SKILL}
				identity={BOT}
				state="cancelled"
			>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const [noted, stopped] = slotsIn(canvasElement, "message-footer")

		await expect(noted).toHaveTextContent(KEPT_SKILL)
		await expect(stopped).toHaveTextContent("Stopped")
		await expect(stopped).not.toHaveTextContent(KEPT_SKILL)

		const bubble = slotIn(canvasElement, "message-bubble")

		await expect(noted.getBoundingClientRect().left).toBeCloseTo(
			bubble.getBoundingClientRect().left,
			0,
		)
		await expect(noted.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			bubble.getBoundingClientRect().bottom,
		)
	},
})

export const FootnotedSqueezed = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same note in a container squeezed to 320 pixels. Check that it wraps inside the content column instead of widening the row, that every line still starts where the bubble does, and that nothing scrolls sideways. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<div className="w-[320px]">
			<AssistantTurn copyText={ANSWER} footer={KEPT_SKILL} identity={BOT}>
				{ANSWER}
			</AssistantTurn>
		</div>
	),
	play: async ({ canvasElement }) => {
		const note = slotIn(canvasElement, "message-footer")
		const bubble = slotIn(canvasElement, "message-bubble")
		const column = slotIn(canvasElement, "message").parentElement as HTMLElement

		await expect(note.getBoundingClientRect().height).toBeGreaterThan(20)
		await expect(note.getBoundingClientRect().left).toBeCloseTo(
			bubble.getBoundingClientRect().left,
			0,
		)
		await expect(note.getBoundingClientRect().right).toBeLessThanOrEqual(
			column.getBoundingClientRect().right,
		)
		await expect(column.scrollWidth).toBeLessThanOrEqual(column.clientWidth)
	},
})

const editCompanion = fn()

const deleteCompanion = fn()

const COMPANION_MENU_LABEL = `Actions for ${BOT.name}`

const HOSTLESS_GUTTER_PLACEMENT = { gridColumnStart: "1", gridRowStart: "2" }

const companionMenuFor = (companionId: string) =>
	companionId === BOT.id ? (
		<CompanionMenuContent
			companion={{ id: BOT.id, name: BOT.name }}
			isPinned={false}
			memberships={NO_MEMBERSHIPS}
			onDelete={deleteCompanion}
			onEdit={editCompanion}
			sections={NO_SECTIONS}
			spaces={NO_SPACES}
		/>
	) : null

const GutterTurn = ({ identity }: { identity: RosterBot }) => (
	<div className="mx-auto max-w-2xl">
		<AssistantTurn copyText={ANSWER} identity={identity} onReply={reply}>
			{ANSWER}
		</AssistantTurn>
	</div>
)

const gutterPlacement = (gutter: HTMLElement) => {
	const { gridColumnStart, gridRowStart } = getComputedStyle(gutter)
	return { gridColumnStart, gridRowStart }
}

export const CompanionMenuOnGutter = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The avatar in the gutter, hosting the companion menu a provider hands it — the same menu the roster row opens, on the face the transcript already draws. The gutter is the first column of the row and the bubble is the second, so the avatar sits beside the bubble rather than inside it and the two menus never share a trigger. Check that a right-click on the avatar opens the companion menu, that the avatar keeps the very column and row it holds with no provider, that the gutter stays hidden from screen readers since nothing focusable was added to it, and that no hover or left-click does anything the avatar did not do before. Pick `CompanionMenuOffGutter` for the transcript as it renders with no provider around it, and `CompanionMenuUnanswered` for a provider that knows nothing about this companion. " +
					RENDERED_BY_THE_THREAD,
			},
		},
	},
	render: () => (
		<CompanionMenuProvider menuFor={companionMenuFor}>
			<GutterTurn identity={BOT} />
		</CompanionMenuProvider>
	),
	play: async ({ canvasElement }) => {
		const gutter = slotIn(canvasElement, "message-gutter")

		await expect(gutter).toHaveAttribute("aria-hidden", "true")
		await expect(gutterPlacement(gutter)).toEqual(HOSTLESS_GUTTER_PLACEMENT)

		await rightClickOn(gutter)
		await shown(await screen.findByRole("menu", { name: COMPANION_MENU_LABEL }))

		await expect(screen.getAllByRole("menu")).toHaveLength(1)
	},
})

export const CompanionMenuOffGutter = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"The same row with no provider above it, which is every transcript that has not been handed companion menus. Check that a right-click on the avatar opens nothing and leaves the browser its own menu.",
			},
		},
	},
	render: () => <GutterTurn identity={BOT} />,
	play: async ({ canvasElement }) => {
		const gutter = slotIn(canvasElement, "message-gutter")
		const { defaulted } = await rightClickOn(gutter)

		await expect(gutterPlacement(gutter)).toEqual(HOSTLESS_GUTTER_PLACEMENT)
		await expect(defaulted).toBe(true)
		await expect(screen.queryByRole("menu")).toBeNull()
	},
})

export const CompanionMenuUnanswered = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story:
					"A provider mounted over a companion it holds no menu for — a transcript where one seat was taken by a companion the screen has not published actions for yet. Check that the avatar behaves as if no provider were there at all: the right-click opens nothing and the browser keeps its own menu. `CompanionMenuOffGutter` is the same absence reached the other way, with no provider mounted.",
			},
		},
	},
	render: () => (
		<CompanionMenuProvider menuFor={companionMenuFor}>
			<GutterTurn identity={SECOND} />
		</CompanionMenuProvider>
	),
	play: async ({ canvasElement }) => {
		const gutter = slotIn(canvasElement, "message-gutter")
		const { defaulted } = await rightClickOn(gutter)

		await expect(defaulted).toBe(true)
		await expect(screen.queryByRole("menu")).toBeNull()
	},
})

const selectCompanion = fn()

const PICTURED_BOT: RosterBot = { ...BOT, image: UPLOADED_AVATAR_IMAGE }

const SELECT_NOT_YET_RENDERED =
	"No screen mounts `CompanionSelectProvider` yet: the thread hands it the select in OPE-328, so the story stays out of the sidebar until then."

const SelectableGutters = () => (
	<CompanionSelectProvider onSelect={selectCompanion}>
		<div className="flex flex-col gap-6">
			<GutterTurn identity={BOT} />
			<GutterTurn identity={PICTURED_BOT} />
		</div>
	</CompanionSelectProvider>
)

const gutterSelects = (canvas: ReturnType<typeof within>) =>
	canvas.getAllByRole("button", { name: BOT.name })

export const CompanionSelectOnGutter = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story: `The gutter avatar at rest under a mounted select, once as a blot and once carrying a picture. Check that each avatar is a button named after the companion, that the gutter is no longer hidden from assistive technology, that it keeps its column and row, and that the button takes the circle of a blot and the picture radius of an avatar carrying an image. ${SELECT_NOT_YET_RENDERED}`,
			},
		},
	},
	render: () => <SelectableGutters />,
	play: async ({ canvas, canvasElement }) => {
		const [blot, pictured] = gutterSelects(canvas)
		const [gutter] = slotsIn(canvasElement, "message-gutter")

		if (!blot || !pictured || !gutter)
			throw new globalThis.Error("Two gutters expected")

		await expect(gutter).not.toHaveAttribute("aria-hidden")
		await expect(gutterPlacement(gutter)).toEqual(HOSTLESS_GUTTER_PLACEMENT)
		await expect(getComputedStyle(blot).borderRadius).not.toBe(
			getComputedStyle(pictured).borderRadius,
		)
		await expect(getComputedStyle(blot).boxShadow).toBe("none")
	},
})

export const CompanionSelectOnGutterHovered = meta.story({
	tags: ["test-only"],
	globals: { theme_layout: "side-by-side" },
	parameters: {
		pseudo: { hover: true },
		docs: {
			description: {
				story: `The two gutter avatars with the pointer resting on them, in both themes at once, drawn by the pseudo-state addon. The select dims its target instead of ringing it: the stop veils the face because pressing it ends work, while the select only opens the companion, so it lowers the avatar to 70 percent opacity and leaves the face in view. Check by eye in the light and the dark theme that the blot and the picture read as dimmed by the same amount, with no ring and no shadow around either, and that each stays recognizable against the page background. The pseudo-state addon rewrites no hover rule under the vitest runner, so the play asserts the computed shadow and the hover classes rather than a computed opacity and transition. ${SELECT_NOT_YET_RENDERED}`,
			},
		},
	},
	render: () => <SelectableGutters />,
	play: async ({ canvas }) => {
		const buttons = gutterSelects(canvas)

		await expect(buttons).toHaveLength(4)
		for (const button of buttons) {
			await expect(getComputedStyle(button).boxShadow).toBe("none")
			await expect(button).toHaveClass(
				"hover:opacity-70",
				"hover:transition-none",
				"motion-reduce:transition-none",
			)
		}
	},
})

export const CompanionSelectOnGutterFocused = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story: `The gutter avatar reached by the keyboard. Check that Tab lands on it and that it wears the focus ring the stop button already wears. ${SELECT_NOT_YET_RENDERED}`,
			},
		},
	},
	render: () => <SelectableGutters />,
	play: async ({ canvas, userEvent }) => {
		const [blot] = gutterSelects(canvas)

		if (!blot) throw new globalThis.Error("The gutter drew no button")

		await userEvent.tab()

		await expect(blot).toHaveFocus()
		await expect(getComputedStyle(blot).boxShadow).not.toBe("none")
	},
})

export const CompanionSelectFromGutter = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story: `The gutter avatar under both a select and a companion menu. Check that a click, Enter and Space each report the companion id once, and that a right-click still opens the companion menu without reporting a select. ${SELECT_NOT_YET_RENDERED}`,
			},
		},
	},
	render: () => (
		<CompanionSelectProvider onSelect={selectCompanion}>
			<CompanionMenuProvider menuFor={companionMenuFor}>
				<GutterTurn identity={BOT} />
			</CompanionMenuProvider>
		</CompanionSelectProvider>
	),
	play: async ({ canvas, userEvent }) => {
		selectCompanion.mockClear()
		const button = canvas.getByRole("button", { name: BOT.name })

		await userEvent.click(button)
		await expect(selectCompanion).toHaveBeenCalledTimes(1)
		await expect(selectCompanion).toHaveBeenLastCalledWith(BOT.id)

		button.focus()
		await userEvent.keyboard("{Enter}")
		await expect(selectCompanion).toHaveBeenCalledTimes(2)
		await userEvent.keyboard(" ")
		await expect(selectCompanion).toHaveBeenCalledTimes(3)
		await expect(selectCompanion).toHaveBeenLastCalledWith(BOT.id)

		await rightClickOn(button)
		await shown(await screen.findByRole("menu", { name: COMPANION_MENU_LABEL }))
		await expect(selectCompanion).toHaveBeenCalledTimes(3)
	},
})

export const CompanionSelectWhileStoppable = meta.story({
	tags: ["test-only"],
	parameters: {
		docs: {
			description: {
				story: `A stoppable turn under a mounted select. Check that the stop stays the only control of the gutter and that pressing it stops the companion without reporting a select. ${SELECT_NOT_YET_RENDERED}`,
			},
		},
	},
	render: () => (
		<CompanionSelectProvider onSelect={selectCompanion}>
			<StoppableTurn state="complete" stoppable />
		</CompanionSelectProvider>
	),
	play: async ({ canvasElement, userEvent }) => {
		selectCompanion.mockClear()
		stopTurn.mockClear()
		const gutter = slotIn(canvasElement, "message-gutter")
		const [stop, ...others] = within(gutter).getAllByRole("button")

		if (!stop) throw new globalThis.Error("The gutter drew no stop")

		await expect(others).toHaveLength(0)
		await expect(stop).toHaveAccessibleName(`Stop ${LEAD.name}`)

		await userEvent.click(stop)
		await expect(stopTurn).toHaveBeenCalledTimes(1)
		await expect(selectCompanion).not.toHaveBeenCalled()
	},
})
