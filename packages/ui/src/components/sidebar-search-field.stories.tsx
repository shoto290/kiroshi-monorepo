import { expect, fn } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { SidebarSearchField } from "@workspace/ui/components/sidebar-search-field"

const SIDEBAR_WIDTH = 240

const RAIL_WIDTH = 68

const SQUEEZED_WIDTH = 96

const FIELD_HEIGHT = 36

const GLYPH_SIZE = 16

const LABEL = "Search"

const CHORD = "⌘K"

const HOST_CHORD = "Ctrl K"

const TRANSPARENT = "rgba(0, 0, 0, 0)"

const ROSTER_HOVER_FILL = "hover:bg-sidebar-accent/70"

const ACCENT_LABEL_UNDER_POINTER =
	"group-hover/search-field:text-sidebar-accent-foreground"

const ACCENT_GLYPH_UNDER_POINTER =
	"group-hover/search-field:text-sidebar-accent-foreground/70"

const Probe = ({ slot, tone }: { slot: string; tone: string }) => (
	<span className={`hidden ${tone}`} data-slot={slot} />
)

const Probes = () => (
	<>
		<Probe slot="roster-hover-probe" tone="bg-sidebar-accent/70" />
		<Probe slot="keycap-probe" tone="bg-sidebar-foreground/10" />
		<Probe slot="sidebar-probe" tone="bg-sidebar" />
		<Probe slot="accent-glyph-probe" tone="text-sidebar-accent-foreground/70" />
		<Probe slot="accent-label-probe" tone="text-sidebar-accent-foreground" />
	</>
)

const surfaceOf = (scope: HTMLElement, slot: string) =>
	getComputedStyle(slotIn(scope, slot)).backgroundColor

const toneOf = (scope: HTMLElement, slot: string) =>
	getComputedStyle(slotIn(scope, slot)).color

const keycapIn = (field: HTMLElement) => slotIn(field, "kbd")

const glyphIn = (field: HTMLElement) => {
	const glyph = field.querySelector("svg")
	if (!glyph) throw new Error("The search glyph is not drawn")
	return glyph
}

const meta = preview.meta({
	title: "Navigation/SidebarSearchField",
	component: SidebarSearchField,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The entry point to the search palette, mounted in the sidebar between the header and the roster. It is a button wearing the geometry of a text field rather than a real input: nothing is typed here, the press hands the query over to the palette, and the chord on the trailing keycap says the keyboard reaches it without the pointer. It wears the roster's own recipe rather than the settings-form one — the outline of a section card at rest, the fill of a roster row under the pointer — so the sidebar reads as one family from the field down to the last row. On the icon rail there is no room for a field, so it falls back to the search glyph on a ghost button and moves its label into a tooltip.",
			},
		},
	},
	args: { onOpen: fn() },
	render: (args) => (
		<div className="bg-sidebar p-2" style={{ width: SIDEBAR_WIDTH }}>
			<Probes />
			<SidebarSearchField {...args} />
		</div>
	),
})

export const Default = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The field at rest on the sidebar surface. Check that it draws the search glyph, the label and the chord on one 36px line inside an outlined box that fills with nothing of its own — the sidebar shows through, so the box reads as a frame drawn on the surface rather than a well cut into it — that the box is bounded by a minimum rather than a fixed height, so content taller than the line grows it instead of being clipped, and that a press reports once: the palette is opened by the host, never by this button on its own.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const field = canvas.getByRole("button")

		await expect(field).toHaveAccessibleName(expect.stringContaining(LABEL))
		await expect(canvas.getByText(CHORD)).toBeVisible()
		await expect(field.getBoundingClientRect().height).toBe(FIELD_HEIGHT)
		await expect(getComputedStyle(field).minHeight).toBe(`${FIELD_HEIGHT}px`)
		await expect(getComputedStyle(field).overflow).toBe("visible")
		await expect(getComputedStyle(field).backgroundColor).toBe(TRANSPARENT)
		await expect(getComputedStyle(keycapIn(field)).backgroundColor).toBe(
			surfaceOf(canvasElement, "keycap-probe"),
		)
		await expect(field).toHaveClass("motion-reduce:transition-none")

		await userEvent.click(field)
		await expect(args.onOpen).toHaveBeenCalledTimes(1)
	},
})

export const UnderPointer = meta.story({
	parameters: {
		pseudo: { hover: true },
		docs: {
			description: {
				story:
					"The field with the pointer resting on it, drawn by the pseudo-state addon. Check by eye that it fills with the surface a roster row takes under the pointer and that the glyph and the keycap label rise onto the accent foreground with it, while the keycap's own surface stays where it was — the cap is relabelled, not refilled. The play only holds those rules in place: a headless run reports no pointer, so the tones themselves cannot be measured here. `KeyboardFocus` measures them on the state the keyboard can reach.",
			},
		},
	},
	play: async ({ canvas }) => {
		const field = canvas.getByRole("button")

		await expect(field).toHaveClass(ROSTER_HOVER_FILL)
		await expect(keycapIn(field)).toHaveClass(ACCENT_LABEL_UNDER_POINTER)
		await expect(glyphIn(field)).toHaveClass(ACCENT_GLYPH_UNDER_POINTER)
		await expect(keycapIn(field).className).not.toMatch(/hover.*bg-/)
	},
})

