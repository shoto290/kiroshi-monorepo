import type {
	AppSidebarBot,
	AppSidebarConversation,
	Space,
} from "@workspace/ui/components/app-sidebar"
import type { MissionCardModel } from "@workspace/ui/components/mission"
import type { RosterBot } from "@workspace/ui/components/roster"

import { SCENE_COPY } from "./copy"

const ICHI: RosterBot = {
	id: "ichi",
	name: SCENE_COPY.ichi.name,
	title: SCENE_COPY.ichi.title,
	animal: "owl",
	blot: "blue",
}

const NI: RosterBot = {
	id: "ni",
	name: SCENE_COPY.ni.name,
	title: SCENE_COPY.ni.title,
	animal: "cat",
	blot: "pink",
}

const SAN: RosterBot = {
	id: "san",
	name: SCENE_COPY.san.name,
	title: SCENE_COPY.san.title,
	animal: "rabbit",
	blot: "green",
}

const REI: RosterBot = {
	id: "rei",
	name: SCENE_COPY.rei.name,
	title: SCENE_COPY.rei.title,
	animal: "bear",
	blot: "purple",
}

const HAPPY: RosterBot = {
	id: "happy",
	name: SCENE_COPY.happy.name,
	title: SCENE_COPY.happy.title,
	animal: "chick",
	blot: "yellow",
}

const SCENE_BOTS: RosterBot[] = [ICHI, NI, SAN, REI, HAPPY]

type RosterCopy = {
	timestamp: string
	preview: string
}

const rosterRow = (bot: RosterBot, copy: RosterCopy): AppSidebarBot => ({
	...bot,
	lastMessage: copy.preview,
	timestamp: copy.timestamp,
})

const ROSTER_ROWS: AppSidebarBot[] = [
	rosterRow(ICHI, SCENE_COPY.ichi),
	rosterRow(NI, SCENE_COPY.ni),
	rosterRow(SAN, SCENE_COPY.san),
	rosterRow(REI, SCENE_COPY.rei),
	rosterRow(HAPPY, SCENE_COPY.happy),
]

const CONVERSATION_ID = "version-015"

const ROSTER_CONVERSATIONS: AppSidebarConversation[] = [
	{
		id: CONVERSATION_ID,
		name: SCENE_COPY.conversation.name,
		participants: [ICHI, NI],
		lastSpeaker: SCENE_COPY.conversation.speaker,
		lastMessage: SCENE_COPY.conversation.preview,
		timestamp: SCENE_COPY.conversation.timestamp,
	},
]

const SPACES: Space[] = [
	{ id: "kiroshi", name: SCENE_COPY.spaces.kiroshi, colour: "purple" },
	{ id: "atelier", name: SCENE_COPY.spaces.atelier, colour: "green" },
	{ id: "veille", name: SCENE_COPY.spaces.veille, colour: "orange" },
]

const SELECTED_SPACE_ID = SPACES[0].id

const MISSION: MissionCardModel = {
	id: "mission-working-row",
	identity: NI,
	objective: SCENE_COPY.missionObjective,
	ticket: SCENE_COPY.missionTicket,
	tools: [],
	state: "working",
	isClosed: false,
}

export {
	CONVERSATION_ID,
	HAPPY,
	ICHI,
	MISSION,
	NI,
	ROSTER_CONVERSATIONS,
	ROSTER_ROWS,
	SCENE_BOTS,
	SELECTED_SPACE_ID,
	SPACES,
}
