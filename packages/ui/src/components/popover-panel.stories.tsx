import { expect, fn, waitFor, within } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	A11Y_FLOATING_FOCUS_GUARDS,
	listExhaustively,
	Row,
} from "@workspace/storybook/story-utils"
import {
	PopoverPanel,
	type PopoverPanelAlign,
	PopoverPanelContent,
	type PopoverPanelSide,
	PopoverPanelTrigger,
	type PopoverPanelTriggerMode,
} from "@workspace/ui/components/popover-panel"
import { Button } from "@workspace/ui/components/ui/button"

const SIDES = listExhaustively<PopoverPanelSide>({ top: true, bottom: true })

const ALIGNS = listExhaustively<PopoverPanelAlign>({
	start: true,
	center: true,
	end: true,
})

const TRIGGER_MODES = listExhaustively<PopoverPanelTriggerMode>({
	click: true,
	hover: true,
})

const scaleStepRadius = (host: HTMLElement, token: string) => {
	const probe = host.ownerDocument.createElement("div")
	probe.style.borderRadius = `var(${token})`
	host.ownerDocument.body.append(probe)
	const radius = getComputedStyle(probe).borderRadius
	probe.remove()
	return radius
}

const anchorLabel = (side: PopoverPanelSide, align: PopoverPanelAlign) =>
	`${side} ${align}`

const PANEL_TITLE = "Release notes"

const PANEL_NOTE =
	"Companions keep their transcript when the window is reopened."

const PANEL = (
	<>
		<PopoverPanelTrigger>
			<Button variant="outline">{PANEL_TITLE}</Button>
		</PopoverPanelTrigger>
		<PopoverPanelContent aria-label={PANEL_TITLE}>
			<div className="flex flex-col gap-1">
				<p className="font-medium text-sm">{PANEL_TITLE}</p>
				<p className="text-muted-foreground text-xs">{PANEL_NOTE}</p>
			</div>
		</PopoverPanelContent>
	</>
)

const meta = preview.meta({
	title: "Overlays/PopoverPanel",
	component: PopoverPanel,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					'A plain panel anchored to its trigger: it appears where you put it and leaves when it is dismissed, with no transition of its own. The panel is portalled to the body, which is what lets it escape a sidebar\'s overflow, and it is unmounted while closed, so nothing inside it can be tabbed into. `side`, `align` and `sideOffset` come from one context set on the panel, and `trigger` switches the whole panel between click and hover. `role="dialog"` carries no name of its own: always pass `aria-label` to `PopoverContent`.',
			},
		},
	},
	args: {
		children: PANEL,
		side: "bottom",
		align: "center",
		trigger: "click",
		onOpenChange: fn(),
	},
	argTypes: {
		side: { control: "inline-radio", options: SIDES },
		align: { control: "inline-radio", options: ALIGNS },
		trigger: { control: "inline-radio", options: TRIGGER_MODES },
		sideOffset: { control: { type: "number", min: 0, step: 2 } },
	},
})

export const Playground = meta.story({
	args: { children: PANEL },
	parameters: {
		a11y: A11Y_FLOATING_FOCUS_GUARDS,
		docs: {
			description: {
				story:
					"The knob story: turn `sideOffset` up to push the panel further from its trigger. Check that the panel opens on the first click and closes on the second — the trigger toggles, it does not only open — and that `onOpenChange` fires once per gesture. Pick `Open` to review the resting shape without driving it.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)
		const trigger = canvas.getByRole("button", { name: PANEL_TITLE })

		await userEvent.click(trigger)
		await expect(trigger).toHaveAttribute("aria-expanded", "true")
		const panel = await body.findByRole("dialog", { name: PANEL_TITLE })
		await waitFor(async () => expect(panel).toBeVisible())
		await expect(args.onOpenChange).toHaveBeenLastCalledWith(true)

		await userEvent.click(trigger)
		await expect(trigger).toHaveAttribute("aria-expanded", "false")
		await expect(args.onOpenChange).toHaveBeenLastCalledWith(false)
	},
})

export const Open = meta.story({
	args: { children: PANEL, defaultOpen: true },
	parameters: {
		docs: {
			description: {
				story:
					"The panel already out, which is what to review the surface against: a crisp edge, the popover fill, and a trigger that still reads as a button rather than a piece of the panel. Check that the panel keeps `sideOffset` of clearance below its trigger, that its corner is the `--radius-2xl` step of the scale rather than a value of its own, and that `aria-expanded` starts at `true`.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body)
		await expect(
			canvas.getByRole("button", { name: PANEL_TITLE }),
		).toHaveAttribute("aria-expanded", "true")

		const panel = await body.findByRole("dialog", { name: PANEL_TITLE })

		await waitFor(async () => expect(panel).toBeVisible())
		await expect(getComputedStyle(panel).borderRadius).toBe(
			scaleStepRadius(canvasElement, "--radius-2xl"),
		)
	},
})

export const Placements = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Every anchor the panel exposes: two sides by three alignments, all open at once. Check that each panel clears its trigger instead of covering it, and that the requested edge alignment holds wherever the positioner had room. The registry positioner shifts a panel that would leave the viewport, so read a drifted panel as a placement to fix at the call site. Pick `Open` for one panel at review size.",
			},
		},
	},
	render: () => (
		<div className="grid grid-cols-3 gap-x-20 gap-y-28 px-16 py-24">
			{SIDES.flatMap((side) =>
				ALIGNS.map((align) => (
					<PopoverPanel
						key={anchorLabel(side, align)}
						align={align}
						defaultOpen
						side={side}
					>
						<PopoverPanelTrigger>
							<Button variant="outline" size="sm">
								{anchorLabel(side, align)}
							</Button>
						</PopoverPanelTrigger>
						<PopoverPanelContent aria-label={anchorLabel(side, align)}>
							<p className="text-sm">{anchorLabel(side, align)}</p>
						</PopoverPanelContent>
					</PopoverPanel>
				)),
			)}
		</div>
	),
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body)

		for (const side of SIDES) {
			for (const align of ALIGNS) {
				const label = anchorLabel(side, align)
				const panel = await body.findByRole("dialog", { name: label })
				const trigger = body.getByRole("button", { name: label })

				await waitFor(() => {
					const panelBox = panel.getBoundingClientRect()
					const triggerBox = trigger.getBoundingClientRect()

					expect(
						panelBox.bottom <= triggerBox.top ||
							panelBox.top >= triggerBox.bottom,
					).toBe(true)
				})
			}
		}
	},
})

