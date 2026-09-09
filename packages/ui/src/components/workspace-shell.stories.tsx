import type { ReactNode } from "react"
import { expect, fn, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL, settled } from "@workspace/storybook/story-utils"
import { AppHeader } from "@workspace/ui/components/app-header"
import {
	AppSidebar,
	type AppSidebarBot,
} from "@workspace/ui/components/app-sidebar"
import { ConnectionStatus } from "@workspace/ui/components/connection-status"
import { Icons } from "@workspace/ui/components/icons"
import { PromptInput } from "@workspace/ui/components/prompt-input"
import type { RosterBot } from "@workspace/ui/components/roster"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import { ThreadLayout } from "@workspace/ui/components/thread-layout"
import { AssistantTurn, UserTurn } from "@workspace/ui/components/turn"
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"
import { WorkspaceShell } from "@workspace/ui/components/workspace-shell"

const ANSWER =
	"Two packages: `@workspace/ui` holds the design system, `app` holds the Tauri shell."

const BOT: RosterBot = {
	id: "bot-skippy",
	name: "Skippy",
	animal: "owl",
	blot: "blue",
}

const ROSTER: AppSidebarBot[] = [
	{
		id: "atlas",
		name: "Atlas",
		title: "Research",
		animal: "owl",
		blot: "blue",
		lastMessage: ANSWER,
	},
]

const SIDEBAR = (
	<Sidebar aria-label="Workspace" collapsible="icon" role="complementary">
		<SidebarHeader>
			<SidebarTrigger aria-label="Toggle workspace">
				<Icons.More className="size-4" />
			</SidebarTrigger>
		</SidebarHeader>
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel>Sessions</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuRow>Brief</SidebarMenuRow>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	</Sidebar>
)

const chat = (leading?: ReactNode) => (
	<ThreadLayout
		header={
			<AppHeader
				leading={leading}
				trailing={<ConnectionStatus state="ready" version="2.1.233" />}
			/>
		}
		composer={<PromptInput onSubmit={fn()} />}
	>
		<UserTurn>How is this workspace laid out?</UserTurn>
		<AssistantTurn copyText={ANSWER} identity={BOT}>
			{ANSWER}
		</AssistantTurn>
	</ThreadLayout>
)

const CHAT = chat()

const CHAT_WITH_TRIGGER = chat(
	<SidebarTrigger aria-label="Toggle sidebar">
		<Icons.Sidebar className="size-4" />
	</SidebarTrigger>,
)

const OVERFLOWING_CHILD = <div className="h-[300svh] w-full bg-muted" />

const shellSurface = (canvas: ReturnType<typeof within>) =>
	canvas.getByRole("main").parentElement as HTMLElement

const stateOf = (sidebar: HTMLElement) =>
	sidebar.closest<HTMLElement>("[data-slot=sidebar]")?.dataset.state

const paintOf = (element: HTMLElement) =>
	getComputedStyle(element).backgroundColor

const paintOfProbe = (paint: (swatch: HTMLElement) => void) => {
	const swatch = document.createElement("div")
	paint(swatch)
	document.body.append(swatch)
	const painted = paintOf(swatch)
	swatch.remove()
	return painted
}

const shellPaintFor = (tint?: string) =>
	paintOfProbe((swatch) => {
		swatch.className = "surface-shell"
		if (tint) swatch.style.setProperty("--space-tint", tint)
	})

const paintFor = (value: string) =>
	paintOfProbe((swatch) => {
		swatch.style.backgroundColor = value
	})

const CARD_GUTTER = 4

const expectCardDetached = async (card: HTMLElement, leadingEdge: number) => {
	const edges = card.getBoundingClientRect()
	await expect(edges.left - leadingEdge).toBe(CARD_GUTTER)
	await expect(edges.top).toBe(CARD_GUTTER)
	await expect(window.innerWidth - edges.right).toBe(CARD_GUTTER)
	await expect(window.innerHeight - edges.bottom).toBe(CARD_GUTTER)
}

