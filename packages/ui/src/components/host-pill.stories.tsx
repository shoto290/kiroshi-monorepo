import { expect, screen } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { slotIn } from "@workspace/storybook/story-utils"
import { HostPill } from "@workspace/ui/components/host-pill"

const ITERATION_FIVE =
	"Measured against the Paper page `Iteration 5` of `Kiroshi, Invitations`, dark only."

const PRESENCE_ONLINE = "rgb(63, 180, 102)"

const PRESENCE_OFFLINE = "rgb(115, 115, 115)"

const FOREGROUND = "rgb(245, 245, 245)"

const MUTED_FOREGROUND = "rgb(163, 163, 163)"

const meta = preview.meta({
	title: "Navigation/HostPill",
	component: HostPill,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"What a guest's title bar says about the space they joined: whether the Mac hosting it is reachable right now, never who the host is. A dot on the presence colour carries the state alongside the words `Connected` or `Not connected`, never instead of them, and those words are its only readable content. It is a plain label, not a control, and carries no tooltip. It replaces `ShareButton`, which only a host sees.",
			},
		},
	},
	args: {
		isOnline: true,
	},
})

const expectPillGeometry = async (pill: HTMLElement) => {
	const style = getComputedStyle(pill)
	await expect(pill.getBoundingClientRect().height).toBe(24)
	await expect(style.paddingInlineStart).toBe("8px")
	await expect(style.paddingInlineEnd).toBe("10px")
	await expect(style.columnGap).toBe("6px")
	await expect(style.fontSize).toBe("12px")
	await expect(style.lineHeight).toBe("16px")
	await expect(style.fontWeight).toBe("500")
	const dot = slotIn(pill, "host-pill-dot")
	await expect(dot.getBoundingClientRect().width).toBe(7)
	await expect(dot).toHaveAttribute("aria-hidden", "true")
	return dot
}

export const Online = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} 5.6: a guest whose host's Mac answers. Check the 24px pill is fully rounded with 8px before the 7px online dot and 10px after the label, that it reads \`Connected\` in 12px at weight 500, that it is no button and sits outside the tab order, that hovering it opens no tooltip, and that no \`@\` appears. Pick \`Offline\` for the host that stopped answering.`,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const pill = canvas.getByText("Connected").parentElement as HTMLElement
		await expect(pill).toHaveTextContent(/^Connected$/)
		await expect(canvas.queryByRole("button")).toBeNull()
		await expect(pill).not.toHaveAttribute("tabindex")
		await expect(pill.textContent).not.toContain("@")
		const dot = await expectPillGeometry(pill)
		await expect(getComputedStyle(dot).backgroundColor).toBe(PRESENCE_ONLINE)
		await expect(getComputedStyle(pill).color).toBe(FOREGROUND)
		await userEvent.hover(pill)
		await expect(screen.queryByRole("tooltip")).toBeNull()
	},
})

export const Offline = meta.story({
	globals: { theme: "dark" },
	args: { isOnline: false },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} 5.7: a guest whose host's Mac is gone. Check the pill keeps the geometry of \`Online\`, that the dot turns to the muted presence colour, and that the label reads \`Not connected\` in the muted foreground as its only readable content. Pick \`Online\` for the reachable host.`,
			},
		},
	},
	play: async ({ canvas }) => {
		const pill = canvas.getByText("Not connected").parentElement as HTMLElement
		await expect(pill).toHaveTextContent(/^Not connected$/)
		await expect(pill.textContent).not.toContain("@")
		const dot = await expectPillGeometry(pill)
		await expect(getComputedStyle(dot).backgroundColor).toBe(PRESENCE_OFFLINE)
		await expect(getComputedStyle(pill).color).toBe(MUTED_FOREGROUND)
	},
})

export const ThemesSideBySide = meta.story({
	globals: { theme_layout: "side-by-side" },
	tags: ["test-only"],
	args: { isOnline: false },
	parameters: {
		docs: {
			description: {
				story:
					"The offline pill in light beside dark, the pair the contrast audit reads: the muted label sits on the opaque light pill fill so it keeps AA wherever the shell is tinted. Pick `Offline` for the measured dark artboard.",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getAllByText("Not connected")).toHaveLength(2)
	},
})
