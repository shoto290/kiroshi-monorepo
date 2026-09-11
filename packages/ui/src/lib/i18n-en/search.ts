const search = {
	open: "Search",
	chord: "⌘K",
	placeholder: "Search messages, conversations, missions and routines",
	results: "Results",
	tab: {
		all: "All",
		messages: "Messages",
		chats: "Conversations",
		missions: "Missions",
		routines: "Routines",
	},
	scope: "All spaces",
	seeAll: "See all",
	solo: "solo conversation",
	unavailable: {
		title: "Search failed",
		description: "Edit your search to retry.",
	},
	rest: {
		chats: "Recent conversations",
		missions: "Recent missions",
		routines: "Routines",
		messages: {
			title: "Search every message",
			body: "Type a word to search every message in {{space}}. Whole words only: “rout” won't find “routine”.",
		},
		none: {
			chats: "No conversation here yet",
			missions: "No mission here yet",
			routines: "No routine here yet",
			body: {
				chats:
					"No conversations in {{space}} yet. Look in all spaces to find one.",
				missions:
					"No missions in {{space}} yet. Look in all spaces to find one.",
				routines:
					"No routines in {{space}} yet. Look in all spaces to find one.",
			},
		},
		action: "Look in all spaces",
	},
	empty: {
		title: "Nothing here matches",
		description: "No results for “{{query}}” in {{space}}.",
		action: "Search all spaces",
	},
}

export { search }
