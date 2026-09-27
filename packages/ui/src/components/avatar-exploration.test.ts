import { describe, expect, it } from "vitest"

import {
	companionSeed,
	pickSilhouette,
} from "@workspace/ui/components/avatar-exploration"
import {
	BLOT_TINTS,
	type BotAvatarBlot,
} from "@workspace/ui/components/companion-colour"
import {
	COMPANION_SILHOUETTE_SPACE,
	silhouetteCells,
	silhouetteKey,
} from "@workspace/ui/components/companion-silhouette"
import {
	DITHER_SCREENS,
	screenFor,
} from "@workspace/ui/components/dithered-field-avatar"

type Companion = { name: string; tint: BotAvatarBlot }

const NAMES = [
	"Lyra",
	"Orion",
	"Vega",
	"Atlas",
	"Nova",
	"Sirius",
	"Juno",
	"Castor",
	"Rigel",
	"Mira",
	"Altair",
	"Deneb",
	"Pollux",
	"Electra",
	"Io",
	"Titan",
	"Kepler",
	"Hydra",
	"Ceres",
	"Echo",
]

const COMPANIONS: Companion[] = NAMES.map((name, index) => ({
	name,
	tint: BLOT_TINTS[index % BLOT_TINTS.length],
}))

const silhouetteOf = ({ name }: Companion) =>
	pickSilhouette(companionSeed(name), COMPANION_SILHOUETTE_SPACE)

describe("companion silhouettes", () => {
	it("gives twenty seeded names twenty distinct silhouettes", () => {
		const keys = COMPANIONS.map((companion) =>
			silhouetteKey(silhouetteOf(companion)),
		)
		expect(new Set(keys).size).toBe(COMPANIONS.length)
	})

	it("gives Lyra and Orion, both blue, different silhouettes", () => {
		const [lyra, orion] = ["Lyra", "Orion"].map((name) =>
			silhouetteKey(silhouetteOf({ name, tint: "blue" })),
		)
		expect(lyra).not.toBe(orion)
	})

	it("draws one seed identically twice", () => {
		const [companion] = COMPANIONS
		expect(silhouetteCells(silhouetteOf(companion))).toEqual(
			silhouetteCells(silhouetteOf({ ...companion })),
		)
	})
})

describe("dithered screens", () => {
	it("picks the same screen for a name every time", () => {
		expect(NAMES.map(screenFor)).toEqual(NAMES.map(screenFor))
	})

	it("reaches every screen across the twenty names", () => {
		expect(new Set(NAMES.map(screenFor))).toEqual(new Set(DITHER_SCREENS))
	})
})
