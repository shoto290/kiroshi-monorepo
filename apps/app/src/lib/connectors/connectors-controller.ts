import type { ConnectorPort, ConnectorRow } from "./connector-port"

import type { EnvOwner } from "../conversations/store-contract"

export type ConnectorCommand = "status" | "connect" | "cancel" | "disconnect"

export type ConnectorFailure = {
	command: ConnectorCommand
	name: string | null
	reason: unknown
}

export type ConnectorsState = {
	owner: EnvOwner | null
	rows: ConnectorRow[]
	connecting: string | null
	failure: ConnectorFailure | null
}

export type ConnectorsController = {
	getState: () => ConnectorsState
	subscribe: (listener: () => void) => () => void
	open: (owner: EnvOwner) => Promise<void>
	connect: (name: string, url: string) => Promise<void>
	cancel: () => Promise<void>
	disconnect: (name: string, url: string) => Promise<void>
}

const initialConnectorsState: ConnectorsState = {
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

export const createConnectorsController = (
	port: ConnectorPort,
): ConnectorsController => {
	let state = initialConnectorsState
	const listeners = new Set<() => void>()

	const publish = () => {
		for (const listener of listeners) {
			listener()
		}
	}

	const set = (fields: Partial<ConnectorsState>) => {
		state = { ...state, ...fields }
		publish()
	}

	const setFor = (owner: EnvOwner, fields: Partial<ConnectorsState>) => {
		if (state.owner === owner) {
			set(fields)
		}
	}

	const keptFailure = () =>
		state.failure?.command === "status" ? null : state.failure

	const read = (owner: EnvOwner) =>
		port.status(owner).then(
			(rows) => setFor(owner, { rows, failure: keptFailure() }),
			(reason) =>
				setFor(owner, { failure: { command: "status", name: null, reason } }),
		)

	const run = async (
		owner: EnvOwner,
		{ command, name }: Omit<ConnectorFailure, "reason">,
		send: () => Promise<unknown>,
	) => {
		try {
			await send()
		} catch (reason) {
			if (!isCancellation(reason)) {
				setFor(owner, { failure: { command, name, reason } })
			}
		}
	}

	const openOwner = () => state.owner

	return {
		getState: () => state,

		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},

		open: (owner) => {
			set({ ...initialConnectorsState, owner })
			return read(owner)
		},

		connect: async (name, url) => {
			const owner = openOwner()
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
			const owner = openOwner()
			if (!owner) {
				return
			}
			await run(owner, { command: "cancel", name: state.connecting }, () =>
				port.cancel(),
			)
			await read(owner)
		},

		disconnect: async (name, url) => {
			const owner = openOwner()
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