export const Dismiss = meta.story({
	parameters: {
		a11y: A11Y_FLOATING_FOCUS_GUARDS,
		docs: {
			description: {
				story:
					"The three ways out, since the panel has no close button of its own: the trigger toggles it shut, Escape dismisses it from anywhere, and a pointer landing outside dismisses it too. Check that the button beside it still receives its own click on that same gesture — dismissing must not eat the press that caused it — and that the panel is gone from the document once closed, so nothing inside it can be tabbed into. Pick `Playground` for the toggle on its own.",
			},
		},
	},
	render: () => (
		<Row>
			<PopoverPanel>{PANEL}</PopoverPanel>
			<Button variant="ghost">Elsewhere</Button>
		</Row>
	),
	play: async ({ canvas, userEvent }) => {
		const trigger = canvas.getByRole("button", { name: PANEL_TITLE })
		const elsewhere = canvas.getByRole("button", { name: "Elsewhere" })

		await userEvent.click(trigger)
		await expect(trigger).toHaveAttribute("aria-expanded", "true")

		await userEvent.keyboard("{Escape}")
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "false"),
		)

		await userEvent.click(trigger)
		await expect(trigger).toHaveAttribute("aria-expanded", "true")

		await userEvent.click(elsewhere)
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "false"),
		)
	},
})

export const OnHover = meta.story({
	args: { children: PANEL, trigger: "hover" },
	parameters: {
		docs: {
			description: {
				story:
					'Reach for `trigger="hover"` on a panel that only previews — a peek at a resource, never a form — because a pointer that wanders off closes it. Check that the panel opens on hover and on Tab, that moving the pointer from the trigger into the panel does not close it on the way across the neck, and that leaving closes it after a short grace delay. Pick the default `click` mode for anything holding an action.',
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)
		const trigger = canvas.getByRole("button", { name: PANEL_TITLE })

		await userEvent.hover(trigger)
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "true"),
		)
		const panel = await body.findByRole("dialog", { name: PANEL_TITLE })
		await waitFor(async () => expect(panel).toBeVisible())

		await userEvent.hover(panel)
		await expect(trigger).toHaveAttribute("aria-expanded", "true")

		await userEvent.unhover(panel)
		await waitFor(() =>
			expect(
				body.queryByRole("dialog", { name: PANEL_TITLE }),
			).not.toBeInTheDocument(),
		)
		await expect(trigger).toHaveAttribute("aria-expanded", "false")
	},
})

export const LongContent = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A panel far wider than the trigger it grew from. Check that it stops at the `min(92vw, 20rem)` clamp and wraps instead of running off the viewport, and that it still lines up with the trigger rather than drifting off it. Anything longer than this belongs in a dialog — see `Overlays/Dialog`.",
			},
		},
	},
	render: () => (
		<PopoverPanel defaultOpen>
			<PopoverPanelTrigger>
				<Button variant="outline" size="sm">
					v0.4.0
				</Button>
			</PopoverPanelTrigger>
			<PopoverPanelContent aria-label={PANEL_TITLE}>
				<div className="flex flex-col gap-2">
					<p className="font-medium text-sm">{PANEL_TITLE}</p>
					<p className="text-muted-foreground text-xs">
						{PANEL_NOTE} The workspace shell paints its first frame before the
						roster resolves, so a cold start no longer stares at an empty
						column, and a tool result arriving after a stop no longer takes the
						window down with it.
					</p>
				</div>
			</PopoverPanelContent>
		</PopoverPanel>
	),
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Keyboard focus on the trigger and a disabled trigger beside it. Check that Tab reaches the first trigger with a visible ring and that Enter opens the panel without a pointer, and that the disabled one takes neither focus nor a click - a panel behind an unreachable trigger is content nobody can read.",
			},
		},
	},
	render: () => (
		<Row>
			<PopoverPanel>{PANEL}</PopoverPanel>
			<PopoverPanel>
				<PopoverPanelTrigger>
					<Button disabled variant="outline">
						Unavailable
					</Button>
				</PopoverPanelTrigger>
				<PopoverPanelContent aria-label="Unavailable">
					<p className="text-sm">{PANEL_NOTE}</p>
				</PopoverPanelContent>
			</PopoverPanel>
		</Row>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const body = within(canvasElement.ownerDocument.body)
		const trigger = canvas.getByRole("button", { name: PANEL_TITLE })
		const unavailable = canvas.getByRole("button", { name: "Unavailable" })

		await expect(unavailable).toBeDisabled()

		await userEvent.tab()
		await expect(trigger).toHaveFocus()
		await expect(trigger.matches(":focus-visible")).toBe(true)

		await userEvent.keyboard("{Enter}")
		const panel = await body.findByRole("dialog", { name: PANEL_TITLE })
		await waitFor(async () => expect(panel).toBeVisible())
	},
})
