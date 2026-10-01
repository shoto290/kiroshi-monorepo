import { expect, userEvent, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SpaceGraph } from "@workspace/ui/components/space-graph"
import { SPACE_GRAPH } from "@workspace/ui/components/space-graph.fixtures"

const meta = preview.meta({
	title: "Feedback/SpaceGraph",
	component: SpaceGraph,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"What a space loads, drawn as a graph: its bots, and the skills, applications and files each one preloads across the system, user, space and bot scopes. Area follows the preloaded token count, a halo marks a write in the last week, a bot's own nodes wear its colour and shared nodes stay neutral. Four layout directions share the same data and encoding; clicking a bot keeps only its neighbourhood.",
			},
		},
	},
	globals: { theme_layout: "side-by-side" },
	args: { graph: SPACE_GRAPH },
	decorators: [
		(Story) => (
			<div className="h-[560px]">
				<Story />
			</div>
		),
	],
})

const FIRST_FRAME_TIMEOUT_MS = 5000

const expectSelectedDirection = async (
	canvasElement: HTMLElement,
	name: string,
) => {
	const tabs = within(canvasElement).getAllByRole("tab", { name })
	for (const tab of tabs) {
		await expect(tab).toHaveAttribute("aria-selected", "true")
	}
}

const expectBotCount = async (canvasElement: HTMLElement, count: number) => {
	const bots = canvasElement.querySelectorAll('[data-slot="space-graph-bot"]')
	await expect(bots).toHaveLength(count * 2)
}

export const Force = meta.story({
	args: { defaultDirection: "force" },
	parameters: {
		docs: {
			description: {
				story:
					"The Obsidian-like baseline: nothing is pinned, the whole graph floats until it settles. Pick it to judge the raw clustering, and compare with `Hubs` when the bots should hold still.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectSelectedDirection(canvasElement, "Force")
		await expectBotCount(canvasElement, 4)
	},
})

export const Hubs = meta.story({
	args: { defaultDirection: "hubs" },
	parameters: {
		docs: {
			description: {
				story:
					"Bots pinned at fixed places on one ring, their own skills and applications orbiting as satellites, shared nodes pulled toward the centre. Check that a bot sits at the same place after switching away and back.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectSelectedDirection(canvasElement, "Hubs")
		await expectBotCount(canvasElement, 4)
	},
})

export const Rings = meta.story({
	args: { defaultDirection: "rings" },
	parameters: {
		docs: {
			description: {
				story:
					"One concentric ring per scope: system at the centre, then user, then space, bot plugins and the bots themselves at the edge. Pick it to read where the context weight comes from by scope.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectSelectedDirection(canvasElement, "Rings")
		await expectBotCount(canvasElement, 4)
	},
})

export const Nested = meta.story({
	args: { defaultDirection: "nested" },
	parameters: {
		docs: {
			description: {
				story:
					"Each bot drawn as a circle holding its own plugin files as bubbles sized by tokens, after githubnext/repo-visualizer; shared nodes stay outside every circle, linked to each bot that loads them.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectSelectedDirection(canvasElement, "Nested")
		await expectBotCount(canvasElement, 4)
	},
})

export const LocalMode = meta.story({
	args: { defaultDirection: "force" },
	parameters: {
		docs: {
			description: {
				story:
					"After a bot is picked: only that bot and the nodes it loads remain, and a visible control returns to the whole graph. The play picks Atlas from the keyboard, checks the neighbourhood, then leaves local mode and puts it back.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement)
		const pressFirst = async (name: string) => {
			const [button] = await waitFor(
				() => canvas.getAllByRole("button", { name }),
				{ timeout: FIRST_FRAME_TIMEOUT_MS },
			)
			button?.focus()
			await userEvent.keyboard("{Enter}")
		}
		const botCount = () =>
			canvasElement.querySelectorAll('[data-slot="space-graph-bot"]').length

		await pressFirst("Show Atlas and what it loads")
		await waitFor(() => expect(botCount()).toBe(5))
		await pressFirst("Show the whole graph")
		await waitFor(() => expect(botCount()).toBe(8))
		await pressFirst("Show Atlas and what it loads")
		await waitFor(() => expect(botCount()).toBe(5))
	},
})
