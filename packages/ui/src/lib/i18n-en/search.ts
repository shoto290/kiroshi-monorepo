const search = {
	open: "Search",
	chord: "⌘K",
	placeholder: "Search messages, chats, missions and routines",
	results: "Results",
	tab: {
		all: "All",
		messages: "Messages",
		chats: "Chats",
		missions: "Missions",
		routines: "Routines",
	},
	scope: "All spaces",
	seeAll: "See all",
	solo: "solo thread",
	unavailable: {
		title: "Search could not be read",
		description:
			"Nothing was lost. The last results stay on screen until the next read.",
	},
	rest: {
		chats: "Recent chats",
		missions: "Recent missions",
		routines: "Routines",
		messages: {
			title: "Search every message",
			body: "Type a word and every message in {{space}} is read. Messages match whole words, so “rout” will not find “routine”.",
		},
		none: {
			chats: "No chat here yet",
			missions: "No mission here yet",
			routines: "No routine here yet",
			body: {
				chats:
					"Nothing has been opened in {{space}}. A chat in another space is one switch away.",
				missions:
					"No mission has been opened in {{space}}. A mission in another space is one switch away.",
				routines:
					"Nothing runs on its own in {{space}}. A routine set in another space is one switch away.",
			},
		},
		action: "Look in all spaces",
	},
	empty: {
		title: "Nothing here matches",
		description:
			"No message, chat, mission or routine in {{space}} answers to “{{query}}”.",
		action: "Search all spaces",
	},
}

export { search }
