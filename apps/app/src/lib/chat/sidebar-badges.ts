import type {
	AppRailCounts,
	AppRailDots,
} from "@workspace/ui/components/app-rail"
import type { BotBadge as ShownBadge } from "@workspace/ui/components/bot-badge"

import type { BotBadge } from "./bot-badge"

import { rosterLineKey } from "../bots/roster-line"
import {
	isAnyMissionWaiting,
	type MissionsByRow,
	missionsIn,
} from "../missions/missions-model"

type BadgedRow = {
	id: string
}

type BadgeCarrier = {
	badge?: ShownBadge
}

type BadgeCarriersBySpaceId = Record<string, BadgeCarrier[]>

type Badged<Row> = Row & BadgeCarrier

const STRONGEST_FIRST: ShownBadge[] = ["attention", "failed", "done"]

const shownBadge = (badge: BotBadge | undefined): ShownBadge | undefined =>
	badge === undefined || badge === "none" ? undefined : badge

export const withBadges = <Row extends BadgedRow>(
	rows: Row[],
	badges: Record<string, BotBadge>,
): Badged<Row>[] =>
	rows.map((row) => ({ ...row, badge: shownBadge(badges[row.id]) }))

export const withLineBadges = <Row extends BadgedRow>(
	rows: Row[],
	badges: Record<string, BotBadge>,
	spaceId: string | null,
): Badged<Row>[] =>
	rows.map((row) => ({
		...row,
		badge:
			spaceId === null
				? undefined
				: shownBadge(badges[rosterLineKey({ spaceId, botId: row.id })]),
	}))

const strongestBadge = (rows: BadgeCarrier[]): ShownBadge | undefined =>
	STRONGEST_FIRST.find((badge) => rows.some((row) => row.badge === badge))

export const toSpaceBadges = (
	...groups: BadgeCarriersBySpaceId[]
): Record<string, ShownBadge> => {
	const spaceIds = new Set(groups.flatMap((group) => Object.keys(group)))
	const badges: Record<string, ShownBadge> = {}
	for (const spaceId of spaceIds) {
		const badge = strongestBadge(
			groups.flatMap((group) => group[spaceId] ?? []),
		)
		if (badge) {
			badges[spaceId] = badge
		}
	}
	return badges
}

type RailSources = {
	conversationsBySpaceId: BadgeCarriersBySpaceId
	missionsBySpaceId: Record<string, MissionsByRow>
	spaceId: string | null
}

type RailSignals = {
	counts: AppRailCounts
	dots: AppRailDots
}

const NO_CONVERSATIONS: BadgeCarrier[] = []

export const toRailSignals = ({
	conversationsBySpaceId,
	missionsBySpaceId,
	spaceId,
}: RailSources): RailSignals => {
	const conversations =
		spaceId === null
			? NO_CONVERSATIONS
			: (conversationsBySpaceId[spaceId] ?? NO_CONVERSATIONS)
	return {
		counts: {
			conversations: conversations.filter((row) => row.badge).length,
		},
		dots: {
			conversations: conversations.some((row) => row.badge === "attention"),
			missions: isAnyMissionWaiting(missionsIn(missionsBySpaceId, spaceId)),
		},
	}
}
