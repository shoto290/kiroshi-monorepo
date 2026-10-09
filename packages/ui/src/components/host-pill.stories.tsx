import { expect, screen, waitFor } from "storybook/test"

import preview from "@workspace/storybook/preview"
import { FRAME_POLL, slotIn } from "@workspace/storybook/story-utils"
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
					"What a guest's title bar says about the space they joined: who hosts it, and whether the host's Mac is reachable right now. A dot on the presence colour carries the state alongside the words, never instead of them, and the accessible name says both. Hovering or focusing it opens the host's email and a line on where the space runs. It replaces `ShareButton`, which only a host sees.",
			},
		},
	},
	args: {
		hostName: "Steve",
		hostEmail: "steve@example.com",
		spaceName: "Studio",
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
				story: `${ITERATION_FIVE} 5.6: a guest whose host's Mac answers. Check the 24px pill is fully rounded with 8px before the 7px online dot and 10px after the label, that it reads \`Hosted by Steve\` in 12px at weight 500, and that its accessible name adds that the host is online. Pick \`Offline\` for the host that stopped answering.`,
			},
		},
	},
	play: async ({ canvas }) => {
		const pill = canvas.getByRole("button", {
			name: "Hosted by Steve, online",
		})
		await expect(pill).toHaveTextContent("Hosted by Steve")
		const dot = await expectPillGeometry(pill)
		await expect(getComputedStyle(dot).backgroundColor).toBe(PRESENCE_ONLINE)
		await expect(getComputedStyle(pill).color).toBe(FOREGROUND)
	},
})

export const Offline = meta.story({
	globals: { theme: "dark" },
	args: { isOnline: false },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} 5.7: a guest whose host's Mac is gone. Check the pill keeps the geometry of \`Online\`, that the dot turns to the muted presence colour, and that the label reads \`Steve’s Mac is offline\` in the muted foreground, which is also its whole accessible name. Pick \`Online\` for the reachable host.`,
			},
		},
	},
	play: async ({ canvas }) => {
		const pill = canvas.getByRole("button", {
			name: "Steve’s Mac is offline",
		})
		const dot = await expectPillGeometry(pill)
		await expect(getComputedStyle(dot).backgroundColor).toBe(PRESENCE_OFFLINE)
		await expect(getComputedStyle(pill).color).toBe(MUTED_FOREGROUND)
	},
})

const expectDetails = async (pill: HTMLElement, state: string) => {
	const details = await screen.findByRole("tooltip")
	const [email, line] = details.querySelectorAll("span")
	await expect(email).toHaveTextContent("steve@example.com")
	await expect(line).toHaveTextContent(
		`Studio runs on their Mac. It’s ${state}.`,
	)
	await expect(getComputedStyle(email).fontWeight).toBe("500")
	await expect(getComputedStyle(email).color).toBe(FOREGROUND)
	await expect(getComputedStyle(line).color).toBe(MUTED_FOREGROUND)
	const style = getComputedStyle(details)
	await expect(style.paddingBlockStart).toBe("8px")
	await expect(style.paddingInlineStart).toBe("10px")
	await expect(style.rowGap).toBe("2px")
	await expect(style.borderTopLeftRadius).toBe("8px")
	await expect(style.backgroundColor).toBe("rgb(38, 38, 38)")
	await waitFor(async () => {
		await expect(details.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			pill.getBoundingClientRect().bottom,
		)
	}, FRAME_POLL)
}

export const DetailsOpen = meta.story({
	globals: { theme: "dark" },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} 5.6, the tooltip under the pill. Check it opens below on hover, carries the host's email at weight 500 over \`Studio runs on their Mac. It’s online.\` in the muted foreground, on the 8px corner, 8px by 10px padding and 2px gap of the reference, and that one Tab opens it as well. Pick \`DetailsOpenOffline\` for the second line of an offline host.`,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const pill = canvas.getByRole("button", {
			name: "Hosted by Steve, online",
		})
		await userEvent.hover(pill)
		await expectDetails(pill, "online")

		await userEvent.unhover(pill)
		await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull())
		await userEvent.tab()
		await expect(pill).toHaveFocus()
		await expectDetails(pill, "online")
	},
})

export const DetailsOpenOffline = meta.story({
	globals: { theme: "dark" },
	args: { isOnline: false },
	parameters: {
		docs: {
			description: {
				story: `${ITERATION_FIVE} 5.7 draws no tooltip, so its second line follows the online one: \`Studio runs on their Mac. It’s offline.\` Check the line matches the host's state while the email stays. Pick \`DetailsOpen\` for the online host.`,
			},
		},
	},
	play: async ({ canvas, userEvent }) => {
		const pill = canvas.getByRole("button", {
			name: "Steve’s Mac is offline",
		})
		await userEvent.hover(pill)
		await expectDetails(pill, "offline")
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
		await expect(
			canvas.getAllByRole("button", { name: "Steve’s Mac is offline" }),
		).toHaveLength(2)
	},
})
