import { expect, fn, userEvent, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	isInBrowserRunner,
	realPointer,
	settled,
	slotIn,
} from "@workspace/storybook/story-utils"
import { WindowControls } from "@workspace/ui/components/window-controls"
import { contrastRatio, type Rgb } from "@workspace/ui/lib/contrast"

const TITLE_BAR_HEIGHT = 34
const CAPTION_BUTTON_WIDTH = 46
const GLYPH_CONTRAST_MIN = 3
const TRANSPARENT = "rgba(0, 0, 0, 0)"
const NAMES = ["Minimize", "Maximize", "Close"]
const CAPTION_CLOSE_RED = "rgb(196, 43, 28)"
const WHITE = "rgb(255, 255, 255)"

const PAINT = [
	"backgroundColor",
	"color",
	"translate",
	"scale",
	"transform",
] as const

const paintOf = (element: HTMLElement) => {
	const style = getComputedStyle(element)
	return Object.fromEntries(
		PAINT.map((property) => [property, style[property]]),
	)
}

const expectSamePaint = async (forced: HTMLElement, reference: HTMLElement) => {
	await settled(reference)
	await settled(forced)
	await expect(paintOf(forced)).toEqual(paintOf(reference))
}

const toRgb = (color: string) =>
	(color.match(/\d+/g) ?? []).slice(0, 3).map(Number) as Rgb

const captionButtonsIn = (canvasElement: HTMLElement) => [
	...slotIn(canvasElement, "window-controls").querySelectorAll("button"),
]

const meta = preview.meta({
	title: "Layout/WindowControls",
	component: WindowControls,
	args: {
		maximized: false,
		onMinimize: fn(),
		onToggleMaximize: fn(),
		onClose: fn(),
	},
	decorators: [
		(Story) => (
			<div
				className="flex h-8.5 items-center bg-background"
				data-slot="story-title-bar"
			>
				<Story />
			</div>
		),
	],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The minimize, maximize and close buttons a Windows window draws itself once its native title bar is gone. It sits at the trailing edge of the 34px title bar row, three 46px buttons full height with no gap, on a transparent row so the title bar surface shows through. Minimize and maximize take the ghost hover surface; close turns the one red of the Windows caption, the same in both themes, with a white cross. It knows nothing of the platform or the window: the host decides whether to mount it and wires the three callbacks.",
			},
		},
	},
})

export const Rest = meta.story({
	globals: { theme: "light" },
	parameters: {
		docs: {
			description: {
				story:
					"The window at rest, not maximized. Check the three buttons sit flush against the trailing edge, full height, with nothing painted behind them. Pick `RestDark` for the dark scheme.",
			},
		},
	},
	play: async ({ args, canvas, canvasElement }) => {
		const buttons = captionButtonsIn(canvasElement)
		await expect(buttons).toEqual(
			NAMES.map((name) => canvas.getByRole("button", { name })),
		)
		for (const button of buttons) {
			const box = button.getBoundingClientRect()
			await expect(box.height).toBe(TITLE_BAR_HEIGHT)
			await expect(box.width).toBe(CAPTION_BUTTON_WIDTH)
			await expect(getComputedStyle(button).backgroundColor).toBe(TRANSPARENT)
		}
		await expect(
			getComputedStyle(slotIn(canvasElement, "window-controls"))
				.backgroundColor,
		).toBe(TRANSPARENT)
		await expect(buttons.at(-1)?.getBoundingClientRect().right).toBe(
			canvasElement.getBoundingClientRect().right,
		)

		await userEvent.tab()
		await expect(buttons[0]).toHaveFocus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onMinimize).toHaveBeenCalledOnce()
		await userEvent.tab()
		await expect(buttons[1]).toHaveFocus()
		await userEvent.keyboard(" ")
		await expect(args.onToggleMaximize).toHaveBeenCalledOnce()
		await userEvent.tab()
		await expect(buttons[2]).toHaveFocus()
		await userEvent.keyboard("{Enter}")
		await expect(args.onClose).toHaveBeenCalledOnce()
	},
})

export const RestDark = meta.story({
	...Rest.input,
	globals: { theme: "dark" },
})

export const CloseHovered = meta.story({
	globals: { theme: "light" },
	parameters: {
		pseudo: { hover: '[data-slot="window-controls"] > :last-child' },
		docs: {
			description: {
				story:
					"The pointer over close. Check the button fills with the caption red and the cross turns white, and that the red is the same one in `CloseHoveredDark`.",
			},
		},
	},
	play: async ({ canvas, canvasElement }) => {
		if (!isInBrowserRunner()) return
		const close = canvas.getByRole("button", { name: "Close" })
		const pointer = await realPointer()
		await pointer.hover(close)
		await waitFor(() =>
			expect(getComputedStyle(close).backgroundColor).toBe(CAPTION_CLOSE_RED),
		)
		const { color, backgroundColor } = getComputedStyle(close)
		await expect(color).toBe(WHITE)
		await expect(
			contrastRatio(toRgb(color), toRgb(backgroundColor)),
		).toBeGreaterThanOrEqual(GLYPH_CONTRAST_MIN)

		close.focus()
		await pointer.keyboard("{Space>}")
		await expect(close.matches(":active")).toBe(true)
		await settled(close)
		await expect(close.getBoundingClientRect().top).toBe(
			slotIn(canvasElement, "story-title-bar").getBoundingClientRect().top,
		)
		await pointer.keyboard("{/Space}")
	},
})

