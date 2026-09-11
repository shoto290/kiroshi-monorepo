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
	port.status(owner).then((rows) => rows.map((row) => ({ owner, row })))

const LEFT_OUT_SERVER = /^the server "(.+?)" was left out:/

export const findLeftOutConnector = async (
	port: ConnectorPort,
	owners: EnvOwner[],
	name: string,
): Promise<SessionConnector | null> => {
	const readings = await Promise.all(
		owners.map((owner) => readingsOf(port, owner)),
	)
	const named = readings.flat().find(({ row }) => row.name === name)
	return named?.row.status === "needsAuthorization"
		? { name, owner: named.owner }
		: null
}

const leftOutNameOf = (error: ChatError | undefined) =>
	error?.error.kind === "serverEnvRejected"
		? (LEFT_OUT_SERVER.exec(error.error.detail)?.[1] ?? null)
		: null

export const useSessionConnector = (
	error: ChatError | undefined,
	speakerId: string | undefined,
): LeftOutConnector | null => {
	const connectors = useContext(SessionConnectorsContext)
	const [reading, setReading] = useState<SessionReading | null>(null)
	const name = leftOutNameOf(error)
	const errorId = name ? error?.id : undefined
	const port = connectors?.port
	const spaceId = connectors?.spaceId

	useEffect(() => {
		if (!errorId || !name || !port || !spaceId || !speakerId) {
			return
		}
		let isCurrent = true
		const land = (connector: SessionConnector | null) => {
			if (isCurrent) {
				setReading({ errorId, connector })
			}
		}
		findLeftOutConnector(
			port,
			[
				{ kind: "bot", id: speakerId, spaceId },
				{ kind: "space", id: spaceId },
			],
			name,
		).then(land, () => land(null))
		return () => {
			isCurrent = false
		}
	}, [errorId, name, port, spaceId, speakerId])

	const connector =
		reading && reading.errorId === errorId ? reading.connector : null
	if (!connector || !connectors) {
		return null
	}
	return { ...connector, open: () => connectors.onOpen(connector.owner) }
}
