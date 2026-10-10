import {
	type AppSidebarBot,
	type AppSidebarConversation,
	type AppSidebarSection,
	isBusy,
	NO_BOTS,
	NO_CONVERSATIONS,
	NO_SECTIONS,
	type RosterPin,
	type SectionNaming,
} from "@workspace/ui/components/app-sidebar-model"
import {
	botEntry,
	byRank,
	conversationEntry,
	endOfSection,
	type Landing,
	type PinnedEntry,
	pinOf,
	type RosterRow,
	SORTED,
	sectionOf,
	toPin,
} from "@workspace/ui/components/app-sidebar-pins"
import type { Space } from "@workspace/ui/components/space"

interface RosterEntriesSource {
	bots: AppSidebarBot[]
	conversations: AppSidebarConversation[]
	sections: AppSidebarSection[]
	naming: SectionNaming | null
}

const rosterEntriesOf = ({
	bots,
	conversations,
	sections,
	naming,
}: RosterEntriesSource) => {
	const known = new Set(sections.map((section) => section.id))

	const isNamed = (id: string) => id === naming?.rowId

	const isHeldBy = (held: RosterRow, sectionId: string | null) =>
		!isNamed(held.id) &&
		pinOf(held) !== null &&
		sectionOf(held, known) === sectionId

	const rowsOf = (sectionId: string | null): PinnedEntry[] =>
		[
			...conversations
				.filter((conversation) => isHeldBy(conversation, sectionId))
				.map((conversation) => conversationEntry(conversation, sectionId)),
			...bots
				.filter((bot) => isHeldBy(bot, sectionId))
				.map((bot) => botEntry(bot, sectionId)),
		].toSorted(byRank)

	const topLevel = [
		...sections.map((section) => ({
			id: section.id,
			sectionId: null,
			rank: section.position,
			section,
		})),
		...rowsOf(null),
	].toSorted(byRank)

	const flatten = (entries: PinnedEntry[]) =>
		entries.flatMap((entry) =>
			entry.section ? [entry, ...rowsOf(entry.section.id)] : [entry],
		)

	const pinnedEntries = flatten(topLevel)

	const isSorted = (held: RosterRow) =>
		!isNamed(held.id) && pinOf(held) === null

	const looseEntry = (id: string): PinnedEntry | undefined => {
		const bot = bots.find((held) => held.id === id)
		if (bot) return botEntry(bot)
		const conversation = conversations.find((held) => held.id === id)
		return conversation ? conversationEntry(conversation) : undefined
	}

	const blockOf = (id: string): PinnedEntry[] => {
		const held = pinnedEntries.find((entry) => entry.id === id)
		if (!held) {
			const loose = looseEntry(id)
			return loose ? [loose] : []
		}
		return held.section ? [held, ...rowsOf(held.section.id)] : [held]
	}

	const withoutBlock = (id: string) => {
		const moving = new Set(blockOf(id).map((entry) => entry.id))
		return pinnedEntries.filter((entry) => !moving.has(entry.id))
	}

	const topLevelWithout = (id: string) =>
		topLevel.filter((entry) => entry.id !== id)

	const holderOf = (area: string) => {
		if (known.has(area)) return area
		return pinnedEntries.find((entry) => entry.id === area)?.sectionId ?? null
	}

	return {
		blockOf,
		flatten,
		holderOf,
		isNamed,
		looseEntry,
		pinnedEntries,
		rowsOf,
		sortedBots: bots.filter(isSorted),
		sortedConversations: conversations.filter(isSorted),
		topLevel,
		topLevelWithout,
		withoutBlock,
	}
}

type RosterEntries = ReturnType<typeof rosterEntriesOf>

interface RosterMovesSource {
	entries: RosterEntries
	spaceId?: string
	onPinRoster?: (spaceId: string, pins: RosterPin[]) => void
}

