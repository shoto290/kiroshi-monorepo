// Mode key → geometry builder. Kept separate from the presets so tree
// shaking can in principle drop unused modes in custom builds.

import { frameBraid } from "./braid"
import { frameGlobe, frameRubik, frameWave } from "./lattice"
import { frameMorph } from "./morph"
import { frameOrbits } from "./orbits"
import { frameRibbon } from "./ribbon"
import type { ModeFrame } from "./types"
import { frameWeb } from "./web"

import type { ModeKey } from "../presets"

/**
 * The portable surface: pure geometry, no canvas. The React Native port
 * imports exactly these functions, so its output is identical to the web's
 * by construction rather than by re-implementation.
 */
export const MODE_FRAMES: Record<ModeKey, ModeFrame> = {
	orbits: frameOrbits,
	globe: frameGlobe,
	rubik: frameRubik,
	wave: frameWave,
	web: frameWeb,
	braid: frameBraid,
	ribbon: frameRibbon,
	// ring shares ribbon's geometry — the `faceOn` profile flag switches it
	ring: frameRibbon,
	morph: frameMorph,
}
