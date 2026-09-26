import { useState } from "react"
import { expect } from "storybook/test"

import preview from "@workspace/storybook/preview"
import {
	botIdentityAvatars,
	companionGlyphOf,
	expectCompanionPictureSquare,
	pictureOf,
	Row,
	slotsIn,
	UPLOADED_AVATAR_IMAGE,
} from "@workspace/storybook/story-utils"
import { BLOT_TINTS } from "@workspace/ui/components/bot-avatar"
import { BOT_BADGES } from "@workspace/ui/components/bot-badge"
import {
	BotIdentityAvatar,
	type BotIdentityAvatarProps,
} from "@workspace/ui/components/bot-identity-avatar"
import { companionPictureRadius } from "@workspace/ui/components/companion-picture"
import { InitialsAvatar } from "@workspace/ui/components/initials-avatar"
import { Button } from "@workspace/ui/components/ui/button"

const SIZES = [40, 96, 24]

const DRAWN_PICTURE_SLOTS = [
	{ size: 40, radius: "10px" },
	{ size: 20, radius: "6px" },
]

const DrawnPictureSlots = (props: BotIdentityAvatarProps) => (
	<Row>
		{DRAWN_PICTURE_SLOTS.map(({ size }) => (
			<BotIdentityAvatar {...props} key={size} size={size} />
		))}
	</Row>
)

const activityDotOf = (avatar: HTMLElement) =>
	slotsIn(avatar, "bot-activity-dot")[0]

const EveryPlace = (props: BotIdentityAvatarProps) => (
	<Row>
		{SIZES.map((size) => (
			<BotIdentityAvatar {...props} key={size} size={size} />
		))}
	</Row>
)

const Changing = (props: BotIdentityAvatarProps) => {
	const [wearing, setWearing] = useState(false)

	return (
		<div className="flex flex-col items-start gap-4">
			<EveryPlace
				{...props}
				image={wearing ? UPLOADED_AVATAR_IMAGE : undefined}
			/>
			<Button onClick={() => setWearing(!wearing)} size="sm" variant="outline">
				Change the companion
			</Button>
		</div>
	)
}

const expectGlyph = async (avatar: HTMLElement, state: string) => {
	const glyph = companionGlyphOf(avatar)
	await expect(glyph).toHaveAccessibleName("Atlas")
	await expect(glyph.dataset.state).toBe(state)
}

const meta = preview.meta({
	title: "Branding/BotIdentityAvatar",
	component: BotIdentityAvatar,
	parameters: {
		layout: "centered",
		docs: {
			description: {
				component:
					"A companion's face, wherever it is shown: the roster row, its settings column, the replies it signs, the row that says it is working. One component for all of them, so every place draws the same companion. A companion with an uploaded picture is that picture. Otherwise it is its ASCII glyph, drawn from its name and the colour it was given: two companions sharing a colour still part by the shape of their glyph. At rest the glyph holds still; at work it moves in the way its kind of work moves. The dot at the corner is a badge the caller hands down, never the work itself. Size is the only thing a call site changes.",
			},
		},
	},
	args: {
		name: "Atlas",
		blot: "blue",
		seed: "bot-7",
		size: 96,
	},
	argTypes: {
		badge: { control: "select", options: [undefined, ...BOT_BADGES] },
		blot: { control: "select", options: [undefined, ...BLOT_TINTS] },
		name: { control: "text" },
		size: { control: { type: "range", min: 16, max: 160, step: 8 } },
		working: { control: "boolean" },
	},
})

