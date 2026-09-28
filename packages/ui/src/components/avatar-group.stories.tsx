import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	companionGlyphOf,
	companionTintOf,
	expectCompanionSilhouette,
	expectRoundAvatar,
	pictureOf,
	Row,
	slotIn,
	slotsIn,
	UPLOADED_AVATAR_IMAGE,
} from "@workspace/storybook/story-utils"
import {
	AvatarGroup,
	type AvatarGroupProps,
	type ConversationParticipant,
} from "@workspace/ui/components/avatar-group"
import { BOT_BADGES } from "@workspace/ui/components/bot-badge"
import {
	isInsideRoundedHexagon,
	OUTER,
} from "@workspace/ui/components/kiroshi-hexagon"

const ARTBOARD_SIZES = [40, 96]

const APP_SIZES = [24, 32, 40, 96]

const MIRA: ConversationParticipant = { id: "mira", name: "Mira", blot: "pink" }
const OSLO: ConversationParticipant = {
	id: "oslo",
	name: "Oslo",
	blot: "yellow",
}
const LUMEN: ConversationParticipant = {
	id: "lumen",
	name: "Lumen",
	blot: "green",
}
const TARN: ConversationParticipant = { id: "tarn", name: "Tarn", blot: "blue" }
const SABLE: ConversationParticipant = {
	id: "sable",
	name: "Sable",
	blot: "purple",
}
const IRIS: ConversationParticipant = { id: "iris", name: "Iris", blot: "cyan" }
const VALE: ConversationParticipant = { id: "vale", name: "Vale", blot: "red" }
const WREN: ConversationParticipant = {
	id: "wren",
	name: "Wren",
	blot: "orange",
}
const PIKE: ConversationParticipant = { id: "pike", name: "Pike" }
const READER: ConversationParticipant = {
	id: "reader",
	name: "Steve Rivera",
	isPerson: true,
}

const MEMBERS = [MIRA, OSLO, LUMEN, TARN, SABLE, IRIS, VALE, WREN, PIKE]

const membersOf = (count: number) => MEMBERS.slice(0, count)

const LOOSE_CELL = 19.1 / 40

const PACKED_CELL = 15.2 / 40

const ARTBOARD_FILL_ORDER = [
	[0, 0],
	[0.94, 0.5435],
	[0, 1.087],
	[0.94, 1.6305],
]

const HEXAGON_ASPECT = OUTER.halfWidth / OUTER.halfHeight

const SAMPLE_STEP = 1

const iconsIn = (canvasElement: HTMLElement) =>
	slotsIn(canvasElement, "conversation-avatar")

const sizeOf = (icon: HTMLElement) =>
	Math.round(icon.getBoundingClientRect().width)

const membersIn = (icon: HTMLElement) =>
	slotsIn(icon, "conversation-avatar-member")

const botAvatarsOf = (icon: HTMLElement) =>
	membersIn(icon).flatMap((member) => slotsIn(member, "bot-identity-avatar"))

const cellsOf = (icon: HTMLElement) => [
	...membersIn(icon).map((member) => member.firstElementChild as Element),
	...Array.from(
		icon.querySelectorAll('[data-slot="conversation-avatar-overflow"] path'),
	),
]

const centreOf = (cell: DOMRect) => ({
	x: cell.left + cell.width / 2,
	y: cell.top + cell.height / 2,
})

const resolvedFill = (token: string, scope: Element) => {
	const probe = document.createElementNS("http://www.w3.org/2000/svg", "g")
	probe.style.fill = token
	scope.append(probe)
	const resolved = getComputedStyle(probe).fill
	probe.remove()
	return resolved
}

const artboardSpots = (count: number, cellHeight: number, size: number) => {
	const spots = ARTBOARD_FILL_ORDER.slice(0, count).map(([x, y]) => ({
		x: x * cellHeight,
		y: y * cellHeight,
	}))
	const middle = (values: number[]) =>
		(Math.min(...values) + Math.max(...values)) / 2
	const shiftX = size / 2 - middle(spots.map(({ x }) => x))
	const shiftY = size / 2 - middle(spots.map(({ y }) => y))
	return spots.map(({ x, y }) => ({ x: x + shiftX, y: y + shiftY }))
}