const meta = preview.meta({
	title: "Layout/WorkspaceShell",
	component: WorkspaceShell,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The application shell: the sidebar surface is the window itself, reaching every edge with no seam, and the main column floats on it as a rounded card detached on all four sides. It is a thin composition over the sidebar foundation — the provider owns the open state and the Cmd/Ctrl+B shortcut, the sidebar owns its own collapse, and the shell only hands the room that is left to the card. Whatever fills that card keeps its own scroll boundary, so a `ThreadLayout` still scrolls its transcript alone while the surface around it stays put. `spaceTint` washes that surface with the colour of the space in view, faintly enough that it still reads as the app background.",
			},
		},
	},
	args: {
		children: CHAT,
	},
})

export const Default = meta.story({
	args: {
		sidebar: SIDEBAR,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The nominal workspace: an expanded sidebar holding the session list, and a live conversation in the main column. Check that the transcript takes the whole room the panel leaves it and starts where the panel ends rather than running under it, that only the transcript scrolls — the sidebar, the bar above it and the composer stay put — and that Tab reaches the sidebar trigger before the transcript. Pick `Collapsed` for the icon rail, `Empty` for the shell with no sidebar at all.",
			},
		},
	},
	play: async ({ canvas }) => {
		const sidebar = canvas.getByRole("complementary", { name: "Workspace" })
		await expect(sidebar).toBeVisible()
		await expect(canvas.getByRole("main")).toBeVisible()
		await expect(canvas.getByRole("textbox", { name: "Prompt" })).toBeVisible()

		const surface = shellSurface(canvas)
		await expect(surface.style.getPropertyValue("--space-tint")).toBe("")
		await expect(paintOf(surface)).toBe(shellPaintFor())
		await expectCardDetached(
			canvas.getByRole("main"),
			sidebar.getBoundingClientRect().right,
		)

		const viewport = canvas.getByRole("region", { name: "Conversation" })
		const column = canvas.getByRole("log")
		await expect(viewport.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			sidebar.getBoundingClientRect().right,
		)
		await expect(column.clientWidth).toBe(viewport.clientWidth)
		await expect(viewport.clientHeight).toBeLessThan(window.innerHeight)
		await expect(viewport).toHaveClass("scrollbar-overlay")
		await expect(viewport.clientWidth).toBe(viewport.offsetWidth)
	},
})

export const SpaceTinted = meta.story({
	args: {
		sidebar: SIDEBAR,
		spaceTint: "blue",
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same shell with a space in view, whose colour washes the window surface. Check that the tint lands on the surface around the card and never on the card itself, that it stays faint enough for the sidebar text to read exactly as it does untinted, and that it is derived from the space colour custom property so a palette or colour-scheme change repaints it on its own. Moving between spaces settles the surface onto the new tint over a beat rather than swapping it, and reduced motion drops that settle. Pick `Default` for the untinted surface.",
			},
		},
	},
	play: async ({ canvas }) => {
		const surface = shellSurface(canvas)

		await expect(surface.style.getPropertyValue("--space-tint")).toBe(
			"var(--bot-blot-blue)",
		)
		await expect(paintOf(surface)).toBe(shellPaintFor("var(--bot-blot-blue)"))
		await expect(paintOf(surface)).not.toBe(shellPaintFor())
		await expect(paintOf(canvas.getByRole("main"))).toBe(
			paintFor("var(--background)"),
		)
	},
})

export const Collapsed = meta.story({
	args: {
		sidebar: SIDEBAR,
		defaultOpen: false,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same workspace opened with the sidebar already collapsed, which is how a host restores a remembered choice through `defaultOpen`. Check that the main column takes the room the panel gave up rather than leaving a gap beside the rail, that the trigger stays on the rail, and that activating it widens the panel while the conversation reflows without reloading. The session list hides itself on the rail — that is the panel's own collapse behaviour, not the shell's. Check too that the main column keeps its full height across both widths. Pick `Default` for the expanded panel, `OffCanvas` for the drawer a narrow window gets instead.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const trigger = canvas.getByRole("button", { name: "Toggle workspace" })
		const main = canvas.getByRole("main")
		const sidebar = canvas.getByRole("complementary", { name: "Workspace" })
		const mainHeight = main.getBoundingClientRect().height
		const railWidth = sidebar.getBoundingClientRect().width

		await expect(stateOf(sidebar)).toBe("collapsed")
		await expectCardDetached(main, sidebar.getBoundingClientRect().right)

		await userEvent.click(trigger)
		await expect(stateOf(sidebar)).toBe("expanded")
		await waitFor(async () => {
			await expect(sidebar.getBoundingClientRect().width).toBeGreaterThan(
				railWidth,
			)
		}, FRAME_POLL)
		await expect(main.getBoundingClientRect().height).toBe(mainHeight)
	},
})

