import { invoke, listen, listenToActiveHost } from "../host"
import type {
	CompanionCreated,
	CompanionSeedRefused,
	LaunchOutcome,
} from "@/lib/bindings"

export type {
	CompanionCreated,
	CompanionSeedRefused,
	LaunchOutcome,
} from "@/lib/bindings"

export const CREATED_EVENT = "companion://created"

export const FIRST_RUN_DONE_EVENT = "user://first-run-done"

export const SEED_REFUSED_EVENT = "companion://seed-refused"

export const companionsTransport = {
	onCreated: (listener: (created: CompanionCreated) => void) =>
		listen<CompanionCreated>(CREATED_EVENT, ({ payload }) => listener(payload)),
	onHostCreated: (listener: () => void) =>
		listenToActiveHost(CREATED_EVENT, () => listener()),
	onFirstRunDone: (listener: () => void) =>
		listen(FIRST_RUN_DONE_EVENT, () => listener()),
	onSeedRefused: (listener: (refused: CompanionSeedRefused) => void) =>
		listen<CompanionSeedRefused>(SEED_REFUSED_EVENT, ({ payload }) =>
			listener(payload),
		),
	launchOutcome: () => invoke<LaunchOutcome>("companion_launch_outcome"),
}
