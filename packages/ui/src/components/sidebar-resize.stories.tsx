// Call sites: packages/ui/src/components/workspace-shell.tsx line 61 for the provider
// and packages/ui/src/components/app-sidebar.tsx line 2269 for the handle

import type { CSSProperties } from "react"
import { expect, fn, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL } from "@workspace/storybook/story-utils"
import { Icons } from "@workspace/ui/components/icons"
import { SidebarMenuRow } from "@workspace/ui/components/sidebar-menu-row"
import {
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MAX_WIDTH,
	SIDEBAR_MIN_WIDTH,
	SIDEBAR_WIDTH_STEP,
	SidebarResizeHandle,
	SidebarResizeProvider,
} from "@workspace/ui/components/sidebar-resize"
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarInset,
	SidebarMenu,
	SidebarMenuItem,
	SidebarProvider,
} from "@workspace/ui/components/ui/sidebar"

const SESSIONS = ["Brief", "Handover", "Retro"]

const SURFACE = "p-4 text-muted-foreground text-sm"

const HANDLE_LABEL = "Resize sidebar"

const LAPTOP = { viewport: { value: "laptop" } }

const shellStyle = (width: number) =>
	({
		"--sidebar-width": `${width}px`,
		"--sidebar-width-icon": "var(--sidebar-rail)",
	}) as CSSProperties

type ShellProps = {
	side: "left" | "right"
	isOpen?: boolean
	isResizable?: boolean
	onWidthChange?: (width: number) => void
}

const Shell = ({
	side,
	isOpen = true,
	isResizable = true,
	onWidthChange,
}: ShellProps) => (
	<SidebarResizeProvider
		defaultWidth={SIDEBAR_DEFAULT_WIDTH}
		isResizable={isResizable}
		onWidthChange={onWidthChange}
	>
		{(resize) => (
			<SidebarProvider defaultOpen={isOpen} style={shellStyle(resize.width)}>
				<Sidebar aria-label="Workspace" collapsible="icon" role="complementary">
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupContent>
								<SidebarMenu>
									{SESSIONS.map((session) => (
										<SidebarMenuItem key={session}>
											<SidebarMenuRow
												icon={<Icons.Message aria-hidden="true" />}
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
					<SidebarResizeHandle side={side} />
				</Sidebar>
				<SidebarInset>
					<p className={SURFACE}>
						Whatever screen the shell hands the room to.
					</p>
				</SidebarInset>
			</SidebarProvider>
		)}
	</SidebarResizeProvider>
)

const meta = preview.meta({
	globals: LAPTOP,
	title: "Navigation/SidebarResize",
	component: SidebarResizeHandle,
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"How wide the panel is, and who decides. The provider owns the width and clamps every answer between 192px and 416px, so no caller can ever hand the shell a width it cannot draw; the handle is the grip on the panel's edge, a `separator` carrying the width as its value. It is a pointer drag, an arrow key step of 16px, and a double press back to the default — three ways to the same number. The handle takes itself off screen wherever a width is not the reader's to set: the icon rail, a narrow window, a shell that declared itself fixed.",
			},
		},
	},
})

export const Default = meta.story({
	render: () => <Shell onWidthChange={fn()} side="left" />,
	parameters: {
		docs: {
			description: {
				story:
					"The grip on an open panel, at the width the shell starts on. Check that it is announced as a separator carrying the current width between its two bounds rather than as a nameless strip, that it is reachable by keyboard, and that an arrow key moves the width by one 16px step — a reader who cannot drag still owns the panel width. Pick `Collapsed` or `Fixed` for the cases where the grip is not offered at all.",
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const handle = canvas.getByRole("separator", { name: HANDLE_LABEL })

		await expect(handle).toHaveAttribute(
			"aria-valuenow",
			String(SIDEBAR_DEFAULT_WIDTH),
		)
		await expect(handle).toHaveAttribute(
			"aria-valuemin",
			String(SIDEBAR_MIN_WIDTH),
		)
		await expect(handle).toHaveAttribute(
			"aria-valuemax",
			String(SIDEBAR_MAX_WIDTH),
		)

		handle.focus()
		await expect(handle).toHaveFocus()
		await userEvent.keyboard("{ArrowRight}")

		await waitFor(async () => {
			await expect(handle).toHaveAttribute(
				"aria-valuenow",
				String(SIDEBAR_DEFAULT_WIDTH + SIDEBAR_WIDTH_STEP),
			)
		}, FRAME_POLL)
	},
})

export const Clamped = meta.story({
	render: () => <Shell onWidthChange={fn()} side="left" />,
	parameters: {
		docs: {
			description: {
				story:
					"The reader asking for a panel narrower than the app can draw. Check that the width stops at 192px instead of following the pointer to zero, and that the value the handle announces is the clamped one rather than the one that was asked for — the bound belongs to the provider, so nothing downstream ever sees an impossible width.",
			},
		},
	},
	play: async ({ canvas }) => {
		const handle = canvas.getByRole("separator", { name: HANDLE_LABEL })
		const panel = canvas.getByRole("complementary", { name: "Workspace" })
		const { left, top } = handle.getBoundingClientRect()

		handle.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				button: 0,
				clientX: left,
				clientY: top,
			}),
		)
		window.dispatchEvent(
			new PointerEvent("pointermove", { bubbles: true, clientX: left - 400 }),
		)
		window.dispatchEvent(
			new PointerEvent("pointerup", { bubbles: true, clientX: left - 400 }),
		)

		await waitFor(async () => {
			await expect(handle).toHaveAttribute(
				"aria-valuenow",
				String(SIDEBAR_MIN_WIDTH),
			)
		}, FRAME_POLL)
		await waitFor(async () => {
			await expect(panel.getBoundingClientRect().width).toBe(SIDEBAR_MIN_WIDTH)
		}, FRAME_POLL)
	},
})

export const Collapsed = meta.story({
	render: () => <Shell isOpen={false} onWidthChange={fn()} side="left" />,
	parameters: {
		docs: {
			description: {
				story:
					"The panel down to its icon rail. Check that the grip is gone rather than disabled: the rail has one width and the reader has nothing to set, so offering a control that cannot change anything would be a lie. `Default` is the same shell with the panel open.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("separator")).toBeNull()
	},
})

export const Fixed = meta.story({
	render: () => <Shell isResizable={false} side="left" />,
	parameters: {
		docs: {
			description: {
				story:
					"A shell that declared its panel width fixed, which is how a screen with no room to give renders. Check that the grip is absent and that the panel still draws at the width it was handed — the provider keeps owning the number even where nobody may change it.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("separator")).toBeNull()
		await expect(
			canvas.getByRole("complementary", { name: "Workspace" }),
		).toBeVisible()
	},
})
