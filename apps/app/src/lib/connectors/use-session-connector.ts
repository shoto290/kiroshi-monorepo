import { createContext, useContext, useEffect, useState } from "react"

import type { ConnectorPort } from "./connector-port"

import type { ChatError } from "../chat/chat-state"
import type { EnvOwner } from "../conversations/store-contract"

export type SessionConnectors = {
	port: ConnectorPort
	spaceId: string | null
	onOpen: (owner: EnvOwner) => void
}

export type SessionConnector = {
	name: string
	owner: EnvOwner
}

export type LeftOutConnector = SessionConnector & {
	open: () => void
}

type SessionReading = {
	errorId: string
	connector: SessionConnector | null
}

export const SessionConnectorsContext = createContext<SessionConnectors | null>(
	null,
)

const readingsOf = (port: ConnectorPort, owner: EnvOwner) =>
	port
		.status(owner)
		.then((rows) => rows.map((row) => ({ name: row.name, owner, row })))

export const findConnectorNeedingAuthorization = async (
	port: ConnectorPort,
	owners: EnvOwner[],
): Promise<SessionConnector | null> => {
	const readings = await Promise.all(
		owners.map((owner) => readingsOf(port, owner)),
	)
	const needing = readings
		.flat()
		.find(({ row }) => row.status === "needsAuthorization")
	return needing ? { name: needing.name, owner: needing.owner } : null
}

const rejectedErrorIdOf = (error: ChatError | undefined) =>
	error?.error.kind === "serverEnvRejected" ? error.id : null

export const useSessionConnector = (
	error: ChatError | undefined,
	speakerId: string | undefined,
): LeftOutConnector | null => {
	const connectors = useContext(SessionConnectorsContext)
	const [reading, setReading] = useState<SessionReading | null>(null)
	const errorId = rejectedErrorIdOf(error)
	const port = connectors?.port
	const spaceId = connectors?.spaceId

	useEffect(() => {
		if (!errorId || !port || !spaceId || !speakerId) {
			return
		}
		let isCurrent = true
		const land = (connector: SessionConnector | null) => {
			if (isCurrent) {
				setReading({ errorId, connector })
			}
		}
		findConnectorNeedingAuthorization(port, [
			{ kind: "bot", id: speakerId, spaceId },
			{ kind: "space", id: spaceId },
		]).then(land, () => land(null))
		return () => {
			isCurrent = false
		}
	}, [errorId, port, spaceId, speakerId])

	const connector = reading?.errorId === errorId ? reading.connector : null
	if (!connector || !connectors) {
		return null
	}
	return { ...connector, open: () => connectors.onOpen(connector.owner) }
}