const rosterMovesOf = ({
	entries,
	spaceId,
	onPinRoster,
}: RosterMovesSource) => {
	const {
		topLevel,
		pinnedEntries,
		flatten,
		blockOf,
		withoutBlock,
		looseEntry,
	} = entries

	const standsAlready = (held: PinnedEntry[]) =>
		held.length === pinnedEntries.length &&
		held.every(
			(entry, rank) =>
				entry.id === pinnedEntries[rank]?.id &&
				entry.sectionId === pinnedEntries[rank]?.sectionId,
		)

	const pin = (held: PinnedEntry[]) => {
		if (!spaceId || standsAlready(held)) return
		onPinRoster?.(spaceId, held.map(toPin))
	}

	const placeSection = (id: string, at: number) => {
		const held = topLevel.find((entry) => entry.id === id)
		if (!held) return
		const rest = topLevel.filter((entry) => entry.id !== id)
		pin(flatten([...rest.slice(0, at), held, ...rest.slice(at)]))
	}

	const land = (id: string, landing: Landing) => {
		const moving = blockOf(id)
		const lifted = moving[0]
		if (!lifted) return
		if (landing === SORTED) {
			pin(withoutBlock(id))
			return
		}
		if (lifted.section) {
			placeSection(id, landing.at)
			return
		}
		const rest = withoutBlock(id)
		pin([
			...rest.slice(0, landing.at),
			{ ...lifted, sectionId: landing.holder },
			...rest.slice(landing.at),
		])
	}

	const pinLast = (id: string) => {
		const row = looseEntry(id)
		if (row) pin([...withoutBlock(id), { ...row, sectionId: null }])
	}

	const unpin = (id: string) => pin(withoutBlock(id))

	const fileRow = (id: string, sectionId: string | null) => {
		if (sectionId === null) {
			unpin(id)
			return
		}
		const row = looseEntry(id)
		const rest = withoutBlock(id)
		const at = endOfSection(rest, sectionId)
		if (!row || at < 0) return
		pin([...rest.slice(0, at), { ...row, sectionId }, ...rest.slice(at)])
	}

	const moveSection = (id: string, by: number) => {
		const at = topLevel.findIndex((entry) => entry.id === id) + by
		if (at < 0 || at >= topLevel.length) return
		placeSection(id, at)
	}

	return { fileRow, land, moveSection, pinLast, unpin }
}

interface SpaceRostersSource {
	bots: AppSidebarBot[]
	conversations: AppSidebarConversation[]
	sections: AppSidebarSection[]
	botsBySpaceId?: Record<string, AppSidebarBot[]>
	conversationsBySpaceId?: Record<string, AppSidebarConversation[]>
	sectionsBySpaceId?: Record<string, AppSidebarSection[]>
	spaces: Space[]
	selectedSpaceId?: string
	selectedBotId?: string
	selectedConversationId?: string
}

const spaceRostersOf = ({
	bots,
	conversations,
	sections,
	botsBySpaceId,
	conversationsBySpaceId,
	sectionsBySpaceId,
	spaces,
	selectedSpaceId,
	selectedBotId,
	selectedConversationId,
}: SpaceRostersSource) => {
	const botsOf = (spaceId: string) => botsBySpaceId?.[spaceId] ?? NO_BOTS

	const conversationsOf = (spaceId: string) =>
		conversationsBySpaceId
			? (conversationsBySpaceId[spaceId] ?? NO_CONVERSATIONS)
			: conversations

	const sectionsOf = (spaceId: string) =>
		sectionsBySpaceId ? (sectionsBySpaceId[spaceId] ?? NO_SECTIONS) : sections

	const isPerSpace = Boolean(botsBySpaceId) && spaces.length > 0
	const shownSpaceId = isPerSpace ? selectedSpaceId : undefined
	const shownBots = shownSpaceId ? botsOf(shownSpaceId) : bots
	const shownConversations = shownSpaceId
		? conversationsOf(shownSpaceId)
		: conversations

	return {
		botsOf,
		conversationsOf,
		isPerSpace,
		isWorking: shownBots.some(isBusy) || shownConversations.some(isBusy),
		sectionsOf,
		selectedBot: shownBots.find((bot) => bot.id === selectedBotId),
		selectedConversation: shownConversations.find(
			(conversation) => conversation.id === selectedConversationId,
		),
	}
}

export { type RosterEntries, rosterEntriesOf, rosterMovesOf, spaceRostersOf }
