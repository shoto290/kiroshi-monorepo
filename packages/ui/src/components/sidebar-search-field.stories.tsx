import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { SidebarSearchField } from "@workspace/ui/components/sidebar-search-field"

const SIDEBAR_WIDTH = 240

const RAIL_WIDTH = 68

const LABEL = "Search"

const CHORD = "⌘K"

const HOST_CHORD = "Ctrl K"

const Probe = ({ slot, tone }: { slot: string; tone: string }) => (
	<span className={`hidden ${tone}`} data-slot={slot} />
)

const surfaceOf = (canvasElement: HTMLElement, slot: string) =>
	getComputedStyle(slotIn(canvasElement, slot)).backgroundColor

const meta = preview.meta({
	title: "Navigation/SidebarSearchField",
	component: SidebarSearchField,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The entry point to the search palette, mounted in the sidebar between the header and the roster. It is a button wearing the geometry of a text field rather than a real input: nothing is typed here, the press hands the query over to the palette, and the chord on the trailing keycap says the keyboard reaches it without the pointer. On the icon rail there is no room for a field, so it falls back to the search glyph on a ghost button and moves its label into a tooltip.",
			},
		},
	},
	args: { onOpen: fn() },
	render: (args) => (
		<div style={{ width: SIDEBAR_WIDTH }}>
			<SidebarSearchField {...args} />
		</div>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The field at rest in an open sidebar. Check that it draws the search glyph, the label and the chord on one 36px line, that the label and the glyph stay muted so the field reads as a prompt rather than as filled text, and that a press reports once — the palette is opened by the host, never by this button on its own.",
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const field = canvas.getByRole("button")

		await expect(field).toHaveAccessibleName(expect.stringContaining(LABEL))
		await expect(canvas.getByText(CHORD)).toBeVisible()
		await expect(field.getBoundingClientRect().height).toBe(36)

		await userEvent.click(field)
		await expect(args.onOpen).toHaveBeenCalledTimes(1)
	},
})

export const States = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Rest and keyboard focus side by side. Check that the resting field draws the background surface so it reads as a field rather than as a filled button, and that the one the keyboard reached wears the same ring every other field in the app wears, drawn outside its border instead of replacing it. Reach for `UnderPointer` for the surface the pointer draws.",
			},
		},
	},
	render: (args) => (
		<div className="flex flex-col gap-3" style={{ width: SIDEBAR_WIDTH }}>
			<Probe slot="background-probe" tone="bg-background" />
			<SidebarSearchField {...args} />
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const [rested, focused] = canvas.getAllByRole("button")

		if (!rested || !focused) throw new Error("The two fields are not drawn")

		await expect(getComputedStyle(rested).backgroundColor).toBe(
			surfaceOf(canvasElement, "background-probe"),
		)

		await userEvent.keyboard("{Tab}")
		focused.focus()

		await expect(focused).toHaveFocus()
		await expect(getComputedStyle(focused).boxShadow).not.toBe("none")
		await expect(getComputedStyle(rested).boxShadow).toBe("none")
	},
})

export const UnderPointer = meta.story({
	parameters: {
		pseudo: { hover: true },
		docs: {
			description: {
				story:
					"The field with the pointer resting on it, drawn by the pseudo-state addon. Check by eye that it fills with the muted surface and that its keycap flips to the background colour at the same time — the cap and the field share the muted token, so a cap that stayed put would dissolve into the surface underneath it exactly when the reader is looking at it. The play only holds the two rules in place: a headless run reports no pointer, so the surface itself cannot be measured here.",
			},
		},
	},
	render: (args) => (
		<div style={{ width: SIDEBAR_WIDTH }}>
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("button")).toHaveClass("hover:bg-muted")
		await expect(canvas.getByText(CHORD)).toHaveClass(
			"group-hover/search-field:bg-background",
		)
	},
})

export const WithHostChord = meta.story({
	args: { chord: HOST_CHORD },
	parameters: {
		docs: {
			description: {
				story:
					"The field on a host that binds another chord than the default one. Check that the keycap reads exactly what the host passed and that the catalogue's chord is nowhere on screen — the palette is opened by the app, so the shortcut it advertises has to be the one the app actually listens for.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText(HOST_CHORD)).toBeVisible()
		await expect(canvas.queryByText(CHORD)).toBeNull()
	},
})

export const CollapsedRail = meta.story({
	args: { isCollapsed: true },
	parameters: {
		docs: {
			description: {
				story:
					"The field once the sidebar is down to its 68px icon rail. Check that nothing is left but the glyph on a centred ghost button, that the chord and the label are dropped from the markup rather than clipped, and that the label survives as the button's accessible name and its tooltip, so the rail still says what the button opens.",
			},
		},
	},
	render: (args) => (
		<div style={{ width: RAIL_WIDTH }}>
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const rail = canvas.getByRole("button")
		const slot = slotIn(canvasElement, "sidebar-search-field")

		await expect(rail).toHaveAccessibleName(LABEL)
		await expect(canvas.queryByText(CHORD)).toBeNull()
		await expect(slot).toHaveAttribute("data-collapsed", "true")

		const centre = rail.getBoundingClientRect()
		const box = slot.getBoundingClientRect()

		await expect(Math.round(centre.left - box.left)).toBe(
			Math.round(box.right - centre.right),
		)

		await userEvent.click(rail)
		await expect(args.onOpen).toHaveBeenCalledTimes(1)
	},
})
