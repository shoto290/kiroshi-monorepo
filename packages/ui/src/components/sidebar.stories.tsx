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

const railWidth = (panel: HTMLElement) => {
	const shell = panel.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')
	if (!shell) throw new Error("no sidebar wrapper to read the rail width from")
	const probe = document.createElement("div")
	probe.style.width = "var(--sidebar-width-icon)"
	shell.append(probe)
	const width = probe.getBoundingClientRect().width
	probe.remove()
	return width
}

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
					'The collapsible side panel as the shadcn registry ships it: a provider owning the open state and the Cmd/Ctrl+B shortcut, a panel that reserves its own room in the row, and an inset taking whatever room is left. `collapsible="icon"` is the mode this app runs in — collapsing narrows the panel to an icon rail rather than sliding it off the canvas — and on a window too narrow for two columns the panel becomes a drawer instead. Every slot is a plain box: header, content, footer, group, menu. A row with an icon and a label is not one of them, so `SidebarMenuRow` composes it beside the registry, and `NestedSidebarProvider` composes the second provider a trailing panel needs, which is how the activity panel sits opposite this one.',
			},
		},
	},
})

export const Expanded = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The panel open, which is where a reader starts. Check that the group label and every row label read in full, that the selected row is marked by more than its background — it carries `data-active` and `aria-current` — and that the inset starts where the panel ends rather than running under it. Pick `Collapsed` for the icon rail.",
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

export const Collapsed = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The same panel after the trigger takes it down to the icon rail. Check that the panel is exactly one rail wide, that each row keeps its icon and loses its label without losing its accessible name — the label is the row's `aria-label` on the rail — and that the trigger stays reachable so the rail is never a dead end. Pick `Expanded` for the open panel, `RightSide` for the trailing edge.",
			},
		},
	},
	render: () => (
		<SidebarProvider defaultOpen={false}>
			<Panel label="Workspace" />
			<SidebarInset>
				<p className={SURFACE}>Whatever screen the shell hands the room to.</p>
			</SidebarInset>
		</SidebarProvider>
	),
	play: async ({ canvas, userEvent }) => {
		const panel = canvas.getByRole("complementary", { name: "Workspace" })
		const rail = railWidth(panel)

		await expect(stateOf(panel)).toBe("collapsed")
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeCloseTo(rail, 0)
		}, FRAME_POLL)

		const row = canvas.getByRole("button", { name: SESSIONS[0] })
		await expect(row).toHaveAttribute("aria-label", SESSIONS[0])
		await expect(canvas.getByText(SESSIONS[0])).toHaveAttribute(
			"aria-hidden",
			"true",
		)

		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle Workspace" }),
		)
		await expect(stateOf(panel)).toBe("expanded")
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBeGreaterThan(rail)
		}, FRAME_POLL)
	},
})

export const RightSide = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A panel on the trailing edge, which is what an activity panel is. Check that it holds the trailing end of the row rather than the leading one, that the inset sits between the two panels, and that each panel answers only its own trigger: two providers, two open states, so collapsing one leaves the other exactly where it was. Cmd/Ctrl+B belongs to the outer provider alone — the registry hangs that shortcut on the window, so a second registry provider nested inside would answer the same press. `NestedSidebarProvider` is the composed provider that drops the shortcut and keeps the handler, so the trailing panel holds its state and its width across the press. Pick `Expanded` for the single panel.",
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

		const workspaceWidth = workspace.getBoundingClientRect().width
		await userEvent.keyboard("{Meta>}b{/Meta}")

		await expect(stateOf(workspace)).toBe("collapsed")
		await expect(stateOf(activity)).toBe("expanded")
		await expect(activity.getBoundingClientRect().width).toBe(activityWidth)
		await waitFor(async () => {
			await expect(workspace.getBoundingClientRect().width).toBeLessThan(
				workspaceWidth,
			)
		}, FRAME_POLL)
	},
})
