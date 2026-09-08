import type {
	AppSidebarBot,
	AppSidebarConversation,
	Space,
	UserChipIdentity,
} from "@workspace/ui/components/app-sidebar"
import type {
	MissionCardModel,
	MissionState,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"
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

const CONVERSATION_BOTS: RosterBot[] = [ICHI, NI]

const ROSTER_CONVERSATIONS: AppSidebarConversation[] = [
	{
		id: CONVERSATION_ID,
		name: SCENE_COPY.conversation.name,
		participants: CONVERSATION_BOTS,
		lastSpeaker: SCENE_COPY.conversation.speaker,
		lastMessage: SCENE_COPY.conversation.preview,
		timestamp: SCENE_COPY.conversation.timestamp,
	},
]

const SPACES: Space[] = [
	{ id: "kiroshi", name: SCENE_COPY.spaces.kiroshi, colour: "yellow" },
	{ id: "atelier", name: SCENE_COPY.spaces.atelier, colour: "green" },
	{ id: "veille", name: SCENE_COPY.spaces.veille, colour: "orange" },
]

const SELECTED_SPACE = SPACES[0]

const ROSTER_BY_SPACE: Record<string, AppSidebarBot[]> = {
	[SELECTED_SPACE.id]: ROSTER_ROWS,
}

const CONVERSATIONS_BY_SPACE: Record<string, AppSidebarConversation[]> = {
	[SELECTED_SPACE.id]: ROSTER_CONVERSATIONS,
}

const READER: UserChipIdentity = { name: SCENE_COPY.reader }

const MISSION: MissionCardModel = {
	id: "mission-working-row",
	identity: NI,
	objective: SCENE_COPY.missionObjective,
	ticket: SCENE_COPY.missionTicket,
	tools: [],
	state: "working",
	isClosed: false,
}

const PANEL_MISSION_STATES: MissionState[] = [
	"working",
	"waiting_human",
	"ready_to_merge",
]

const PANEL_MISSION_BOTS: RosterBot[] = [NI, ICHI, SAN]

const PANEL_MISSIONS: MissionRowModel[] = SCENE_COPY.panelMissions.map(
	(mission, index) => ({
		id: mission.externalId,
		objective: mission.objective,
		ticket: {
			platform: SCENE_COPY.missionTicket.platform,
			externalId: mission.externalId,
			title: "",
		},
		bot: PANEL_MISSION_BOTS[index],
		state: PANEL_MISSION_STATES[index],
		timestamp: mission.timestamp,
	}),
)

export {
	CONVERSATION_BOTS,
	CONVERSATION_ID,
	CONVERSATIONS_BY_SPACE,
	HAPPY,
	ICHI,
	MISSION,
	NI,
	PANEL_MISSIONS,
	READER,
	REI,
	ROSTER_BY_SPACE,
	ROSTER_CONVERSATIONS,
	ROSTER_ROWS,
	SAN,
	SCENE_BOTS,
	SELECTED_SPACE,
	SPACES,
}
