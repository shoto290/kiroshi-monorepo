import type { MessageAuthor } from "@workspace/ui/components/message"
import type {
	MissionBot,
	MissionCardModel,
	MissionEventModel,
	MissionTicketLink,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"
import type { ReportedRunRowModel } from "@workspace/ui/components/reported-run-row"
import type { EarlierTodayRow } from "@workspace/ui/components/routines-panel"

export const MISSION_BOT: MissionBot = {
	name: "Ada Martin",
	animal: "owl",
	seed: "bot-ada-martin",
}

const STORAGE_BOT: MissionBot = {
	name: "Noor Beltran",
	animal: "rabbit",
	seed: "bot-noor-beltran",
}

const SHELL_BOT: MissionBot = {
	name: "Iris Nakamura",
	animal: "cat",
	seed: "bot-iris-nakamura",
}

export const WAITING_HUMAN_MISSION: MissionRowModel = {
	id: "mission-migration",
	objective: "Migrate the run history table",
	ticket: {
		platform: "linear",
		externalId: "OPE-51",
		title: "Move the run history off the shared database",
	},
	bot: MISSION_BOT,
	state: "waiting_human",
	timestamp: "2d",
}

export const READY_MISSION: MissionRowModel = {
	id: "mission-badges",
	objective: "Draw the badge dots of the roster",
	ticket: {
		platform: "github",
		externalId: "OPE-29",
		title: "Badge dots on the roster rows",
	},
	bot: STORAGE_BOT,
	state: "ready_to_merge",
	timestamp: "5h",
}

export const WORKING_MISSION: MissionRowModel = {
	id: "mission-parser",
	objective: "Rewrite the changelog parser",
	ticket: {
		platform: "linear",
		externalId: "OPE-42",
		title: "Changelog parser",
	},
	bot: MISSION_BOT,
	state: "working",
	timestamp: "1h",
}

export const WAITING_BOT_MISSION: MissionRowModel = {
	id: "mission-transcript",
	objective: "Store the transcript of a mission thread",
	ticket: {
		platform: "jira",
		externalId: "",
		title: "Mission transcripts kept next to the conversation",
	},
	bot: SHELL_BOT,
	state: "waiting_bot",
	timestamp: "12m",
}

export const FAILED_MISSION: MissionRowModel = {
	id: "mission-upgrade",
	objective: "Upgrade the desktop shell",
	ticket: {
		platform: "github",
		externalId: "OPE-17",
		title: "Desktop shell upgrade",
	},
	bot: SHELL_BOT,
	state: "failed",
	timestamp: "3d",
}

export const CLOSED_MISSION: MissionRowModel = {
	id: "mission-tools",
	objective: "Let a bot manage its routines through MCP",
	ticket: {
		platform: "linear",
		externalId: "OPE-22",
		title: "Routines over MCP",
	},
	bot: STORAGE_BOT,
	state: "done",
	timestamp: "09:12",
}

export const UNTICKETED_MISSION: MissionRowModel = {
	id: "mission-unticketed",
	objective: "Read the shift log of the night",
	ticket: {
		platform: "",
		externalId: "",
		title: "",
	},
	bot: MISSION_BOT,
	state: "working",
	timestamp: "22m",
}

export const OPEN_MISSIONS: MissionRowModel[] = [
	WAITING_HUMAN_MISSION,
	READY_MISSION,
	WORKING_MISSION,
	WAITING_BOT_MISSION,
	FAILED_MISSION,
]

export const REPORTED_RUN: ReportedRunRowModel = {
	id: "run-morning-digest",
	routineTitle: "Morning digest",
	triggerSourceTitle: "On a schedule",
	bot: MISSION_BOT,
	timestamp: "08:04",
}

export const LATE_REPORTED_RUN: ReportedRunRowModel = {
	id: "run-release-watch",
	routineTitle: "Release watch",
	triggerSourceTitle: "Watching a file",
	bot: SHELL_BOT,
	timestamp: "10:04",
}

export const EARLIER_TODAY_ROWS: EarlierTodayRow[] = [
	{ kind: "run", ...LATE_REPORTED_RUN },
	{ kind: "mission", ...CLOSED_MISSION },
	{ kind: "run", ...REPORTED_RUN },
]

export const NO_EARLIER_TODAY: EarlierTodayRow[] = []

export const NO_MISSIONS: MissionRowModel[] = []

export const MISSION_NOW = new Date("2026-03-04T09:30:00Z").getTime()

const minutesBefore = (minutes: number) => MISSION_NOW - minutes * 60_000

export const MISSION_TICKET: MissionTicketLink = {
	externalId: "OPE-30",
	title: "Mission thread screen and mission card in the origin",
	platform: "linear",
	url: "https://linear.example/kiroshi/issue/OPE-30",
}

export const MISSION_OBJECTIVE =
	"Render the mission thread header and its event rows"

export const MISSION_OPENED_AT = MISSION_NOW - 5_400_000

export const MISSION_TOOLS = ["Superset", "GitHub", "Terminal"]

export const MISSION_TOOLS_WITHOUT_A_MARK = ["Terminal", "Web search"]

export const MISSION_EVENTS: MissionEventModel[] = [
	{
		id: "event-opened",
		kind: "opened",
		source: "bot",
		createdAt: minutesBefore(48),
	},
	{
		id: "event-note",
		kind: "note",
		source: "bot",
		createdAt: minutesBefore(41),
		text: "Read the Rust contract and mirrored every kind and every state before touching a pixel.",
	},
	{
		id: "event-agent-asked",
		kind: "agent_asked",
		source: "agent-hook",
		createdAt: minutesBefore(33),
		text: "Which field of the payload names the ticket this mission answers?",
	},
	{
		id: "event-answered",
		kind: "answered",
		source: "human",
		createdAt: minutesBefore(30),
	},
	{
		id: "event-escalated",
		kind: "escalated",
		source: "bot",
		createdAt: minutesBefore(12),
		text: "The payload carries no field this design can trust yet. Which one names the ticket?",
	},
	{
		id: "event-ready",
		kind: "ready",
		source: "github",
		createdAt: minutesBefore(6),
	},
	{
		id: "event-failed",
		kind: "failed",
		source: "github",
		createdAt: minutesBefore(4),
	},
	{
		id: "event-closed",
		kind: "closed",
		source: "bot",
		createdAt: minutesBefore(1),
	},
]

export const AUTHORED_MISSION_EVENTS: MissionEventModel[] = [
	{
		id: "event-authored-note",
		kind: "note",
		source: "bot",
		createdAt: minutesBefore(24),
		text: "Read the Rust contract and mirrored every kind and every state before touching a pixel.",
	},
	{
		id: "event-authored-agent-asked",
		kind: "agent_asked",
		source: "agent-hook",
		createdAt: minutesBefore(18),
		text: "Which field of the payload names the ticket this mission answers?",
	},
	{
		id: "event-authored-answered",
		kind: "answered",
		source: "human",
		createdAt: minutesBefore(11),
		text: "None of them yet. Read the ticket off the mission, not off the payload.",
	},
	{
		id: "event-authored-escalated",
		kind: "escalated",
		source: "bot",
		createdAt: minutesBefore(3),
		text: "The run needs a human to say whether the mirror file should be resolved here or on the other branch.",
	},
]

export const MISSION_CARD_TOOLS = ["Superset", "paper", "GitHub"]

export const MISSION_AUTHOR: MessageAuthor = {
	id: "bot-ada-martin",
	name: MISSION_BOT.name,
	animal: MISSION_BOT.animal,
	title: "Design",
}

export const WORKING_MISSION_CARD: MissionCardModel = {
	id: "mission-ope-31",
	author: MISSION_AUTHOR,
	identity: MISSION_AUTHOR,
	objective:
		"Read every release of the packages this workspace depends on and report what changed.",
	ticket: {
		externalId: "PLAT-118",
		title: "Move the run history off the shared database",
		platform: "jira",
		url: "https://jira.example/browse/PLAT-118",
	},
	tools: MISSION_CARD_TOOLS,
	state: "working",
	isClosed: false,
}

export const WAITING_MISSION_CARD: MissionCardModel = {
	id: "mission-ope-30",
	author: MISSION_AUTHOR,
	identity: MISSION_AUTHOR,
	objective:
		"Ship the mission thread and the card that summarises it in the conversation it came from.",
	ticket: {
		...MISSION_TICKET,
		platform: "linear",
		url: "https://linear.example/kiroshi/issue/OPE-30",
	},
	tools: MISSION_CARD_TOOLS,
	state: "waiting_human",
	isClosed: false,
}

const CLOSED_MISSION_BOT: MessageAuthor = {
	id: "bot-noor-beltran",
	name: "Noor Beltran",
	animal: "rabbit",
	title: "Storage",
}

export const CLOSED_MISSION_CARD: MissionCardModel = {
	id: "mission-ope-25",
	author: CLOSED_MISSION_BOT,
	identity: CLOSED_MISSION_BOT,
	objective:
		"Store a mission, its thread, its events and the commands over them.",
	ticket: {
		externalId: "OPE-25",
		title: "Mission storage and its command surface",
		platform: "linear",
		url: "https://linear.example/kiroshi/issue/OPE-25",
	},
	tools: ["Superset"],
	state: "done",
	isClosed: true,
}