const expectArtboardCluster = async (icon: HTMLElement, count: number) => {
	const size = sizeOf(icon)
	const box = icon.getBoundingClientRect()
	const cellHeight = (count >= 4 ? PACKED_CELL : LOOSE_CELL) * size
	const expected = artboardSpots(count, cellHeight, size)
	const cells = cellsOf(icon)

	await expect(cells).toHaveLength(count)
	for (const [index, cell] of cells.entries()) {
		const drawn = cell.getBoundingClientRect()
		const centre = centreOf(drawn)
		await expect(centre.x - box.left).toBeCloseTo(expected[index].x, 0)
		await expect(centre.y - box.top).toBeCloseTo(expected[index].y, 0)
		if (cell.getAttribute("data-slot") !== "user-avatar")
			await expect(drawn.width).toBeCloseTo(cellHeight * HEXAGON_ASPECT, 0)
	}
}

const isInsideCell = (cell: DOMRect, x: number, y: number) => {
	const halfWidth = cell.width / 2
	const centre = centreOf(cell)
	return isInsideRoundedHexagon(
		{ halfWidth, halfHeight: halfWidth / HEXAGON_ASPECT },
		x - centre.x,
		y - centre.y,
	)
}

const expectNoOverlap = async (icon: HTMLElement) => {
	const box = icon.getBoundingClientRect()
	const cells = cellsOf(icon).map((cell) => cell.getBoundingClientRect())
	let shared = 0
	for (let x = box.left; x < box.right; x += SAMPLE_STEP)
		for (let y = box.top; y < box.bottom; y += SAMPLE_STEP)
			if (cells.filter((cell) => isInsideCell(cell, x, y)).length > 1)
				shared += 1
	await expect(shared).toBe(0)
}

const expectMembers = async (icon: HTMLElement, held: typeof MEMBERS) => {
	const members = membersIn(icon)

	await expect(members).toHaveLength(held.length)
	for (const [index, member] of members.entries()) {
		const { blot, image, isPerson } = held[index]
		const avatar = member.firstElementChild as HTMLElement
		if (isPerson) {
			await expect(avatar).toHaveAttribute("data-slot", "user-avatar")
			await expectRoundAvatar(avatar)
			continue
		}
		await expect(avatar).toHaveAttribute("data-slot", "bot-identity-avatar")
		if (image) {
			const picture = await pictureOf(avatar)
			await expect(picture).toBeVisible()
			await expectCompanionSilhouette(picture)
			continue
		}
		await expectCompanionSilhouette(avatar.firstElementChild as Element)
		await expect(companionTintOf(companionGlyphOf(avatar))).toBe(
			blot ? `var(--bot-blot-${blot})` : "",
		)
	}
}

const expectCounter = async (icon: HTMLElement, text: string) => {
	const counter = slotIn(icon, "conversation-avatar-overflow")
	const cell = counter.querySelector("path") as Element
	const ink = counter.querySelector("text") as Element

	await expect(counter).toHaveTextContent(text)
	await expect(icon).toHaveAccessibleName(text)
	await expect(getComputedStyle(cell).fill).toBe(
		resolvedFill("var(--sidebar-accent-foreground)", icon),
	)
	await expect(getComputedStyle(ink).fill).toBe(
		resolvedFill("var(--sidebar)", icon),
	)
}

const expectRoom = async (canvasElement: HTMLElement, held: typeof MEMBERS) => {
	for (const icon of iconsIn(canvasElement)) {
		await expectArtboardCluster(icon, Math.min(held.length, 4))
		await expectMembers(icon, held.length > 4 ? held.slice(0, 3) : held)
		if (held.length > 4) await expectCounter(icon, `+${held.length - 3}`)
		else await expect(icon).toHaveAttribute("aria-hidden", "true")
		await expectNoOverlap(icon)
	}
}

const EverySize = ({
	sizes,
	...props
}: AvatarGroupProps & { sizes: number[] }) => (
	<Row>
		{sizes.map((size) => (
			<AvatarGroup {...props} key={size} size={size} />
		))}
	</Row>
)

const meta = preview.meta({
	title: "Branding/AvatarGroup",
	component: AvatarGroup,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"The face of a room, drawn as a Hive: at most four rounded Kiroshi hexagon cells in two staggered columns, tiled in the square a companion avatar takes, so a room and a companion share a column without it moving. Each cell holds one member's own avatar: a companion clipped to the hexagon, the person as a circle, since only a companion is hexagonal. Cells fill column A top, column B top, column A bottom, column B bottom, and the cluster recentres and scales so no cell is ever left empty. Past four members the fourth cell counts the rest. The icon is hidden from a screen reader unless it counts, in which case the count is its label.",
			},
		},
	},
	args: {
		participants: membersOf(2),
		size: 96,
	},
	argTypes: {
		badge: { control: "select", options: [undefined, ...BOT_BADGES] },
		size: { control: { type: "range", min: 24, max: 160, step: 8 } },
	},
	globals: { theme_layout: "side-by-side" },
	render: (args) => <EverySize {...args} sizes={ARTBOARD_SIZES} />,
})

