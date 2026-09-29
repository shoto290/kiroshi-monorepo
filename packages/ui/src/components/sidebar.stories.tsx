import { useState } from "react"
import { expect, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { NestedSidebarProvider } from "@workspace/ui/components/nested-sidebar-provider"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@workspace/ui/components/ui/sidebar"

const SESSIONS = ["Brief", "Handover", "Retro"]

const SURFACE = "p-4 text-muted-foreground text-sm"

const stateOf = (panel: HTMLElement) =>
	panel.closest<HTMLElement>('[data-slot="sidebar"]')?.dataset.state

interface PanelProps {
	label: string
	side?: "left" | "right"
}

const Panel = ({ label, side }: PanelProps) => (
	<Sidebar
		aria-label={label}
		collapsible="icon"
		role="complementary"
		side={side}
	>
		<SidebarHeader>
			<SidebarTrigger aria-label={`Toggle ${label}`} />
		</SidebarHeader>
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel>Sessions</SidebarGroupLabel>
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
		<SidebarFooter />
	</Sidebar>
)

const TwoPanels = () => {
	const [isActivityOpen, setActivityOpen] = useState(true)

	return (
		<SidebarProvider>
			<Panel label="Workspace" />
			<SidebarInset>
				<NestedSidebarProvider
					onOpenChange={setActivityOpen}
					open={isActivityOpen}
				>
					<p className={SURFACE}>
						Whatever screen the shell hands the room to.
					</p>
					<Panel label="Activity" side="right" />
				</NestedSidebarProvider>
			</SidebarInset>
		</SidebarProvider>
	)
}

const meta = preview.meta({
	title: "Navigation/Sidebar",
	component: SidebarProvider,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The collapsible side panel as the shadcn registry ships it: a provider owning the open state and the Cmd/Ctrl+B shortcut, a panel that reserves its own room in the row, and an inset taking whatever room is left. The `WorkspaceShell` of the app pins it expanded at one fixed width, so the app never collapses it; on a window too narrow for two columns the panel becomes a drawer instead. Every slot is a plain box: header, content, footer, group, menu. A row with an icon and a label is not one of them, so `SidebarMenuRow` composes it beside the registry, and `NestedSidebarProvider` composes the second provider a trailing panel needs, which is how the activity panel sits opposite this one.",
			},
		},
	},
})

export const Expanded = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The panel open, which is where a reader starts. Check that the group label and every row label read in full, that the selected row is marked by more than its background — it carries `data-active` and `aria-current` — and that the inset starts where the panel ends rather than running under it. The app assembles it at `apps/app/src/App.tsx:935`.",
			},
		},
	},
	render: () => (
		<SidebarProvider>
			<Panel label="Workspace" />
			<SidebarInset>
				<p className={SURFACE}>Whatever screen the shell hands the room to.</p>
			</SidebarInset>
		</SidebarProvider>
	),
	play: async ({ canvas }) => {
		const panel = canvas.getByRole("complementary", { name: "Workspace" })
		const selected = canvas.getByRole("button", { name: SESSIONS[0] })

		await expect(stateOf(panel)).toBe("expanded")
		await expect(canvas.getByText("Sessions")).toBeVisible()
		await expect(selected).toHaveAttribute("aria-current", "page")
		await expect(selected).toHaveAttribute("data-active")
		await expect(
			canvas.getByRole("main").getBoundingClientRect().left,
		).toBeGreaterThanOrEqual(panel.getBoundingClientRect().right)
	},
})

export const RightSide = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A panel on the trailing edge, which is what an activity panel is. Check that it holds the trailing end of the row rather than the leading one, that the inset sits between the two panels, and that each panel answers only its own trigger: two providers, two open states, so collapsing one leaves the other exactly where it was. Pick `Expanded` for the single panel. The routines panel hangs on the trailing edge under `apps/app/src/components/thread-screen.tsx:1368`.",
			},
		},
	},
	render: () => <TwoPanels />,
	play: async ({ canvas, userEvent }) => {
		const workspace = canvas.getByRole("complementary", { name: "Workspace" })
		const activity = canvas.getByRole("complementary", { name: "Activity" })

		await expect(activity.getBoundingClientRect().left).toBeGreaterThan(
			workspace.getBoundingClientRect().right,
		)

		const activityWidth = activity.getBoundingClientRect().width
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle Activity" }),
		)

		await expect(stateOf(activity)).toBe("collapsed")
		await expect(stateOf(workspace)).toBe("expanded")

		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle Activity" }),
		)
		await waitFor(async () => {
			await expect(activity.getBoundingClientRect().width).toBe(activityWidth)
		}, FRAME_POLL)
	},
})
