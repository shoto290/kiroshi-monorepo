import { expect, fn, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { ShareButton } from "@workspace/ui/components/share-button"

const ITERATION_FIVE =
	"Measured against the Paper page `Iteration 5` of `Kiroshi, Invitations`, artboard 5.1, dark only."

const meta = preview.meta({
	title: "Navigation/ShareButton",
	component: ShareButton,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The title bar control a space's host presses to invite people into it. It only reports the press through `onShare`: what opens next belongs to the caller. A guest never sees it; `HostPill` takes its place.",
			},
		},
	},
	args: { onShare: fn() },
})

export const Default = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} The host's title bar control. Check it is 24px tall with 8px inline padding, 8px corners and a 1px border, that the 14px users icon sits 6px before \`Share\` in 13px on a 16px line at weight 500, and that a press calls \`onShare\` once. Pick \`HostPill\` for a guest.`,
			},
		},
	},
	play: async ({ args, canvas, userEvent }) => {
		const button = canvas.getByRole("button", { name: "Share" })
		const style = getComputedStyle(button)
		await expect(button.getBoundingClientRect().height).toBe(24)
		await expect(style.paddingInlineStart).toBe("8px")
		await expect(style.paddingInlineEnd).toBe("8px")
		await expect(style.columnGap).toBe("6px")
		await expect(style.borderTopLeftRadius).toBe("8px")
		await expect(style.borderTopWidth).toBe("1px")
		await expect(style.fontSize).toBe("13px")
		await expect(style.lineHeight).toBe("16px")
		await expect(style.fontWeight).toBe("500")
		await waitFor(() => expect(style.color).toBe("rgb(245, 245, 245)"))
		const icon = button.querySelector("svg")
		if (!icon) throw new Error("The button draws no icon")
		await expect(icon.getBoundingClientRect().width).toBe(14)
		await expect(icon).toHaveAttribute("aria-hidden", "true")

		await userEvent.click(button)
		await expect(args.onShare).toHaveBeenCalledOnce()
	},
})
