import type { MessageAuthor } from "@workspace/ui/components/message"
import type {
	MissionBot,
	MissionCardModel,
	MissionEventModel,
	MissionTicket,
} from "@workspace/ui/components/mission"
import type { MissionRowModel } from "@workspace/ui/components/mission-row"

export const MISSIONS_READ_AT = Date.parse("2026-03-04T09:30:00Z")

export const WORKING_MISSION: MissionRowModel = {
	id: "mission-parser",
	objective: "Rewrite the changelog parser",
	ticketId: "OPE-42",
	tools: ["Read", "Write"],
	openedAt: MISSIONS_READ_AT - 5_400_000,
	badge: null,
}

export const WAITING_HUMAN_MISSION: MissionRowModel = {
	id: "mission-migration",
	objective: "Migrate the run history table",
	ticketId: "OPE-51",
	tools: ["Read", "Bash"],
	openedAt: MISSIONS_READ_AT - 172_800_000,
	badge: "attention",
}

export const READY_MISSION: MissionRowModel = {
	id: "mission-badges",
	objective: "Draw the badge dots of the roster",
	ticketId: "OPE-29",
	tools: ["Read", "Write", "Bash"],
	openedAt: MISSIONS_READ_AT - 18_000_000,
	badge: "done",
}

export const FAILED_MISSION: MissionRowModel = {
	id: "mission-upgrade",
	objective: "Upgrade the desktop shell",
	ticketId: "OPE-17",
	tools: ["Bash"],
	openedAt: MISSIONS_READ_AT - 604_800_000,
	badge: "failed",
}

export const RUNNING_MISSIONS: MissionRowModel[] = [
	WAITING_HUMAN_MISSION,
	READY_MISSION,
	FAILED_MISSION,
	WORKING_MISSION,
]

export const CLOSED_MISSIONS: MissionRowModel[] = [
	{
		id: "mission-transcript",
		objective: "Store the transcript of a mission thread",
		ticketId: "OPE-25",
		tools: ["Read", "Write"],
		openedAt: MISSIONS_READ_AT - 1_209_600_000,
		badge: null,
	},
	{
		id: "mission-tools",
		objective: "Let a bot manage its routines through MCP",
		ticketId: "OPE-22",
		tools: ["Read", "Write", "Bash"],
		openedAt: MISSIONS_READ_AT - 2_592_000_000,
		badge: null,
	},
]

export const NO_MISSIONS: MissionRowModel[] = []

export const MISSION_NOW = new Date("2026-03-04T09:30:00Z").getTime()

const minutesBefore = (minutes: number) => MISSION_NOW - minutes * 60_000

export const MISSION_BOT: MissionBot = {
	name: "Ada Martin",
	animal: "owl",
	seed: "bot-ada-martin",
}

export const MISSION_TICKET: MissionTicket = {
	externalId: "OPE-30",
	title: "Mission thread screen and mission card in the origin",
}

export const MISSION_TOOLS = ["Repository", "Terminal", "Web search"]

export const MISSION_EVENTS: MissionEventModel[] = [
	{
		id: "event-opened",
		kind: "opened",
		source: "claude-code",
		createdAt: minutesBefore(48),
	},
	{
		id: "event-note",
		kind: "note",
		source: "claude-code",
		createdAt: minutesBefore(41),
		text: "Read the Rust contract and mirrored every kind and every state before touching a pixel.",
	},
	{
		id: "event-agent-asked",
		kind: "agent_asked",
		source: "claude-code",
		createdAt: minutesBefore(33),
	},
	{
		id: "event-answered",
		kind: "answered",
		source: "claude-code",
		createdAt: minutesBefore(30),
	},
	{
		id: "event-escalated",
		kind: "escalated",
		source: "claude-code",
		createdAt: minutesBefore(12),
		text: "The payload carries no field this design can trust yet. Which one names the ticket?",
	},
	{
		id: "event-ready",
		kind: "ready",
		source: "claude-code",
		createdAt: minutesBefore(6),
	},
	{
		id: "event-failed",
		kind: "failed",
		source: "claude-code",
		createdAt: minutesBefore(4),
	},
	{
		id: "event-closed",
		kind: "closed",
		source: "claude-code",
		createdAt: minutesBefore(1),
	},
]

export const AUTHORED_MISSION_EVENTS: MissionEventModel[] = [
	{
		id: "event-authored-note",
		kind: "note",
		source: "claude-code",
		createdAt: minutesBefore(24),
		text: "Read the Rust contract and mirrored every kind and every state before touching a pixel.",
	},
	{
		id: "event-authored-agent-asked",
		kind: "agent_asked",
		source: "claude-code",
		createdAt: minutesBefore(18),
		text: "Which field of the payload names the ticket this mission answers?",
	},
	{
		id: "event-authored-answered",
		kind: "answered",
		source: "ada.martin",
		createdAt: minutesBefore(11),
		text: "None of them yet. Read the ticket off the mission, not off the payload.",
	},
	{
		id: "event-authored-escalated",
		kind: "escalated",
		source: "claude-code",
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
		url: "https://linear.example/opennest/issue/OPE-30",
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
		url: "https://linear.example/opennest/issue/OPE-25",
	},
	tools: ["Superset"],
	state: "done",
	isClosed: true,
}
