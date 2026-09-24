// The shipped tunings: nine states × two sizes, baked from the inkform
// mini-page tuning session. `count`/`size` are multipliers over the base
// fine profiles; `speed` multiplies the shared clock. Resolved once per
// (state, size) pair and cached — the render loop sees plain numbers.

import type { OrbSize, OrbState } from "./types"

import type { ModeOpts } from "./engine/profiles"
import { BASE_PROFILES, scaleCounts, scaleRadii } from "./engine/profiles"

export type ModeKey =
	| "orbits"
	| "globe"
	| "rubik"
	| "wave"
	| "web"
	| "braid"
	| "ribbon"
	| "ring"
	| "morph"

export const STATE_TO_MODE: Record<OrbState, ModeKey> = {
	working: "orbits",
	searching: "globe",
	solving: "rubik",
	listening: "wave",
	connecting: "web",
	weaving: "braid",
	composing: "ribbon",
	breathing: "ring",
	shaping: "morph",
}

export interface Preset {
	speed: number
	count: number
	size: number
	/** Extra mode opts merged verbatim after scaling. */
	extra?: ModeOpts
}

const PRESETS: Record<ModeKey, Record<OrbSize, Preset>> = {
	orbits: {
		20: { speed: 3.9, count: 0.238, size: 2.4 },
	},
	globe: {
		20: {
			speed: 2.665,
			count: 0.105,
			size: 1.75,
			extra: { scanMul: 4.335, dimBase: 0.45 },
		},
	},
	rubik: {
		20: { speed: 1.95, count: 0.088, size: 1.9 },
	},
	wave: {
		20: { speed: 3.998, count: 0.105, size: 1.6 },
	},
	web: {
		20: { speed: 6.63, count: 0.25, size: 1.52 },
	},
	braid: {
		20: { speed: 2.75, count: 0.1125, size: 1.36 },
	},
	ribbon: {
		20: {
			speed: 3.12,
			count: 0.051,
			size: 1.073,
			extra: { spin: 0, bandMul: 4.94, wobMul: 1 },
		},
	},
	ring: {
		20: {
			speed: 3.78,
			count: 0.028,
			size: 1.622,
			extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 },
		},
	},
	morph: {
		20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } },
	},
}

export interface Resolved {
	mode: ModeKey
	speed: number
	opts: ModeOpts
}

const cache = new Map<string, Resolved>()

/** Resolve a (state, size) pair to its mode + fully-scaled draw options. */
export function resolvePreset(state: OrbState, size: OrbSize): Resolved {
	const key = `${state}-${size}`
	const hit = cache.get(key)
	if (hit) return hit

	const mode = STATE_TO_MODE[state]
	const preset = PRESETS[mode][size]
	let opts: ModeOpts = { ...BASE_PROFILES[mode] }
	if (preset.count !== 1) opts = scaleCounts(opts, preset.count)
	if (preset.size !== 1) opts = scaleRadii(opts, preset.size)
	if (preset.extra) opts = { ...opts, ...preset.extra }

	const resolved: Resolved = { mode, speed: preset.speed, opts }
	cache.set(key, resolved)
	return resolved
}