export const KeyboardFocus = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"Rest and keyboard focus side by side. Check that the resting field carries no fill and no ring, that the one the keyboard reached takes the roster's hover surface plus the ring every roster row and section trigger already wears, drawn outside its border rather than replacing it, and that it carries the pointer's own skin down to the glyph and the keycap label, both risen onto the accent foreground. The keycap's surface is the one thing that does not move: it holds the same tone on both fields, so the cap reads as part of the field rather than as a second control lighting up inside it.",
			},
		},
	},
	render: (args) => (
		<div
			className="flex flex-col gap-3 bg-sidebar p-2"
			style={{ width: SIDEBAR_WIDTH }}
		>
			<Probes />
			<SidebarSearchField {...args} />
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ canvas, canvasElement, userEvent }) => {
		const [rested, focused] = canvas.getAllByRole("button")

		if (!rested || !focused) throw new Error("The two fields are not drawn")

		await userEvent.tab()
		await userEvent.tab()

		await expect(focused).toHaveFocus()
		await expect(getComputedStyle(focused).backgroundColor).toBe(
			surfaceOf(canvasElement, "roster-hover-probe"),
		)
		await expect(getComputedStyle(focused).boxShadow).not.toBe("none")

		await expect(getComputedStyle(glyphIn(focused)).color).toBe(
			toneOf(canvasElement, "accent-glyph-probe"),
		)
		await expect(getComputedStyle(keycapIn(focused)).color).toBe(
			toneOf(canvasElement, "accent-label-probe"),
		)

		await expect(getComputedStyle(rested).backgroundColor).toBe(TRANSPARENT)
		await expect(getComputedStyle(rested).boxShadow).toBe("none")
		await expect(getComputedStyle(keycapIn(focused)).backgroundColor).toBe(
			getComputedStyle(keycapIn(rested)).backgroundColor,
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

export const LabelWiderThanField = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"The field squeezed to 96px, narrower than the label it carries. Check that the label alone gives way, clipped with an ellipsis, while the glyph keeps its 16px and the keycap keeps the width its chord needs: the two ends of the field are what the reader navigates by, and a cap squeezed out of shape says nothing about the shortcut it names.",
			},
		},
	},
	render: (args) => (
		<div className="bg-sidebar p-2" style={{ width: SQUEEZED_WIDTH }}>
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ canvas }) => {
		const field = canvas.getByRole("button")
		const label = canvas.getByText(LABEL)
		const keycap = keycapIn(field)

		await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth)
		await expect(glyphIn(field).getBoundingClientRect().width).toBe(GLYPH_SIZE)
		await expect(keycap.getBoundingClientRect().width).toBe(keycap.scrollWidth)
		await expect(field.getBoundingClientRect().height).toBe(FIELD_HEIGHT)
	},
})

export const OnDarkSurface = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story:
					"The same resting field on the dark sidebar. Check that the outline, the label, the glyph and the keycap all stay off the surface behind them rather than dissolving into it — every one of them is a sidebar token, so the dark theme is designed here and not inverted.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		const field = canvas.getByRole("button")
		const label = canvas.getByText(LABEL)
		const surface = surfaceOf(canvasElement, "sidebar-probe")

		await expect(getComputedStyle(field).backgroundColor).toBe(TRANSPARENT)
		await expect(getComputedStyle(field).borderTopColor).not.toBe(surface)
		await expect(getComputedStyle(label).color).not.toBe(surface)
		await expect(getComputedStyle(glyphIn(field)).color).not.toBe(surface)
		await expect(getComputedStyle(keycapIn(field)).backgroundColor).not.toBe(
			surface,
		)
	},
})

export const CollapsedRail = meta.story({
	args: { isCollapsed: true },
	parameters: {
		docs: {
			description: {
				story:
					"The field once the sidebar is down to its 68px icon rail. Check that nothing is left but the glyph on a centred ghost button, that the chord and the label are dropped from the markup rather than clipped, that the label survives as the button's accessible name and its tooltip, so the rail still says what the button opens, and that the button fills with the roster's hover surface like every row beside it.",
			},
		},
	},
	render: (args) => (
		<div className="bg-sidebar p-2" style={{ width: RAIL_WIDTH }}>
			<SidebarSearchField {...args} />
		</div>
	),
	play: async ({ args, canvas, canvasElement, userEvent }) => {
		const rail = canvas.getByRole("button")
		const slot = slotIn(canvasElement, "sidebar-search-field")

		await expect(rail).toHaveAccessibleName(LABEL)
		await expect(canvas.queryByText(CHORD)).toBeNull()
		await expect(slot).toHaveAttribute("data-collapsed", "true")
		await expect(rail).toHaveClass(ROSTER_HOVER_FILL)

		const centre = rail.getBoundingClientRect()
		const box = slot.getBoundingClientRect()

		await expect(Math.round(centre.left - box.left)).toBe(
			Math.round(box.right - centre.right),
		)

		await userEvent.click(rail)
		await expect(args.onOpen).toHaveBeenCalledTimes(1)
	},
})
