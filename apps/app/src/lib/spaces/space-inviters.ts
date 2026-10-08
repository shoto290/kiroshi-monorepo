export type SpaceInviters = {
	of: (joinedId: string) => string
	remember: (joinedId: string, email: string) => void
	forget: (joinedId: string) => void
}

type InviterEmails = Record<string, string>

const INVITERS_KEY = "spaceInviters"

const isInviterEmails = (value: unknown): value is InviterEmails =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every((email) => typeof email === "string")

const parsedInviters = (stored: string | null): InviterEmails => {
	if (!stored) {
		return {}
	}
	try {
		const value: unknown = JSON.parse(stored)
		return isInviterEmails(value) ? value : {}
	} catch {
		return {}
	}
}

const readInviters = () => parsedInviters(localStorage.getItem(INVITERS_KEY))

const writeInviters = (inviters: InviterEmails) =>
	localStorage.setItem(INVITERS_KEY, JSON.stringify(inviters))

export const storedInviters: SpaceInviters = {
	of: (joinedId) => readInviters()[joinedId] ?? "",
	remember: (joinedId, email) =>
		writeInviters({ ...readInviters(), [joinedId]: email }),
	forget: (joinedId) => {
		const { [joinedId]: _forgotten, ...kept } = readInviters()
		writeInviters(kept)
	},
}
