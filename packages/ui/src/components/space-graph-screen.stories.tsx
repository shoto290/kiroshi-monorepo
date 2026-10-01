import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import { SPACE_GRAPH } from "@workspace/ui/components/space-graph.fixtures"
import { SpaceGraphScreen } from "@workspace/ui/components/space-graph-screen"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

const FIRST_FRAME_TIMEOUT_MS = 5000

const WIDE_PX = 1100

const NARROW_PX = 800

const canvasOf = async (canvasElement: HTMLElement) =>
	waitFor(
		() => {
			const canvas = slotIn(canvasElement, "space-graph-canvas").querySelector(
				"canvas",
			)
			if (!canvas?.clientWidth) throw new Error("No graph frame yet")
			return canvas
		},
		{ timeout: FIRST_FRAME_TIMEOUT_MS },
	)

const expectCanvasFillsItsPane = async (canvasElement: HTMLElement) => {
	const canvas = await canvasOf(canvasElement)
	const pane = slotIn(canvasElement, "space-graph-canvas")
	await waitFor(() => {
		expect(canvas.clientWidth).toBe(pane.clientWidth)
		expect(canvas.clientHeight).toBe(pane.clientHeight)
	})
}

const meta = preview.meta({
	title: "Layout/SpaceGraphScreen",
	component: SpaceGraphScreen,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The space graph as a page of the main pane, under the app header and beside the sidebar, opened from the Space graph entry of the rail. The graph takes every pixel the pane leaves it and follows the window and the sidebar width; the back button returns to the conversation the reader left.",
			},
		},
	},
	args: { graph: SPACE_GRAPH, onBack: fn() },
	render: (args) => (
		<div className="flex h-[640px]" data-slot="story-window">
			<WorkspaceShell
				sidebar={<AppSidebar bots={[]} isGraphOpen onToggleGraph={fn()} />}
			>
				<SpaceGraphScreen {...args} />
			</WorkspaceShell>
		</div>
	),
})

export const InTheShell = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The page as the app opens it in light. Check the header carries the back button and the title, the rail shows Space graph pressed beside the current Conversations entry, and the canvas reaches the edges of its pane with no frame of its own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const page = within(canvasElement)
		await expect(
			page.getByRole("heading", { level: 1, name: "Space graph" }),
		).toBeVisible()
		await expect(
			page.getByRole("button", { name: "Space graph" }),
		).toHaveAttribute("aria-pressed", "true")
		await expect(
			page.getByRole("button", { name: "Conversations" }),
		).toHaveAttribute("aria-current", "true")
		await expectCanvasFillsItsPane(canvasElement)
	},
})

export const Dark = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The same page in dark. Check the guides, links and neutral nodes read on the dark card, and the bot avatars keep their colours.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectCanvasFillsItsPane(canvasElement)
	},
})

export const BackToTheConversation = meta.story({
	tags: ["test-only"],
	play: async ({ args, canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Back to the conversation",
			}),
		)
		await expect(args.onBack).toHaveBeenCalledOnce()
	},
})

export const FollowsThePaneWidth = meta.story({
	tags: ["test-only"],
	play: async ({ canvasElement }) => {
		const window = slotIn(canvasElement, "story-window")
		window.style.width = `${WIDE_PX}px`
		const canvas = await canvasOf(canvasElement)
		await expectCanvasFillsItsPane(canvasElement)
		const wide = canvas.clientWidth
		window.style.width = `${NARROW_PX}px`
		await waitFor(() =>
			expect(wide - canvas.clientWidth).toBe(WIDE_PX - NARROW_PX),
		)
		await expectCanvasFillsItsPane(canvasElement)
	},
})