export const Rest = meta.story({
	parameters: {
		docs: {
			description: {
				story:
					"One companion at rest: its glyph on the colour it was given, drawn once and left alone. Check that nothing moves, that the tile is a rounded square and that no dot is drawn. Pick `Working` for the same companion mid-run.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [avatar] = botIdentityAvatars(canvasElement)
		const glyph = companionGlyphOf(avatar)

		await expectGlyph(avatar, "idle")
		await expect(glyph.style.backgroundColor).toBe("var(--bot-blot-blue)")
		await expect(getComputedStyle(avatar).borderRadius).toBe(
			`${companionPictureRadius(96)}px`,
		)
		await expect(activityDotOf(avatar)).toBeUndefined()
	},
})

export const EverySize = meta.story({
	tags: ["test-only"],
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"The three sizes the product asks for, a roster row, a settings column and a reply, from one component and one identity. Check that they are the same glyph at three scales: below a 3.5px cell the characters become solid blocks, so the 24px one reads by its shape.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const drawn = botIdentityAvatars(canvasElement)

		await expect(drawn).toHaveLength(SIZES.length)
		for (const [index, avatar] of drawn.entries()) {
			await expect(avatar.getBoundingClientRect().width).toBeCloseTo(
				SIZES[index],
			)
			await expectGlyph(avatar, "idle")
		}
	},
})

export const EveryTint = meta.story({
	tags: ["test-only"],
	render: (args) => (
		<Row>
			<BotIdentityAvatar {...args} blot={undefined} />
			{BLOT_TINTS.map((blot) => (
				<BotIdentityAvatar {...args} blot={blot} key={blot} />
			))}
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The companion with no colour, then the eight colours a companion can be given. The glyph ink is near-black on every colour and the colours do not follow the theme; the uncoloured one draws its glyph in the theme ink on no tile. Switch to dark and check the glyph reads on all nine.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [none, ...tinted] =
			botIdentityAvatars(canvasElement).map(companionGlyphOf)

		await expect(none.style.backgroundColor).toBe("")
		await expect(tinted.map((glyph) => glyph.style.backgroundColor)).toEqual(
			BLOT_TINTS.map((blot) => `var(--bot-blot-${blot})`),
		)
	},
})

export const NoChosenColour = meta.story({
	args: { blot: undefined },
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"A companion never given a colour, as it rendered before glyphs: no tile behind it, its ink following the theme. Switch the theme and check the glyph stays readable on both backgrounds.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			const glyph = companionGlyphOf(avatar)
			await expectGlyph(avatar, "idle")
			await expect(glyph.style.backgroundColor).toBe("")
			await expect(glyph).toHaveClass("text-(--bot-avatar-ink)")
		}
	},
})

export const WithBadge = meta.story({
	args: { badge: "attention" },
	parameters: {
		docs: {
			description: {
				story:
					"A companion at rest carrying the badge its caller handed down. Check that the dot sits in the corner of the rounded square without leaving it. Pick `EveryBadge` for the three badges.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [avatar] = botIdentityAvatars(canvasElement)
		const slot = avatar.getBoundingClientRect()
		const dot = activityDotOf(avatar)
		const box = dot.getBoundingClientRect()

		await expectGlyph(avatar, "idle")
		await expect(dot.dataset.badge).toBe("attention")
		await expect(box.right).toBeLessThanOrEqual(slot.right)
		await expect(box.bottom).toBeLessThanOrEqual(slot.bottom)
	},
})

export const EveryBadge = meta.story({
	tags: ["test-only"],
	render: (args) => (
		<Row>
			<BotIdentityAvatar {...args} badge={undefined} />
			{BOT_BADGES.map((badge) => (
				<BotIdentityAvatar {...args} badge={badge} key={badge} />
			))}
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"The three things a dot can mean, and the companion that means none of them. Attention is orange and breathes, because it is the only one asking the reader for something; a finished turn is green and a failed one is red, and both hold perfectly still — a turn that is over has nothing left to signal. The three colours are fixed and do not follow the theme: green cannot become teal on the water theme without the dot losing the only thing it says. Switch the Storybook theme, and light to dark, and check that all three hold. The first avatar carries no badge and must draw no dot at all.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [none, ...badged] =
			botIdentityAvatars(canvasElement).map(activityDotOf)

		await expect(none).toBeUndefined()
		await expect(badged.map((dot) => dot.dataset.badge)).toEqual([
			...BOT_BADGES,
		])
		await expect(
			badged.map((dot) => dot.classList.contains("motion-safe:animate-pulse")),
		).toEqual([true, false, false])
	},
})

export const BadgedWhileWorking = meta.story({
	tags: ["test-only"],
	args: { badge: "failed", working: true, kind: "searching" },
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"A badge and a run are two different things, and the component keeps them apart: the glyph is searching because `working` says so, and the dot is red because the caller said the last turn failed. Neither reads the other. Check that the dot is sized from the avatar so it lands the same on a 24px reply as on a 96px preview.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			await expectGlyph(avatar, "searching")
			await expect(activityDotOf(avatar).dataset.badge).toBe("failed")
		}
	},
})

export const Working = meta.story({
	args: { working: true, kind: "writing" },
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"The companion at work, in all three places. Its glyph and colour stay its own; the motion is the work: writing fills top to bottom, searching sweeps across, thinking ripples out, working spins and waiting breathes. No size wears a dot. Open this in Storybook for the movement; the test browser forces reduced motion, where each kind holds a still pose of its own.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			await expectGlyph(avatar, "writing")
			await expect(activityDotOf(avatar)).toBeUndefined()
		}
	},
})

