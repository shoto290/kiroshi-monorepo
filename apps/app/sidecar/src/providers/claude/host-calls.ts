import { askHost, HostRefusal } from "../../host"

const spoken = (answer: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(answer ?? null) }],
})

export const refused = (error: unknown) => ({
	...spoken(error),
	isError: true,
})

export const carriedTo =
	(subtype: string) =>
	async (session: string | undefined, operation: string, payload: object) => {
		try {
			return spoken(await askHost(session, { subtype, operation, payload }))
		} catch (error) {
			if (error instanceof HostRefusal) {
				return refused(error.error)
			}
			throw error
		}
	}
