export type RosterLine = {
	spaceId: string
	botId: string
}

export type SoloThreads = Record<string, RosterLine>

export const rosterLineKey = ({ spaceId, botId }: RosterLine): string =>
	`${spaceId}/${botId}`

export const rosterLineOf = (key: string): RosterLine => {
	const [spaceId, botId] = key.split("/")
	return { spaceId, botId }
}

export const rosterLinesIn = (
	rosters: Record<string, { id: string }[]>,
): RosterLine[] =>
	Object.entries(rosters).flatMap(([spaceId, bots]) =>
		bots.map((bot) => ({ spaceId, botId: bot.id })),
	)

export const runsIn = (
	soloThreads: SoloThreads,
	conversationId: string | null,
	spaceId: string,
): boolean =>
	conversationId !== null && soloThreads[conversationId]?.spaceId === spaceId
