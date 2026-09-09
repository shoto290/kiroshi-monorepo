import type { ComponentType, ReactNode } from "react"
import { expect, screen, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { Button } from "@workspace/ui/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@workspace/ui/components/ui/tooltip"

type TooltipArgs = {
	children?: ReactNode
	defaultOpen?: boolean
	open?: boolean
}

const TypedTooltip = Tooltip as ComponentType<TooltipArgs>

const LONG_LABEL =
	"Sends the prompt to the bot holding the conversation, then waits for its first token"

const meta = preview.meta({
	title: "Overlays/Tooltip",
	component: TypedTooltip,
	decorators: [
		(Story) => (
			<TooltipProvider>
				<Story />
			</TooltipProvider>
		),
	],
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The tooltip as the shadcn registry ships it: a root, a trigger and a portalled popup, opening on hover and on focus alike. It is the assembly, not the label — reach for `TooltipHint` to hand one element a piece of text, and for `TooltipButton` to name an icon-only control.",
			},
		},
	},
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The three parts wired by hand, under the provider that sets the open delay for a whole region. Check that the bubble opens under the pointer after the provider's delay and closes when the pointer leaves.",
			},
		},
	},
	render: () => (
		<Tooltip>
			<TooltipTrigger render={<Button variant="outline">Send</Button>} />
			<TooltipContent>Send this prompt</TooltipContent>
		</Tooltip>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.hover(canvas.getByRole("button", { name: "Send" }))

		const bubble = await screen.findByText("Send this prompt")

		await waitFor(async () => {
			await expect(bubble).toBeVisible()
		}, FRAME_POLL)
	},
})

export const WithSide = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"`side` for the controls that have nothing above them: a button pinned to the top of a window opens its bubble downwards or off the screen. Check that the bubble and its arrow both sit under the trigger.",
			},
		},
	},
	render: () => (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button aria-label="New bot" size="icon-sm" variant="ghost">
						<Icons.Add />
					</Button>
				}
			/>
			<TooltipContent side="bottom">New bot</TooltipContent>
		</Tooltip>
	),
	play: async ({ canvas, userEvent }) => {
		const trigger = canvas.getByRole("button", { name: "New bot" })

		await userEvent.hover(trigger)
		const bubble = await screen.findByText("New bot")

		await waitFor(async () => {
			await expect(bubble.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				trigger.getBoundingClientRect().bottom,
			)
		}, FRAME_POLL)
	},
})

export const LongContent = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A sentence rather than a word, which is what a translated label turns into. Check that it wraps at the registry's own `max-w-xs` instead of running off the window edge, and that the trigger keeps its own width.",
			},
		},
	},
	render: () => (
		<Tooltip>
			<TooltipTrigger render={<Button variant="outline">Send</Button>} />
			<TooltipContent>{LONG_LABEL}</TooltipContent>
		</Tooltip>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.hover(canvas.getByRole("button", { name: "Send" }))
		const bubble = await screen.findByText(LONG_LABEL)

		await waitFor(async () => {
			await expect(bubble.getBoundingClientRect().right).toBeLessThanOrEqual(
				window.innerWidth,
			)
		}, FRAME_POLL)
	},
})

export const OnDarkSurface = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The bubble open on the dark surface, where it inverts with its tokens rather than keeping the light fill. Check that the label reads against the bubble and that the bubble reads against the page behind it.",
			},
		},
	},
	render: () => (
		<Tooltip>
			<TooltipTrigger render={<Button variant="outline">Send</Button>} />
			<TooltipContent>Send this prompt</TooltipContent>
		</Tooltip>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.hover(canvas.getByRole("button", { name: "Send" }))

		const bubble = await screen.findByText("Send this prompt")

		await waitFor(async () => {
			await expect(bubble).toBeVisible()
		}, FRAME_POLL)
	},
})
