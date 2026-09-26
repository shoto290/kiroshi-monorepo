import { describe, expect, it } from "vitest"

import {
	ASCII_GLYPH_SPACE,
	glyphCells,
} from "@workspace/ui/components/ascii-glyph-avatar"
import {
	companionSeed,
	pickSilhouette,
	type Silhouette,
	type SilhouetteSpace,
} from "@workspace/ui/components/avatar-exploration"
import { BLOT_TINTS } from "@workspace/ui/components/bot-avatar"
import {
	DITHER_SPACE,
	shadedPixels,
} from "@workspace/ui/components/dither-avatar"
import {
	DOT_LATTICE_SPACE,
	latticeDots,
} from "@workspace/ui/components/dot-lattice-avatar"
import { ORBIT_SPACE, orbitSystem } from "@workspace/ui/components/orbit-avatar"
import {
	SCANLINE_SPACE,
	scanSegments,
} from "@workspace/ui/components/scanline-avatar"

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

const COMPANIONS = NAMES.map((name, index) => ({
	name,
	tint: BLOT_TINTS[index % BLOT_TINTS.length],
}))

const EXPLORATIONS: [
	string,
	SilhouetteSpace,
	(silhouette: Silhouette) => unknown,
][] = [
	["dot lattice", DOT_LATTICE_SPACE, latticeDots],
	["orbit", ORBIT_SPACE, orbitSystem],
	["scanline", SCANLINE_SPACE, scanSegments],
	["ascii glyph", ASCII_GLYPH_SPACE, glyphCells],
	["dither", DITHER_SPACE, shadedPixels],
]

describe.each(EXPLORATIONS)("%s silhouettes", (_, space, render) => {
	const silhouetteOf = ({ name, tint }: (typeof COMPANIONS)[number]) =>
		pickSilhouette(companionSeed(name, tint), space)

	it("gives twenty seeded names twenty distinct family and variant pairs", () => {
		const pairs = COMPANIONS.map(silhouetteOf).map(
			({ family, variant }) => `${family}:${variant}`,
		)
		expect(new Set(pairs).size).toBe(COMPANIONS.length)
	})

	it("gives twenty seeded names twenty distinct drawings", () => {
		const drawings = COMPANIONS.map((companion) =>
			render(silhouetteOf(companion)),
		)
		for (const [index, drawing] of drawings.entries())
			for (const other of drawings.slice(index + 1))
				expect(drawing).not.toEqual(other)
	})

	it("renders one seed identically twice", () => {
		const [companion] = COMPANIONS
		expect(render(silhouetteOf(companion))).toEqual(
			render(silhouetteOf({ ...companion })),
		)
	})
})
