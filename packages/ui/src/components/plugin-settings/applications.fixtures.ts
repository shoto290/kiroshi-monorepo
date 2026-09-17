import type { BotMcpServerItem } from "@workspace/ui/components/bot-settings"
import type { InstallableApplication } from "@workspace/ui/components/plugin-settings/application-install-page"
import type {
	ApplicationCategory,
	CatalogueApplication,
} from "@workspace/ui/components/plugin-settings/applications-catalogue"

const markOf = (fill: string, letter: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" fill="${fill}"/><text x="18" y="23.5" fill="#ffffff" font-family="system-ui, sans-serif" font-size="15" font-weight="600" text-anchor="middle">${letter}</text></svg>`,
	)}`

const LINEAR_MARK = markOf("#5e6ad2", "L")
const GITHUB_MARK = markOf("#24292f", "G")
const NOTION_MARK = markOf("#191919", "N")
const SENTRY_MARK = markOf("#362d59", "S")
const FIGMA_MARK = markOf("#a259ff", "F")
const POSTGRES_MARK = markOf("#336791", "P")

export const MARKED_APPLICATIONS: BotMcpServerItem[] = [
	{
		name: "linear",
		displayName: "Linear",
		mark: LINEAR_MARK,
		config: { type: "http", url: "https://mcp.linear.app/mcp" },
		connection: "connected",
	},
	{
		name: "github",
		displayName: "GitHub",
		mark: GITHUB_MARK,
		config: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
		connection: "needsAuthorization",
	},
	{
		name: "atlas",
		config: { command: "npx", args: ["-y", "@atlas/mcp-server"] },
		connection: "failed",
	},
]

export const CATALOGUE_CATEGORIES: ApplicationCategory[] = [
	{ id: "everything", label: "Everything", count: 6 },
	{ id: "work", label: "Work tracking" },
	{ id: "code", label: "Code" },
	{ id: "design", label: "Design" },
	{ id: "data", label: "Data" },
]

export const CURATED_APPLICATIONS: CatalogueApplication[] = [
	{
		id: "linear",
		name: "Linear",
		description: "Reads and files issues, projects and cycles.",
		setup: "signIn",
		mark: LINEAR_MARK,
	},
	{
		id: "github",
		name: "GitHub",
		description: "Opens pull requests and reads repositories.",
		setup: "signIn",
		mark: GITHUB_MARK,
	},
	{
		id: "notion",
		name: "Notion",
		description: "Searches pages and writes into databases.",
		setup: "signIn",
		mark: NOTION_MARK,
	},
	{
		id: "sentry",
		name: "Sentry",
		description: "Pulls the errors and traces behind a release.",
		setup: "apiKey",
		mark: SENTRY_MARK,
	},
	{
		id: "figma",
		name: "Figma",
		description: "Reads frames, components and their tokens.",
		setup: "apiKey",
		mark: FIGMA_MARK,
	},
	{
		id: "postgres",
		name: "Postgres",
		description: "Runs read-only queries against a local database.",
		setup: "none",
		mark: POSTGRES_MARK,
	},
]

export const REGISTRY_APPLICATIONS: CatalogueApplication[] = [
	{
		id: "io.github.weatherdesk/forecast",
		name: "forecast",
		description: "Forecasts and alerts from national weather services.",
		setup: "none",
		packageIdentity: "npx -y @weatherdesk/forecast-mcp",
	},
	{
		id: "io.github.linear-community/linear-lite",
		name: "linear-lite",
		description: "A smaller Linear server that only reads issues.",
		setup: "apiKey",
		packageIdentity: "npx -y @linear-community/linear-lite",
	},
	{
		id: "io.github.kwn/linkboard",
		name: "linkboard",
		setup: "signIn",
		packageIdentity: "npx -y @kwn/linkboard-mcp",
	},
	{
		id: "io.github.saffron/notesync",
		name: "notesync",
		description: "Keeps a note file and the comments left on it.",
		setup: "none",
		packageIdentity: "npx -y @saffron/notesync-mcp",
	},
	{
		id: "io.github.stackpad/docsearch",
		name: "docsearch",
		description: "Searches the documentation a project publishes.",
		setup: "apiKey",
		packageIdentity: "npx -y @stackpad/docsearch-mcp",
	},
	{
		id: "smithery/timeclock",
		name: "timeclock",
		description: "Starts, stops and reports tracked hours.",
		setup: "none",
		source: "Smithery",
		packageIdentity: "npx -y @kwn/timeclock-mcp",
	},
	{
		id: "io.github.cartokit/atlas-maps",
		name: "atlas-maps",
		description: "Geocodes addresses and draws static maps.",
		setup: "apiKey",
		packageIdentity: "npx -y @cartokit/atlas-maps",
	},
	{
		id: "smithery/inbox-reader",
		name: "inbox-reader",
		description: "Reads and labels the mail of one account.",
		setup: "signIn",
		source: "Smithery",
		useCount: 4210,
		host: "inbox.run.tools",
		packageIdentity: "https://inbox.run.tools/mcp",
	},
	{
		id: "io.github.weatherdesk/tides",
		name: "tides",
		description: "Tide tables and coastal warnings by harbour.",
		setup: "none",
		packageIdentity: "npx -y @weatherdesk/tides-mcp",
	},
]

const SLACK_MARK = markOf("#4a154b", "S")

export const UNREACHABLE_MARK = "data:image/png;base64,Tm90QW5JbWFnZQ=="

export const REGISTRY_RESULTS: CatalogueApplication[] = [
	{
		id: "smithery/slack",
		name: "Slack",
		description: "Reads channels and posts messages as you.",
		setup: "signIn",
		mark: SLACK_MARK,
		source: "Smithery",
		useCount: 12110,
		isVerified: true,
		host: "slack.run.tools",
		packageIdentity: "https://slack.run.tools/mcp",
	},
	{
		id: "io.github.kwn/granola-transcripts",
		name: "Granola Transcripts",
		description: "Reads your meeting notes and transcripts.",
		setup: "none",
		packageIdentity: "npx -y @kwn/granola-transcripts",
		source: "MCP registry",
	},
	{
		id: "smithery/obsidian-vault",
		name: "Obsidian Vault",
		description: "Searches and edits the notes of a local vault.",
		setup: "apiKey",
		source: "Smithery",
		useCount: 806,
	},
]

export const LONG_REGISTRY_RESULT: CatalogueApplication = {
	...REGISTRY_RESULTS[0],
	name: "a-very-long-registry-application-name-that-keeps-going-on-and-on-well-past-the-width-of-the-row-it-is-drawn-in-and-then-some-more",
	description:
		"Reads every channel, every thread and every message ever written, then writes back where it is allowed to, which takes a long sentence to say.",
	host: "a-very-long-hostname-that-nobody-would-ever-type.run.tools",
}

export const GRANOLA_MARK = markOf("#1f6f43", "G")

export const SIGN_IN_INSTALL: InstallableApplication = {
	id: "granola",
	name: "Granola",
	description: "Reads your meeting notes and transcripts.",
	packageIdentity: "https://mcp.granola.ai/mcp",
	setup: "signIn",
	mark: GRANOLA_MARK,
	tools: [
		"list_meetings",
		"get_meeting",
		"get_transcript",
		"search_notes",
		"list_folders",
		"get_attendees",
	],
}

export const API_KEY_INSTALL: InstallableApplication = {
	id: "sentry",
	name: "Sentry",
	description: "Pulls the errors and traces behind a release.",
	packageIdentity: "https://mcp.sentry.dev/mcp",
	setup: "apiKey",
	mark: SENTRY_MARK,
	fields: [
		{
			name: "Authorization",
			description: "A Sentry user auth token.",
			concealed: true,
		},
	],
	tools: [
		"find_issues",
		"get_issue_details",
		"search_events",
		"find_releases",
		"get_trace",
	],
}

export const REGISTRY_INSTALL: InstallableApplication = {
	id: "io.github.kwn/tasklog",
	name: "tasklog",
	packageIdentity: "npx -y @kwn/tasklog-mcp",
	setup: "none",
	tools: [
		"list_tasks",
		"get_task",
		"create_task",
		"update_task",
		"close_task",
		"add_comment",
		"search_tasks",
	],
}

export const LOCAL_PACKAGE_INSTALL: InstallableApplication = {
	id: "io.github.DiegoBr4nd/godot-gut-mcp",
	name: "godot-gut-mcp",
	packageIdentity: "uvx godot-gut-mcp",
	setup: "apiKey",
	fields: [
		{
			name: "GODOT_PATH",
			description: "Path to the Godot executable.",
			concealed: false,
		},
		{
			name: "GODOT_PROJECT_PATH",
			description: "Path to the folder holding project.godot.",
			concealed: false,
		},
	],
	tools: ["run_tests", "list_tests", "read_report"],
}

export const MIXED_FIELDS_INSTALL: InstallableApplication = {
	...LOCAL_PACKAGE_INSTALL,
	id: "io.github.FunplayAI/funplay-godot-mcp",
	name: "funplay-godot-mcp",
	packageIdentity: "npx -y funplay-godot-mcp",
	fields: [
		{
			name: "GODOT_PATH",
			description: "Path to the Godot executable.",
			concealed: false,
		},
		{
			name: "FUNPLAY_GODOT_MCP_TOKEN",
			description: "The local auth token of the Funplay dock.",
			concealed: true,
		},
	],
}

export const HOSTED_INSTALL: InstallableApplication = {
	id: "smithery/slack",
	name: "Slack",
	description: "Reads channels and posts messages as you.",
	packageIdentity: "https://slack.run.tools/mcp",
	setup: "signIn",
	mark: SLACK_MARK,
	source: "Smithery",
	useCount: 12110,
	isVerified: true,
	host: "slack.run.tools",
	tools: [
		"list_channels",
		"read_messages",
		"post_message",
		"search_messages",
		"list_members",
	],
}

export const HOSTED_NOTHING_INSTALL: InstallableApplication = {
	...HOSTED_INSTALL,
	setup: "none",
}

export const REFUSED_APPLICATION = {
	id: "smithery/queried",
	name: "Queried",
	description: "Asks for a key its url would carry.",
	setup: "unavailable",
	source: "Smithery",
	packageIdentity: "https://queried.run.tools/mcp",
} as const satisfies CatalogueApplication

export const REFUSED_INSTALL: InstallableApplication = {
	...REFUSED_APPLICATION,
	host: "queried.run.tools",
	tools: ["search_records", "read_record"],
	refusal: {
		field: "apiKey",
		reason:
			'the required field "apiKey" names no header to carry it, and a key must never travel in a url',
	},
}

export const LONG_INSTALL: InstallableApplication = {
	...REGISTRY_INSTALL,
	name: "a-very-long-registry-application-name-that-keeps-going-on-end",
	tools: Array.from({ length: 40 }, (_, index) => `tool_number_${index + 1}`),
}

export const DRAWN_MARK =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 2 20h20L12 2Z"/></svg>'
