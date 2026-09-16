import { createContext, useContext, useEffect, useState } from "react"

import type { ConnectionPort } from "./connection-port"

import type { ChatError } from "../chat/chat-state"
import type { EnvOwner } from "../conversations/store-contract"

export type SessionApplications = {
	port: ConnectionPort
	spaceId: string | null
	onOpen: (owner: EnvOwner) => void
}

export type SessionApplication = {
	name: string
	owner: EnvOwner
}

export type LeftOutApplication = SessionApplication & {
	open: () => void
}

type SessionReading = {
	errorId: string
	application: SessionApplication | null
}

export const SessionApplicationsContext =
	createContext<SessionApplications | null>(null)

const readingsOf = (port: ConnectionPort, owner: EnvOwner) =>
	port.status(owner).then((rows) => rows.map((row) => ({ owner, row })))

const LEFT_OUT_SERVER = /^the server "(.+?)" was left out:/

export const findLeftOutApplication = async (
	port: ConnectionPort,
	owners: EnvOwner[],
	name: string,
): Promise<SessionApplication | null> => {
	const readings = await Promise.all(
		owners.map((owner) => readingsOf(port, owner)),
	)
	const named = readings.flat().find(({ row }) => row.name === name)
	return named?.row.status === "needsAuthorization"
		? { name, owner: named.owner }
		: null
}

export const leftOutNameOf = (error: ChatError | undefined) =>
	error?.error.kind === "serverEnvRejected"
		? (LEFT_OUT_SERVER.exec(error.error.detail)?.[1] ?? null)
		: null

export const useSessionApplication = (
	error: ChatError | undefined,
	speakerId: string | undefined,
): LeftOutApplication | null => {
	const applications = useContext(SessionApplicationsContext)
	const [reading, setReading] = useState<SessionReading | null>(null)
	const name = leftOutNameOf(error)
	const errorId = name ? error?.id : undefined
	const port = applications?.port
	const spaceId = applications?.spaceId

	useEffect(() => {
		if (!errorId || !name || !port || !spaceId || !speakerId) {
			return
		}
		let isCurrent = true
		const land = (application: SessionApplication | null) => {
			if (isCurrent) {
				setReading({ errorId, application })
			}
		}
		findLeftOutApplication(
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

	const application =
		reading && reading.errorId === errorId ? reading.application : null
	if (!application || !applications) {
		return null
	}
	return { ...application, open: () => applications.onOpen(application.owner) }
}
