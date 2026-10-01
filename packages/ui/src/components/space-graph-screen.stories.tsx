import { useState } from "react"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { AppSidebar } from "@workspace/ui/components/app-sidebar"
import {
	BOTS_ONLY_GRAPH,
	OWN_PLUGINS_GRAPH,
} from "@workspace/ui/components/space-graph.fixtures"
import {
	SpaceGraphScreen,
	type SpaceGraphScreenState,
} from "@workspace/ui/components/space-graph-screen"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

const FIRST_FRAME_TIMEOUT_MS = 5000

const WIDE_PX = 1100

const NARROW_PX = 800

const SIDEBAR_PX = 333

const READY: SpaceGraphScreenState = {
	status: "ready",
	graph: OWN_PLUGINS_GRAPH,
}

const TogglingShell = () => {
	const [isGraphOpen, setIsGraphOpen] = useState(false)
	return (
		<div className="flex h-[640px]">
			<WorkspaceShell
				sidebar={
					<AppSidebar
						bots={[]}
						isGraphOpen={isGraphOpen}
						onToggleGraph={() => setIsGraphOpen((open) => !open)}
					/>
				}
				width={SIDEBAR_PX}
			>
				{isGraphOpen ? <SpaceGraphScreen onClose={fn()} state={READY} /> : null}
			</WorkspaceShell>
		</div>
	)
}

const currentEntriesIn = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'[data-slot="app-rail-item"][aria-current="true"]',
		),
	).map((entry) => entry.getAttribute("aria-label"))

const panelWidthIn = (canvasElement: HTMLElement) =>
	slotIn(canvasElement, "sidebar-container").getBoundingClientRect().width

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
	return canvas
}

const meta = preview.meta({
	title: "Layout/SpaceGraphScreen",
	component: SpaceGraphScreen,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The space graph as a page of the main pane, opened from the Space graph entry of the rail in dev builds. The rail and the title bar stay as on every screen; the sidebar panel steps aside and the page carries no header of its own. The page reads the space while it opens, names every read that failed, and draws the bots alone when they hold nothing. The graph takes every pixel the pane leaves it and follows the window width. Pressing the rail entry again or Escape closes the page.",
			},
		},
	},
	args: { state: READY, onClose: fn() },
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
					"The page as the app opens it in light. Check the rail and the title bar hold their places, Space graph is pressed in the rail, no sidebar panel sits beside the rail, no header sits above the graph, and the canvas reaches the edges of its pane with no frame of its own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const page = within(canvasElement)
		await expect(slotIn(canvasElement, "app-rail")).toBeVisible()
		await expect(slotIn(canvasElement, "app-title-bar")).toBeVisible()
		await expect(page.queryByRole("complementary")).toBeNull()
		await expect(
			canvasElement.querySelector('[data-slot="app-header"]'),
		).toBeNull()
		await expect(currentEntriesIn(canvasElement)).toEqual(["Space graph"])
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

export const Loading = meta.story({
	args: { state: { status: "loading" } },
	parameters: {
		docs: {
			description: {
				story:
					"While the bots, their skills, their applications and their history are read. Check the spinner and its line sit centred in the pane and the line is announced.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const reading = slotIn(canvasElement, "space-graph-reading")
		await expect(reading).toHaveAttribute("role", "status")
		await expect(reading).toHaveTextContent("Reading this space")
	},
})

export const Failed = meta.story({
	args: {
		state: {
			status: "failed",
			failures: [
				{ read: "skills", botName: "Atlas" },
				{ read: "history", botName: "Basile" },
			],
		},
	},
	parameters: {
		docs: {
			description: {
				story:
					"Two reads refused. Check the notice names each one with the bot it belongs to, and that nothing of the graph is drawn.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const alert = within(canvasElement).getByRole("alert")
		await expect(alert).toHaveTextContent("Couldn’t draw this space")
		await expect(alert).toHaveTextContent("Atlas’s skills couldn’t be read.")
		await expect(alert).toHaveTextContent("Basile’s history couldn’t be read.")
		await expect(
			canvasElement.querySelector('[data-slot="space-graph"]'),
		).toBeNull()
	},
})

export const BotsOnly = meta.story({
	args: { state: { status: "ready", graph: BOTS_ONLY_GRAPH } },
	parameters: {
		docs: {
			description: {
				story:
					"A space whose bots hold no skill and no application: the bots alone on their ring.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expectCanvasFillsItsPane(canvasElement)
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('[data-slot="space-graph-bot"]'),
			).toHaveLength(4),
		)
	},
})

export const EscapeCloses = meta.story({
	tags: ["test-only"],
	play: async ({ args, canvasElement }) => {
		await canvasOf(canvasElement)
		await userEvent.keyboard("{Escape}")
		await expect(args.onClose).toHaveBeenCalledOnce()
	},
})

export const FollowsThePaneWidth = meta.story({
	tags: ["test-only"],
	play: async ({ canvasElement }) => {
		const window = slotIn(canvasElement, "story-window")
		window.style.width = `${WIDE_PX}px`
		const canvas = await expectCanvasFillsItsPane(canvasElement)
		const wide = canvas.clientWidth
		window.style.width = `${NARROW_PX}px`
		await waitFor(() =>
			expect(wide - canvas.clientWidth).toBe(WIDE_PX - NARROW_PX),
		)
		await expectCanvasFillsItsPane(canvasElement)
	},
})

export const PanelComesBackAtItsWidth = meta.story({
	tags: ["test-only"],
	render: () => <TogglingShell />,
	play: async ({ canvasElement }) => {
		const page = within(canvasElement)
		const before = panelWidthIn(canvasElement)
		await userEvent.click(page.getByRole("button", { name: "Space graph" }))
		await waitFor(() => expect(page.queryByRole("complementary")).toBeNull())
		await expect(currentEntriesIn(canvasElement)).toEqual(["Space graph"])
		await userEvent.click(page.getByRole("button", { name: "Space graph" }))
		await waitFor(() => expect(panelWidthIn(canvasElement)).toBe(before))
		await expect(currentEntriesIn(canvasElement)).toEqual(["Conversations"])
	},
})
