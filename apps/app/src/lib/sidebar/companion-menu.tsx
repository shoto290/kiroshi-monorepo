import { createContext, useContext, useMemo } from "react"

import type {
	AppSidebarBot,
	AppSidebarConversation,
	AppSidebarSection,
	RosterPin,
	Space,
} from "@workspace/ui/components/app-sidebar"
import {
	CompanionMenuContent,
	type CompanionMenuLookup,
} from "@workspace/ui/components/companion-menu"

import {
	filedInSection,
	isPinnedRow,
	pinnedLast,
	pinsOf,
	withoutPin,
} from "./roster-pins"
import type { SidebarActions } from "./use-sidebar-actions"

const NO_COMPANION_MENU: CompanionMenuLookup = () => null

export const CompanionMenuContext =
	createContext<CompanionMenuLookup>(NO_COMPANION_MENU)

export const useCompanionMenu = () => useContext(CompanionMenuContext)

export type CompanionMenuActions = Pick<
	SidebarActions,
	| "onAddBotToSpace"
	| "onDeleteBot"
	| "onDuplicateBot"
	| "onEditBot"
	| "onPinRoster"
	| "onRemoveBotFromSpace"
>

export type CompanionMenuSource = {
	actions: CompanionMenuActions
	botsBySpaceId: Record<string, AppSidebarBot[]>
	conversationsBySpaceId: Record<string, AppSidebarConversation[]>
	sectionsBySpaceId: Record<string, AppSidebarSection[]>
	spaces: Space[]
	openSpaceId: string | null
}

const spaceIdsOfBot = (
	botsBySpaceId: Record<string, AppSidebarBot[]>,
	botId: string,
) =>
	Object.entries(botsBySpaceId)
		.filter(([, held]) => held.some((bot) => bot.id === botId))
		.map(([spaceId]) => spaceId)

export const useCompanionMenuLookup = ({
	actions,
	botsBySpaceId,
	conversationsBySpaceId,
	sectionsBySpaceId,
	spaces,
	openSpaceId,
}: CompanionMenuSource): CompanionMenuLookup =>
	useMemo(() => {
		if (!openSpaceId) return NO_COMPANION_MENU

		const bots = botsBySpaceId[openSpaceId] ?? []
		const sections = sectionsBySpaceId[openSpaceId] ?? []
		const pins = pinsOf({
			rows: [...(conversationsBySpaceId[openSpaceId] ?? []), ...bots],
			sections,
		})

		const repin = (next: RosterPin[]) => actions.onPinRoster(openSpaceId, next)

		const pin = (id: string) => repin(pinnedLast(pins, id))

		const unpin = (id: string) => repin(withoutPin(pins, id))

		const moveToSection = (id: string, sectionId: string | null) => {
			if (sectionId === null) {
				unpin(id)
				return
			}
			const filed = filedInSection(pins, id, sectionId)
			if (filed) repin(filed)
		}

		return (companionId: string) => {
			const companion = bots.find((bot) => bot.id === companionId)
			if (!companion) return null

			return (
				<CompanionMenuContent
					companion={companion}
					isPinned={isPinnedRow(companion)}
					memberships={spaceIdsOfBot(botsBySpaceId, companionId)}
					onAddToSpace={actions.onAddBotToSpace}
					onDelete={actions.onDeleteBot}
					onDuplicate={actions.onDuplicateBot}
					onEdit={actions.onEditBot}
					onMoveToSection={sections.length > 0 ? moveToSection : undefined}
					onPin={pin}
					onRemoveFromSpace={actions.onRemoveBotFromSpace}
					onUnpin={unpin}
					openSpaceId={openSpaceId}
					sections={sections}
					spaces={spaces}
				/>
			)
		}
	}, [
		actions,
		botsBySpaceId,
		conversationsBySpaceId,
		sectionsBySpaceId,
		spaces,
		openSpaceId,
	])