export const OffCanvas = meta.story({
	globals: { viewport: { value: "mobile" } },
	args: {
		children: CHAT_WITH_TRIGGER,
		sidebar: <AppSidebar bots={ROSTER} selectedBotId="atlas" />,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The same shell on a window too narrow for two columns, where the panel stops being a column and becomes a drawer over the page. Check that the conversation keeps the whole width until the trigger in the bar opens the drawer, that the drawer comes in over the transcript with the scrim dimming it rather than pushing it aside, and that Escape closes it and puts focus back on the trigger that opened it. Opening hands the keyboard to the first control in the drawer, whose tooltip opens with it, so the first Escape dismisses that tooltip and the second closes the drawer. The page underneath keeps its full height throughout — the drawer must never resize the column it covers. Pick `Default` for the two-column shell.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const overlay = within(document.body)
		const trigger = canvas.getByRole("button", { name: "Toggle sidebar" })
		const main = canvas.getByRole("main")
		const mainHeight = main.getBoundingClientRect().height

		await expect(overlay.queryByRole("dialog")).toBeNull()
		await expectCardDetached(main, 0)

		await userEvent.click(trigger)

		const drawer = overlay.getByRole("dialog", { name: "Sidebar" })
		await settled(drawer)
		await expect(drawer.getBoundingClientRect().left).toBeCloseTo(0, 0)
		await expect(main.getBoundingClientRect().height).toBe(mainHeight)

		await waitFor(async () => {
			await expect(drawer.contains(document.activeElement)).toBe(true)
		}, FRAME_POLL)

		await userEvent.keyboard("{Escape}{Escape}")
		await waitFor(async () => {
			await expect(overlay.queryByRole("dialog")).toBeNull()
		}, FRAME_POLL)
		await waitFor(async () => {
			await expect(trigger).toHaveFocus()
		}, FRAME_POLL)
		await expect(main.getBoundingClientRect().height).toBe(mainHeight)

		await settled(document.body)
	},
})

export const Empty = meta.story({
	args: {
		children: null,
	},
	parameters: {
		docs: {
			description: {
				story:
					"Both slots empty: no sidebar, no main content. Check that the card still floats on the shell surface with the same gutter on all four edges, with no leftover rail or seam on the leading edge where the sidebar would sit — an omitted sidebar must cost nothing rather than collapse the row. Pick `Default` for the populated shell.",
			},
		},
	},
	play: async ({ canvas }) => {
		const main = canvas.getByRole("main")
		await expect(main).toBeVisible()
		await expect(canvas.queryByRole("complementary")).toBeNull()
		await expectCardDetached(main, 0)
	},
})

export const TallContent = meta.story({
	args: {
		sidebar: SIDEBAR,
		children: OVERFLOWING_CHILD,
	},
	parameters: {
		docs: {
			description: {
				story:
					"The shell handed a child three times taller than the window. Check that the window itself never scrolls — the document stays exactly as tall as the viewport, and no band of background appears under the shell — and that the overflow is clipped inside the main column rather than pushing the sidebar up with it. Whatever a screen puts in that column keeps its own scroll boundary; the shell never lends it the page. Pick `Default` for a conversation that fits.",
			},
		},
	},
	play: async ({ canvas }) => {
		const page = document.scrollingElement as HTMLElement
		await expect(page.scrollHeight).toBe(page.clientHeight)

		const main = canvas.getByRole("main")
		await expect(main.getBoundingClientRect().height).toBeLessThanOrEqual(
			window.innerHeight,
		)

		const sidebar = canvas.getByRole("complementary", { name: "Workspace" })
		await expect(sidebar.getBoundingClientRect().top).toBe(0)
	},
})
