import type { ApplicationRow, ConnectionPort } from "./connection-port"

import type { EnvOwner } from "../conversations/store-contract"

export type ConnectionCommand = "status" | "connect" | "cancel" | "disconnect"

export type ConnectionFailure = {
	command: ConnectionCommand
	name: string | null
	reason: unknown
}

export type ConnectionsState = {
	owner: EnvOwner | null
	rows: ApplicationRow[]
	connecting: string | null
	failure: ConnectionFailure | null
}

export type ConnectionsController = {
	getState: () => ConnectionsState
	subscribe: (listener: () => void) => () => void
	open: (owner: EnvOwner) => Promise<void>
	connect: (name: string, url: string) => Promise<void>
	cancel: () => Promise<void>
	disconnect: (name: string, url: string) => Promise<void>
}

const initialConnectionsState: ConnectionsState = {
	owner: null,
	rows: [],
	connecting: null,
	failure: null,
}

const isCancellation = (reason: unknown) =>
	typeof reason === "object" &&
	reason !== null &&
	"kind" in reason &&
	reason.kind === "cancelled"

export const createConnectionsController = (
	port: ConnectionPort,
): ConnectionsController => {
	let state = initialConnectionsState
	const listeners = new Set<() => void>()

	const publish = () => {
		for (const listener of listeners) {
			listener()
		}
	}

	const set = (fields: Partial<ConnectionsState>) => {
		state = { ...state, ...fields }
		publish()
	}

	const setFor = (owner: EnvOwner, fields: Partial<ConnectionsState>) => {
		if (state.owner === owner) {
			set(fields)
		}
	}

	const fail = (owner: EnvOwner, failure: ConnectionFailure) => {
		if (state.owner !== owner) {
			return
		}
		console.error(
			`connections: ${failure.command} was refused for ${failure.name ?? owner.id}`,
			failure.reason,
		)
		set({ failure })
	}

	const keptFailure = () =>
		state.failure?.command === "status" ? null : state.failure

	const read = (owner: EnvOwner) =>
		port.status(owner).then(
			(rows) => setFor(owner, { rows, failure: keptFailure() }),
			(reason) => fail(owner, { command: "status", name: null, reason }),
		)

	const run = async (
		owner: EnvOwner,
		{ command, name }: Omit<ConnectionFailure, "reason">,
		send: () => Promise<unknown>,
	) => {
		try {
			await send()
		} catch (reason) {
			if (!isCancellation(reason)) {
				fail(owner, { command, name, reason })
			}
		}
	}

	return {
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: (owner) => {
			set({ ...initialConnectionsState, owner })
			return read(owner)
		},

		connect: async (name, url) => {
			const owner = state.owner
			if (!owner) {
				return
			}
			set({ connecting: name, failure: null })
			await run(owner, { command: "connect", name }, () =>
				port.connect(owner, name, url),
			)
			setFor(owner, { connecting: null })
			await read(owner)
		},

		cancel: async () => {
			const owner = state.owner
			if (!owner) {
				return
			}
			await run(owner, { command: "cancel", name: state.connecting }, () =>
				port.cancel(),
			)
			await read(owner)
		},

		disconnect: async (name, url) => {
			const owner = state.owner
			if (!owner) {
				return
			}
			set({ failure: null })
			await run(owner, { command: "disconnect", name }, () =>
				port.disconnect(owner, name, url),
			)
			await read(owner)
		},
	}
}
