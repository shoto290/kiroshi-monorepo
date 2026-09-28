import { describe, expect, it } from "vitest"

import {
	companionSeed,
	pickSilhouette,
} from "@workspace/ui/components/companion-field"
import {
	COMPANION_SILHOUETTE_SPACE,
	silhouetteCells,
	silhouetteKey,
} from "@workspace/ui/components/companion-silhouette"

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

const silhouetteOf = (name: string) =>
	pickSilhouette(companionSeed(name), COMPANION_SILHOUETTE_SPACE)

describe("companion silhouettes", () => {
	it("gives twenty seeded names twenty distinct silhouettes", () => {
		const keys = NAMES.map((name) => silhouetteKey(silhouetteOf(name)))
		expect(new Set(keys).size).toBe(NAMES.length)
	})

	it("gives Lyra and Orion different silhouettes", () => {
		const [lyra, orion] = ["Lyra", "Orion"].map((name) =>
			silhouetteKey(silhouetteOf(name)),
		)
		expect(lyra).not.toBe(orion)
	})

	it("draws one seed identically twice", () => {
		const [name] = NAMES
		expect(silhouetteCells(silhouetteOf(name))).toEqual(
			silhouetteCells(silhouetteOf(name)),
		)
	})
})
