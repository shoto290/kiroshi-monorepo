import type { RosterBot } from "@workspace/ui/components/roster"

const CONVERSATION_BOTS: RosterBot[] = [
	{ id: "bot-atlas", name: "Atlas", blot: "blue" },
	{ id: "bot-basile", name: "Basile", blot: "purple" },
	{ id: "bot-clemence", name: "Clémence", blot: "pink" },
	{ id: "bot-dorian", name: "Dorian", blot: "orange" },
	{ id: "bot-elia", name: "Elia", blot: "green" },
	{ id: "bot-faust", name: "Faust", blot: "cyan" },
]

const LONG_NAMED_BOTS: RosterBot[] = [
	{
		id: "bot-release",
		name: "Release notes editor for the desktop build",
		blot: "yellow",
	},
	{
		id: "bot-triage",
		name: "Incident triage and on-call handover companion",
		blot: "red",
	},
]

export { CONVERSATION_BOTS, LONG_NAMED_BOTS }
