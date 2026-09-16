// Call site: packages/ui/src/components/transcript.tsx line 342

import { expect, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL, slotIn, slotsIn } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"
import { cn } from "@workspace/ui/lib/utils"

const SHORT_THREAD = [
	"Where did the nightly run stop?",
	"On the migration that renames the run history table.",
]

const LONG_THREAD = [
	...SHORT_THREAD,
	"It failed on the third batch, after 12 000 rows.",
	"The batch is retried from the last checkpoint, so nothing is written twice.",
	"I kept the failing statement in the report attached to this turn.",
	"The column it renames still holds the old index.",
	"Dropping the index first makes the rename instant.",
	"I can prepare that as a second migration.",
	"Do it, and leave the rename untouched.",
	"Prepared. Waiting for you to read it before I run anything.",
]

const BUBBLE =
	"rounded-xl border border-border bg-card px-4 py-3 text-card-foreground text-sm"

const FRAME = "h-72 w-[32rem]"

const ALWAYS_RENDERED = "[content-visibility:visible]"

type ThreadProps = {
	lines: string[]
}

const Thread = ({ lines }: ThreadProps) => (
	<MessageScrollerProvider autoScroll defaultScrollPosition="end">
		<div className={FRAME}>
			<MessageScroller className="min-h-0">
				<MessageScrollerViewport aria-label="Transcript">
					<MessageScrollerContent
						aria-busy={false}
						aria-relevant="additions text"
						className="justify-end gap-6"
					>
						{lines.map((line, rank) => (
							<MessageScrollerItem
								className={cn(
									"flex flex-col gap-6",
									rank === lines.length - 1 && ALWAYS_RENDERED,
								)}
								key={line}
								messageId={line}
								scrollAnchor={rank === lines.length - 1}
							>
								<p className={BUBBLE}>{line}</p>
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton
					behavior="auto"
					className="rounded-full shadow-xl tabular-nums"
					size="sm"
					variant="secondary"
				>
					<Icons.ArrowDown data-icon="inline-start" />
					Jump to latest
				</MessageScrollerButton>
			</MessageScroller>
		</div>
	</MessageScrollerProvider>
)

const viewportIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "message-scroller-viewport")

const buttonIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "message-scroller-button")

const lastItemIn = (canvasElement: HTMLElement) => {
	const item = slotsIn(canvasElement, "message-scroller-item").at(-1)
	if (!item) throw new Error("the thread rendered no item")
	return item
}

const meta = preview.meta({
	title: "Conversation/Message/MessageScroller",
	component: MessageScroller,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The scrolling machinery under the transcript, composed from the registry primitive: a provider owning the scroll position, a viewport that follows the last message while the reader stays at the end and stops following the moment they scroll back, items that skip painting while off screen, and a button that only comes up when there is something below. It draws no message — what a turn looks like belongs to `Transcript` and to the rows it renders. Reach for these parts when a list must stay pinned to its newest row.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A thread short enough to fit its frame, which is what a conversation looks like for its first few turns. Check that the messages sit at the bottom of the viewport rather than at the top — the content justifies to the end so a thread grows downwards from the first turn — and that the jump button stays out of the way: it is inactive, transparent and takes no pointer, so it never covers the last message or eats a click meant for it. Pick `ScrolledBack` for the state that brings it up.",
			},
		},
	},
	render: () => <Thread lines={SHORT_THREAD} />,
	play: async ({ canvasElement }) => {
		const viewport = viewportIn(canvasElement)
		const button = buttonIn(canvasElement)

		await expect(viewport.scrollHeight).toBe(viewport.clientHeight)
		await expect(button.dataset.active).toBe("false")
		await expect(getComputedStyle(button).pointerEvents).toBe("none")
	},
})

export const AtEnd = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A thread longer than its frame, opened where the transcript opens it: on the newest message. Check that the viewport starts scrolled to the bottom rather than at the oldest turn, that the jump button stays inactive while there is nothing below — offering to jump to a message already on screen is noise — and that the last item is measured on the message it holds rather than on the 10rem box an unpainted item reserves, which is the exemption the transcript gives that one item so the thread lands on the real last line.",
			},
		},
	},
	render: () => <Thread lines={LONG_THREAD} />,
	play: async ({ canvasElement }) => {
		const viewport = viewportIn(canvasElement)
		const button = buttonIn(canvasElement)

		await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
		await waitFor(async () => {
			await expect(
				viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight,
			).toBeLessThan(2)
		}, FRAME_POLL)
		await expect(button.dataset.active).toBe("false")

		const last = lastItemIn(canvasElement)
		const message = last.firstElementChild as HTMLElement

		await expect(getComputedStyle(last).contentVisibility).toBe("visible")
		await expect(last.getBoundingClientRect().height).toBe(
			message.getBoundingClientRect().height,
		)
	},
})

export const ScrolledBack = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The reader went back up the thread, so the viewport stopped following the newest message. Check that the jump button comes up opaque and clickable at that moment, that pressing it returns to the end, and that it goes back to inactive once there. This is the only state in which the button is reachable at all.",
			},
		},
	},
	render: () => <Thread lines={LONG_THREAD} />,
	play: async ({ canvasElement, userEvent }) => {
		const viewport = viewportIn(canvasElement)
		const button = buttonIn(canvasElement)

		viewport.focus()
		await userEvent.keyboard("{Home}")
		viewport.scrollTop = 0

		await waitFor(async () => {
			await expect(button.dataset.active).toBe("true")
		}, FRAME_POLL)
		await expect(getComputedStyle(button).pointerEvents).not.toBe("none")

		await userEvent.click(button)

		await waitFor(async () => {
			await expect(button.dataset.active).toBe("false")
		}, FRAME_POLL)
	},
})
