// Call site: packages/ui/src/components/ui/sidebar.tsx line 184

import type { ComponentType, ReactNode } from "react"
import { expect, screen, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import { Sheet } from "@workspace/ui/components/ui/sheet"
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarInset,
	SidebarMenu,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"

type SheetArgs = {
	children?: ReactNode
	open?: boolean
}

const TypedSheet = Sheet as ComponentType<SheetArgs>

const SESSIONS = ["Brief", "Handover", "Retro"]

const SURFACE = "p-4 text-muted-foreground text-sm"

const MOBILE = { viewport: { value: "mobile" } }

const DRAWER_WIDTH = "18rem"

const WorkspaceOnMobile = () => (
	<SidebarProvider>
		<Sidebar aria-label="Workspace" collapsible="icon" role="complementary">
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{SESSIONS.map((session) => (
								<SidebarMenuItem key={session}>
									<SidebarMenuRow
										icon={<Icons.Message aria-hidden="true" />}
										isActive={session === SESSIONS[0]}
										label={session}
									>
										{session}
									</SidebarMenuRow>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
		<SidebarInset>
			<SidebarTrigger aria-label="Toggle workspace" />
			<p className={SURFACE}>Whatever screen the shell hands the room to.</p>
		</SidebarInset>
	</SidebarProvider>
)

const meta = preview.meta({
	globals: MOBILE,
	title: "Overlays/Sheet",
	component: TypedSheet,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The drawer the registry ships on the Base UI dialog: a backdrop plus a popup pinned to one edge of the window, which slides in and takes focus like any other modal. It is reached in one place in this app — the branch `Sidebar` takes when the window is too narrow for two columns, where the panel stops reserving a column and becomes a drawer over the screen instead. The stories below are that branch, at the mobile viewport that produces it.",
			},
		},
	},
	render: () => <WorkspaceOnMobile />,
})

export const Closed = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The narrow window before anyone asks for the panel, which is where a reader starts. Check that the screen takes the whole width — no column is reserved for a panel that is not on screen — and that nothing of the drawer is in the accessible tree yet, so a reader walking the page never meets a row they cannot reach. Pick `Drawer` for the same window once the panel is asked for. The sidebar becomes this drawer under `apps/app/src/App.tsx:935`.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("dialog")).toBeNull()
		await expect(canvas.queryByRole("button", { name: SESSIONS[0] })).toBeNull()
	},
})

export const Drawer = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The panel asked for on a narrow window: the same rows as on a wide one, drawn over the screen instead of beside it. Check that the drawer is a modal dialog rather than a panel that merely looks like one — it is named, it holds the focus and it is announced as a dialog — and that the backdrop covers the screen behind it. The width is the one thing that does not hold: the branch sets `--sidebar-width` to 18rem on the popup, and the registry's own `data-[side=left]:w-3/4` wins over the class reading it, so the drawer is painted at three quarters of the window instead. Both are asserted here, the intent and the paint, because the fix belongs to `ui/sidebar.tsx`, which this branch does not touch. Pick `Closed` for the state before the press. The sidebar becomes this drawer under `apps/app/src/App.tsx:935`.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle workspace" }),
		)

		const drawer = await screen.findByRole("dialog", { name: "Sidebar" })
		await waitFor(() => expect(drawer).toBeVisible(), FRAME_POLL)

		await expect(drawer.dataset.mobile).toBe("true")
		await expect(
			getComputedStyle(drawer).getPropertyValue("--sidebar-width"),
		).toBe(DRAWER_WIDTH)
		await expect(drawer.getBoundingClientRect().width).toBe(
			window.innerWidth * 0.75,
		)
		await expect(drawer).toHaveAttribute("data-open")
		await expect(
			screen.getByRole("button", { name: SESSIONS[0] }),
		).toBeVisible()
	},
})
