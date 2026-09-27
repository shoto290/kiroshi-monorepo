import { describe, expect, it } from "vitest"

import {
	ASCII_GLYPH_SPACE,
	glyphCells,
	glyphKey,
} from "@workspace/ui/components/ascii-glyph-avatar"
import {
	companionSeed,
	pickSilhouette,
	type Silhouette,
	type SilhouetteSpace,
} from "@workspace/ui/components/avatar-exploration"
import {
	BLOT_TINTS,
	type BotAvatarBlot,
} from "@workspace/ui/components/bot-avatar"
import {
	DITHER_SPACE,
	ditherKey,
	shadedPixels,
} from "@workspace/ui/components/dither-avatar"
import {
	DOT_LATTICE_SPACE,
	latticeDots,
	latticeKey,
} from "@workspace/ui/components/dot-lattice-avatar"
import {
	ORBIT_SPACE,
	orbitKey,
	orbitSystem,
} from "@workspace/ui/components/orbit-avatar"
import {
	SCANLINE_SPACE,
	scanlineKey,
	scanSegments,
} from "@workspace/ui/components/scanline-avatar"

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

type Exploration = [
	string,
	SilhouetteSpace,
	(silhouette: Silhouette) => unknown,
	(silhouette: Silhouette) => string,
]

const SAME_TINT_PAIR: Companion[] = [
	{ name: "Lyra", tint: "blue" },
	{ name: "Orion", tint: "blue" },
]

const EXPLORATIONS: Exploration[] = [
	["dot lattice", DOT_LATTICE_SPACE, latticeDots, latticeKey],
	["orbit", ORBIT_SPACE, orbitSystem, orbitKey],
	["scanline", SCANLINE_SPACE, scanSegments, scanlineKey],
	["ascii glyph", ASCII_GLYPH_SPACE, glyphCells, glyphKey],
	["dither", DITHER_SPACE, shadedPixels, ditherKey],
]

describe.each(EXPLORATIONS)("%s silhouettes", (_, space, render, keyOf) => {
	const silhouetteOf = ({ name, tint }: Companion) =>
		pickSilhouette(companionSeed(name, tint), space)

	it("gives twenty seeded names twenty distinct readable keys", () => {
		const keys = COMPANIONS.map((companion) => keyOf(silhouetteOf(companion)))
		expect(new Set(keys).size).toBe(COMPANIONS.length)
	})

	it("gives Lyra and Orion, both blue, different readable keys", () => {
		const [lyra, orion] = SAME_TINT_PAIR.map((companion) =>
			keyOf(silhouetteOf(companion)),
		)
		expect(lyra).not.toBe(orion)
	})

	it("renders one seed identically twice", () => {
		const [companion] = COMPANIONS
		expect(render(silhouetteOf(companion))).toEqual(
			render(silhouetteOf({ ...companion })),
		)
	})
})