export const CloseHoveredDark = meta.story({
	...CloseHovered.input,
	globals: { theme: "dark" },
})

export const Maximized = meta.story({
	globals: { theme: "light" },
	args: { maximized: true },
	parameters: {
		docs: {
			description: {
				story:
					"The window filling the screen. Check the middle button draws two overlapping squares and reads Restore. Pick `MaximizedDark` for the dark scheme.",
			},
		},
	},
	play: async ({ canvas }) => {
		const restore = canvas.getByRole("button", { name: "Restore" })
		await expect(restore.querySelector("svg.lucide-copy")).not.toBeNull()
		await expect(restore.querySelector("svg.lucide-square")).toBeNull()
		await expect(
			canvas.queryByRole("button", { name: "Maximize" }),
		).not.toBeInTheDocument()
	},
})

export const MaximizedDark = meta.story({
	...Maximized.input,
	globals: { theme: "dark" },
})

export const MaximizeForcedHover = meta.story({
	globals: { theme: "light" },
	args: { maximizeState: "hover" },
	parameters: {
		docs: {
			description: {
				story:
					"The host reports the pointer over maximize, where Snap Layouts keeps the page from seeing it. Check maximize takes the ghost hover surface with no pointer on it, the same as minimize under a real pointer, and holds it when pressed. Pick `MaximizeForcedHoverDark` for the dark scheme.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		if (!isInBrowserRunner()) return
		const [minimize, maximize] = captionButtonsIn(canvasElement)
		const pointer = await realPointer()
		await pointer.hover(minimize)
		await expectSamePaint(maximize, minimize)

		maximize.focus()
		await pointer.keyboard("{Space>}")
		await expect(maximize.matches(":active")).toBe(true)
		await expectSamePaint(maximize, minimize)
		await pointer.keyboard("{/Space}")
		await expect(args.onToggleMaximize).toHaveBeenCalledOnce()
		await expect(maximize).not.toHaveAttribute("aria-pressed")
	},
})

export const MaximizeForcedHoverDark = meta.story({
	...MaximizeForcedHover.input,
	globals: { theme: "dark" },
})

export const MaximizeForcedPressed = meta.story({
	globals: { theme: "light" },
	args: { maximizeState: "pressed" },
	parameters: {
		docs: {
			description: {
				story:
					"The host reports a press on maximize. Check maximize paints the ghost hover surface and the pressed offset with no pointer on it, the same as minimize under a real press. Pick `MaximizeForcedPressedDark` for the dark scheme.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		if (!isInBrowserRunner()) return
		const [minimize, maximize] = captionButtonsIn(canvasElement)
		const pointer = await realPointer()
		await pointer.hover(minimize)
		minimize.focus()
		await pointer.keyboard("{Space>}")
		await expect(minimize.matches(":active")).toBe(true)
		await expectSamePaint(maximize, minimize)
		await pointer.keyboard("{/Space}")

		await pointer.click(maximize)
		await expect(args.onToggleMaximize).toHaveBeenCalledOnce()
		await expect(maximize).not.toHaveAttribute("aria-pressed")
	},
})

export const MaximizeForcedPressedDark = meta.story({
	...MaximizeForcedPressed.input,
	globals: { theme: "dark" },
})

export const MaximizeForcedIdle = meta.story({
	globals: { theme: "light" },
	args: { maximizeState: "idle" },
	parameters: {
		docs: {
			description: {
				story:
					"The host reports the pointer gone from maximize while the page still sees it there. Check maximize stays at rest under a real hover and press, the same as minimize at rest.",
			},
		},
	},
	play: async ({ args, canvasElement }) => {
		if (!isInBrowserRunner()) return
		const [minimize, maximize] = captionButtonsIn(canvasElement)
		const pointer = await realPointer()
		await pointer.hover(maximize)
		await expect(maximize.matches(":hover")).toBe(true)
		await expectSamePaint(maximize, minimize)

		maximize.focus()
		await pointer.keyboard("{Space>}")
		await expect(maximize.matches(":active")).toBe(true)
		await expectSamePaint(maximize, minimize)
		await pointer.keyboard("{/Space}")
		await expect(args.onToggleMaximize).toHaveBeenCalledOnce()
		await expect(maximize).not.toHaveAttribute("aria-pressed")
	},
})

export const RestoreForcedHover = meta.story({
	...MaximizeForcedHover.input,
	args: { maximized: true, maximizeState: "hover" },
	parameters: {
		docs: {
			description: {
				story:
					"The window filling the screen while the host reports the pointer over restore. Check the two overlapping squares take the same forced hover surface as the maximize glyph.",
			},
		},
	},
})
