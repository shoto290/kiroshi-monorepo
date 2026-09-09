export const WEBSITE_COPY = {
	headline: "Your team of companions.",
	lead: "They live on your machine, work in your tools, and keep going while you do something else.",
	capabilities: [
		"Message them like teammates. They hand work to each other.",
		"Show one how you work. It keeps the skill.",
		"Give them routines and missions. They run without you.",
		"Keep work and personal apart, in two spaces.",
	],
	downloadAction: "Download",
	downloadActionMacOS: "Download for macOS",
	downloadActionWindows: "Download for Windows",
	downloadActionLinux: "Download for Linux",
	githubAction: "View on GitHub",
	mobileNote:
		"Desktop today, mobile soon. Open this page on your computer to download.",
	fineprintRuns: "RUNS ON YOUR",
	fineprintSubscription: "CLAUDE SUBSCRIPTION",
	fineprintSeparator: "·",
	fineprintLicense: "MIT",
	credit: "Made by Shoto",
	creditHandle: "@shoto290",
}

const AUTHOR_SLUG = "shoto290"

const REPOSITORY_SLUG = `${AUTHOR_SLUG}/kiroshi-monorepo`

export const AUTHOR_URL = `https://github.com/${AUTHOR_SLUG}`

export const AUTHOR_X_URL = `https://x.com/${AUTHOR_SLUG}`

export const REPOSITORY_URL = `https://github.com/${REPOSITORY_SLUG}`

export const RELEASES_URL = `${REPOSITORY_URL}/releases`

export const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPOSITORY_SLUG}/releases/latest`

export const SCENE_COPY = {
	spaces: {
		kiroshi: "Kiroshi",
		atelier: "Atelier",
		veille: "Veille",
	},
	sceneLabel: "Live demonstration of the Kiroshi app",
	reader: "Steve",
	threadTitle: "Version 015",
	composerPlaceholder: "Message the room, or @ a companion...",
	conversation: {
		name: "Version 015",
		timestamp: "now",
		speaker: "Ichi",
		preview: "thinking...",
	},
	ichi: {
		ask: "Where did you land on the working row?",
		name: "Ichi",
		title: "Front-end",
		timestamp: "2m",
		preview: "The seat now clears on the first published block.",
	},
	ni: {
		ask: "Are both sources announcing yet?",
		name: "Ni",
		title: "Core",
		timestamp: "4m",
		preview: "The webhook and the GitHub poll now announce.",
	},
	san: {
		ask: "What became of the mission strips?",
		name: "San",
		title: "Design",
		timestamp: "12m",
		preview: "Strips are back to the pill, one per mission.",
	},
	rei: {
		ask: "How does the landing page read now?",
		name: "Rei",
		title: "Designer",
		timestamp: "1h",
		preview: "Three pillars, one real app view each.",
	},
	happy: {
		ask: "Anything left to settle before the freeze?",
		name: "Happy",
		title: "Lead",
		timestamp: "3h",
		preview: "Scope is frozen. Tickets are on the board.",
	},
	opening:
		"Scope is frozen and the board is written. Two tickets left on the working row: the label that never hides, and the clock beside it.",
	request:
		"<@ichi> <@ni> the working row vanishes once a companion has published. Take it between you.",
	ichiAnswer:
		"The label rides the row from the first frame now, shimmering, and no hover is needed to read it.",
	niAnswer:
		"The clock keeps its tabular figures beside that label, so the row holds still while the seconds climb.",
	missionObjective:
		"Clear the working row of a companion the moment its first block is published.",
	panelMissions: [
		{
			objective:
				"Clear the working row of a companion the moment its first block is published.",
			externalId: "OPE-58",
			timestamp: "now",
		},
		{
			objective: "Keep the label of the working row readable without a hover.",
			externalId: "OPE-57",
			timestamp: "12m",
		},
		{
			objective: "Count the clock of the working row in tabular figures.",
			externalId: "OPE-56",
			timestamp: "1h",
		},
	],
	missionTicket: {
		externalId: "OPE-58",
		title: "",
		platform: "linear",
		url: "",
	},
}
