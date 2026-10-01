import { expect, userEvent, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { SpaceGraph } from "@workspace/ui/components/space-graph"
import {
	BOTS_ONLY_GRAPH,
	OWN_PLUGINS_GRAPH,
} from "@workspace/ui/components/space-graph.fixtures"

const meta = preview.meta({
	title: "Feedback/SpaceGraph",
	component: SpaceGraph,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"What a space loads, drawn as orbits: each bot pinned on an outer ring as a circle holding the skills and applications of its own plugin, sized by their estimated token count, a halo marking a write in the last week. A ring guide is drawn only for a shared scope that holds a node; clicking a bot keeps only its neighbourhood.",
			},
		},
	},
	globals: { theme_layout: "side-by-side" },
	args: { graph: OWN_PLUGINS_GRAPH },
	decorators: [
		(Story) => (
			<div className="h-[560px]">
				<Story />
			</div>
		),
	],
})

const FIRST_FRAME_TIMEOUT_MS = 5000

const expectBotCount = async (canvasElement: HTMLElement, count: number) => {
	await waitFor(
		() =>
			expect(
				canvasElement.querySelectorAll('[data-slot="space-graph-bot"]'),
			).toHaveLength(count * 2),
		{ timeout: FIRST_FRAME_TIMEOUT_MS },
	)
}

export const Orbits = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A space as the app draws it: four bots at rest, each holding its own skills and applications, with no shared scope and so no ring guide. Check that no file crosses another bot's circle and that a picked bot keeps its place.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectBotCount(canvasElement, 4)
		await expect(within(canvasElement).queryByRole("tab")).toBeNull()
	},
})

export const BotsOnly = meta.story({
	args: { graph: BOTS_ONLY_GRAPH },
	parameters: {
		docs: {
			description: {
				story:
					"A space whose bots hold no skill and no application: the bots alone on their ring, with no circle and no link.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectBotCount(canvasElement, 4)
	},
})

export const LocalMode = meta.story({
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
