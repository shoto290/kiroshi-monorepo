import type {
	AvailableUpdate,
	UpdateProgress,
	UpdateRelease,
	UpdaterPort,
} from "./updater-port"

import { createStore } from "../store"

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const FOCUS_CHECK_MIN_GAP_MS = 4 * 60 * 60 * 1000

export type UpdaterState = {
	available: UpdateRelease | null
	progress: number | null
	isRestartPending: boolean
	error: string | null
}

export type UpdaterController = {
	getState: () => UpdaterState
	subscribe: (listener: () => void) => () => void
	start: () => () => void
	check: () => Promise<void>
	install: () => Promise<void>
	restart: () => Promise<void>
}

const EMPTY: UpdaterState = {
	available: null,
	progress: null,
	isRestartPending: false,
	error: null,
}

const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const isSameState = (left: UpdaterState, right: UpdaterState): boolean =>
	left.error === right.error &&
	left.progress === right.progress &&
	left.isRestartPending === right.isRestartPending &&
	left.available?.version === right.available?.version &&
	left.available?.notes === right.available?.notes

const percentOf = ({ downloaded, total }: UpdateProgress): number =>
	total ? Math.floor((downloaded / total) * 100) : 0

export const createUpdaterController = (
	port: UpdaterPort,
): UpdaterController => {
	const stateStore = createStore(EMPTY)
	const current = stateStore.getState
	let pending: AvailableUpdate | null = null
	let lastCheckAt = 0

	const publish = (next: UpdaterState) => {
		if (isSameState(current(), next)) {
			return
		}
		stateStore.setState(next)
	}

	const check = async () => {
		lastCheckAt = Date.now()
		try {
			const update = await port.check()
			pending = update
			publish({
				...current(),
				available: update && { version: update.version, notes: update.notes },
				error: null,
			})
		} catch (error) {
			publish({ ...current(), error: messageOf(error) })
		}
	}

	const checkOnFocus = () => {
		const { progress, isRestartPending } = current()
		const isBusy = progress !== null || isRestartPending
		if (isBusy || Date.now() - lastCheckAt < FOCUS_CHECK_MIN_GAP_MS) {
			return
		}
		void check()
	}

	const install = async () => {
		const update = pending
		if (!update) {
			return
		}
		publish({ ...current(), progress: 0, error: null })
		try {
			await update.install((progress) =>
				publish({ ...current(), progress: percentOf(progress) }),
			)
			publish({
				...current(),
				progress: null,
				isRestartPending: true,
			})
		} catch (error) {
			publish({
				...current(),
				progress: null,
				error: messageOf(error),
			})
		}
	}

	const restart = async () => {
		if (!current().isRestartPending) {
			return
		}
		await port.restart()
	}

	return {
		getState: current,

		subscribe: stateStore.subscribe,

		start: () => {
			void check()
			const timer = setInterval(() => {
				void check()
			}, CHECK_INTERVAL_MS)
			window.addEventListener("focus", checkOnFocus)
			return () => {
				clearInterval(timer)
				window.removeEventListener("focus", checkOnFocus)
			}
		},

		check,
		install,
		restart,
	}
}