export const Waiting = meta.story({
	tags: ["test-only"],
	args: { working: true, kind: "waiting" },
	parameters: {
		docs: {
			description: {
				story:
					"A companion waiting on the reader: its glyph breathes rather than resting, so waiting reads as attention and not as idleness.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const [avatar] = botIdentityAvatars(canvasElement)
		await expectGlyph(avatar, "waiting")
	},
})

export const WithImage = meta.story({
	args: { image: UPLOADED_AVATAR_IMAGE },
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"A companion wearing a picture its reader uploaded. It wins over the glyph in every place and is decorative in all of them: the row, the column and the reply each name the companion in their own text. Check that no glyph is drawn beside it. Pick `UploadedWorking` for the same picture mid-run.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			await expect(await pictureOf(avatar)).toHaveAttribute(
				"src",
				UPLOADED_AVATAR_IMAGE,
			)
			await expect(
				avatar.querySelector('[data-slot="avatar-exploration"]'),
			).toBeNull()
			await expectCompanionPictureSquare(avatar)
		}
	},
})

export const UploadedWorking = meta.story({
	tags: ["test-only"],
	args: { image: UPLOADED_AVATAR_IMAGE, working: true, kind: "searching" },
	render: (args) => <EveryPlace {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"A companion with a picture, working. The picture stays: swapping it for a glyph that can move would put somebody else on the screen mid-run. A photograph cannot act, so a running picture is read from the line beside it: the corner belongs to the badge and stays empty while none is given. Check that no dot is drawn at any size and that the picture is untouched.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			await expect(await pictureOf(avatar)).toHaveAttribute(
				"src",
				UPLOADED_AVATAR_IMAGE,
			)
			await expect(
				avatar.querySelector('[data-slot="bot-activity-dot"]'),
			).toBeNull()
			await expectCompanionPictureSquare(avatar)
		}
	},
})

export const UploadedAtDrawnSizes = meta.story({
	tags: ["test-only"],
	args: { image: UPLOADED_AVATAR_IMAGE },
	render: (args) => (
		<Row>
			<DrawnPictureSlots {...args} />
			<InitialsAvatar
				image={UPLOADED_AVATAR_IMAGE}
				name="Ada Martin"
				size={40}
			/>
		</Row>
	),
	parameters: {
		docs: {
			description: {
				story:
					"A companion picture at the two slot sizes the artboards draw, the roster line at 40px and the header identity at 20px, beside the reader's own picture. A companion picture is a rounded square whose corner is a quarter of its slot, never under 6px; the reader's stays a circle. Check a 10px corner at 40px, a 6px corner at 20px, no border on either, and a round reader.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const avatars = botIdentityAvatars(canvasElement)

		for (const [index, { radius }] of DRAWN_PICTURE_SLOTS.entries()) {
			await expectCompanionPictureSquare(avatars[index])
			await expect(getComputedStyle(avatars[index]).borderRadius).toBe(radius)
		}

		const [reader] = slotsIn(canvasElement, "user-avatar")
		await expect(await pictureOf(reader)).toHaveClass("rounded-full")
	},
})

export const UploadedBadged = meta.story({
	tags: ["test-only"],
	args: { image: UPLOADED_AVATAR_IMAGE, badge: "attention" },
	render: (args) => <DrawnPictureSlots {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"A companion picture carrying a badge at both drawn slot sizes. Check that the dot sits in the corner of the rounded square without leaving the slot.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		for (const avatar of botIdentityAvatars(canvasElement)) {
			const slot = avatar.getBoundingClientRect()
			const dot = activityDotOf(avatar).getBoundingClientRect()

			await expectCompanionPictureSquare(avatar)
			await expect(dot.left).toBeGreaterThanOrEqual(slot.left)
			await expect(dot.top).toBeGreaterThanOrEqual(slot.top)
			await expect(dot.right).toBeLessThanOrEqual(slot.right)
			await expect(dot.bottom).toBeLessThanOrEqual(slot.bottom)
		}
	},
})

export const BoundToOneBot = meta.story({
	tags: ["test-only"],
	render: (args) => <Changing {...args} />,
	parameters: {
		docs: {
			description: {
				story:
					"What one component buys: change the companion and every place changes with it. Press the button and all three sizes go from the glyph to a picture together, and back. Check that the three never disagree at any point.",
			},
		},
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		const drawn = () => botIdentityAvatars(canvasElement)
		const change = () =>
			userEvent.click(
				canvas.getByRole("button", { name: "Change the companion" }),
			)

		for (const avatar of drawn()) await expectGlyph(avatar, "idle")

		await change()
		for (const avatar of drawn()) {
			await expect(await pictureOf(avatar)).toHaveAttribute(
				"src",
				UPLOADED_AVATAR_IMAGE,
			)
			await expect(
				avatar.querySelector('[data-slot="avatar-exploration"]'),
			).toBeNull()
		}

		await change()
		for (const avatar of drawn()) {
			await expect(avatar.querySelector("img")).toBeNull()
			await expectGlyph(avatar, "idle")
		}
	},
})
