const BLOT_TINTS = [
	"red",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"orange",
] as const

type BotAvatarBlot = (typeof BLOT_TINTS)[number]

const blotTint = (blot: BotAvatarBlot) => `var(--bot-blot-${blot})`

export { BLOT_TINTS, type BotAvatarBlot, blotTint }
