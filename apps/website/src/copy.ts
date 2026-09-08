export const WEBSITE_COPY = {
	headlineFirstLine: "A team of companions.",
	headlineSecondLine: "They finish the work.",
	lead: "Kiroshi is a desktop app where you keep a team of bots, on your own machine.",
	downloadAction: "Download",
	downloadActionMacOS: "Download for macOS",
	downloadActionWindows: "Download for Windows",
	githubAction: "View on GitHub",
	mobileNote:
		"Desktop today, mobile soon. Open this page on your computer to download.",
	fineprintRuns: "RUNS ON YOUR",
	fineprintSubscription: "CLAUDE SUBSCRIPTION",
	fineprintSeparator: "·",
	fineprintLicense: "MIT",
}

const REPOSITORY_SLUG = "shoto290/kiroshi-monorepo"

export const REPOSITORY_URL = `https://github.com/${REPOSITORY_SLUG}`

export const RELEASES_URL = `${REPOSITORY_URL}/releases`

export const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPOSITORY_SLUG}/releases/latest`

export const SCENE_COPY = {
	spaces: {
		kiroshi: "Kiroshi",
		atelier: "Atelier",
		veille: "Veille",
	},
	threadTitle: "Release crew",
	panelAction: "Open the side panel",
	conversation: {
		name: "Release crew",
		timestamp: "09:41",
		preview: "Ichi and Ni are on the crash report.",
	},
	happy: {
		name: "Happy",
		title: "Support",
		timestamp: "09:32",
		preview: "Wrote back to the three tickets in the inbox.",
	},
	ichi: {
		name: "Ichi",
		title: "Backend",
		timestamp: "09:20",
		preview: "The retry loop is fixed and the suite is green.",
	},
	ni: {
		name: "Ni",
		title: "Frontend",
		timestamp: "09:04",
		preview: "Pushed the empty state of the roster.",
	},
	kuma: {
		name: "Kuma",
		title: "Research",
		timestamp: "Mon",
		preview: "Summarised the two papers you dropped.",
	},
	sora: {
		name: "Sora",
		title: "Docs",
		timestamp: "Mon",
		preview: "Rewrote the install page around the new command.",
	},
	opening:
		"The crash report landed this morning. Two things are broken, and not in the same place.",
	request: "Take one each and tell me what you find.",
	ichiAnswer:
		"The retry loop never clears its timer, so a second failure stacks on the first one.",
	niAnswer:
		"On my side, the roster keeps its old rows after a space switch, and the crash hits a bot that is gone.",
	missionObjective:
		"Clear the retry timer and drop the stale roster rows before the next release.",
	missionTicket: {
		externalId: "KIR-118",
		title: "Crash on the second failure",
		platform: "linear",
		url: "",
	},
}