export const TwoMembers = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"A room of two at 40px, the roster row, and 96px, the artboard size: one cell top left, one lower right, the pair spanning the width and centred on the height.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(2)),
})

export const ThreeMembers = meta.story({
	args: { participants: membersOf(3) },
	parameters: {
		docs: {
			description: {
				story:
					"A room of three: the first three cells of the fill order, a triangle two cells tall on the left and one nested on the right.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(3)),
})

export const FourMembers = meta.story({
	args: { participants: membersOf(4) },
	parameters: {
		docs: {
			description: {
				story:
					"A room of four: every cell holds a companion, the cluster packed smaller so it spans the height of the square.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(4)),
})

export const FiveMembers = meta.story({
	args: { participants: membersOf(5) },
	parameters: {
		docs: {
			description: {
				story:
					"A room past four: three companions and a fourth cell counting the other two, dark on light and light on dark. The count is the icon's accessible name.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(5)),
})

export const EightMembers = meta.story({
	args: { participants: membersOf(8) },
	parameters: {
		docs: {
			description: {
				story:
					"A room of eight: the same four cells, the fourth reading `+5`. The cluster never grows past four cells.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(8)),
})

export const PersonAmongBots = meta.story({
	args: { participants: [READER, MIRA, OSLO] },
	parameters: {
		docs: {
			description: {
				story:
					"A room the person sits in beside two companions. The companions are clipped to their hexagon cells; the person stays a circle inscribed in its cell, because only a companion is hexagonal.",
			},
		},
	},
	play: ({ canvasElement }) => expectRoom(canvasElement, [READER, MIRA, OSLO]),
})

export const UploadedMember = meta.story({
	args: {
		participants: [{ ...MIRA, image: UPLOADED_AVATAR_IMAGE }, OSLO, LUMEN],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A room holding a companion that wears an uploaded picture: the picture fills that companion's cell, clipped to the same hexagon.",
			},
		},
	},
	play: ({ canvasElement }) =>
		expectRoom(canvasElement, [
			{ ...MIRA, image: UPLOADED_AVATAR_IMAGE },
			OSLO,
			LUMEN,
		]),
})

export const WorkingMember = meta.story({
	args: {
		participants: [MIRA, { ...OSLO, working: true, kind: "writing" }],
	},
	parameters: {
		docs: {
			description: {
				story:
					"A room where one companion is running: that cell plays the avatar's working motion in the pose it was given, and the other stays still.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const icon of iconsIn(canvasElement)) {
			const [resting, running] = botAvatarsOf(icon)
			await expect(companionGlyphOf(resting).dataset.state).toBe("idle")
			await expect(companionGlyphOf(running).dataset.state).toBe("writing")
		}
	},
})

export const Badged = meta.story({
	args: { badge: "attention" },
	parameters: {
		docs: {
			description: {
				story:
					"A room with a companion that needs attention: one badge dot in the corner of the square, where a companion avatar puts it.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const icon of iconsIn(canvasElement))
			await expect(slotsIn(icon, "bot-activity-dot")).toHaveLength(1)
	},
})

export const OneMember = meta.story({
	tags: ["test-only"],
	args: { participants: membersOf(1) },
	play: ({ canvasElement }) => expectRoom(canvasElement, membersOf(1)),
})

export const Empty = meta.story({
	tags: ["test-only"],
	args: { participants: [] },
	play: async ({ canvasElement }) => {
		for (const icon of iconsIn(canvasElement))
			await expect(cellsOf(icon)).toHaveLength(0)
	},
})

export const EveryPlace = meta.story({
	tags: ["test-only"],
	globals: { theme_layout: "single" },
	args: { participants: membersOf(9) },
	render: (args) => <EverySize {...args} sizes={APP_SIZES} />,
	play: async ({ canvasElement }) => {
		const icons = iconsIn(canvasElement)

		await expect(icons.map(sizeOf)).toEqual(APP_SIZES)
		for (const icon of icons) await expectArtboardCluster(icon, 4)
	},
})
