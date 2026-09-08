const search = {
	open: "Rechercher",
	chord: "⌘K",
	placeholder: "Rechercher messages, conversations, missions et routines",
	results: "Résultats",
	tab: {
		all: "Tout",
		messages: "Messages",
		chats: "Conversations",
		missions: "Missions",
		routines: "Routines",
	},
	scope: "Tous les espaces",
	seeAll: "Tout voir",
	close: "Échap",
	rank: "⌘{{rank}}",
	solo: "fil en tête-à-tête",
	hint: {
		move: "Naviguer",
		open: "Ouvrir",
		rank: "Ouvrir par rang",
		tab: "Changer d'onglet",
	},
	unavailable: {
		title: "La recherche n'a pas pu être lue",
		description:
			"Rien n'est perdu. Les derniers résultats restent à l'écran jusqu'à la prochaine lecture.",
	},
	rest: {
		chats: "Conversations récentes",
		missions: "Missions récentes",
		routines: "Routines",
		messages: {
			title: "Rechercher dans tous les messages",
			body: "Tapez un mot et tous les messages de {{space}} sont lus. Les messages se comparent par mots entiers : « rout » ne trouvera pas « routine ».",
		},
		none: {
			chats: "Aucune conversation ici",
			missions: "Aucune mission ici",
			routines: "Aucune routine ici",
			body: {
				chats:
					"Rien n'a été ouvert dans {{space}}. Élargissez à tous les espaces pour retrouver une conversation ailleurs.",
				missions:
					"Aucune mission n'a été ouverte dans {{space}}. Élargissez à tous les espaces pour retrouver une mission ailleurs.",
				routines:
					"Rien ne tourne tout seul dans {{space}}. Élargissez à tous les espaces pour retrouver une routine ailleurs.",
			},
		},
		action: "Chercher dans tous les espaces",
	},
	empty: {
		title: "Rien ne correspond ici",
		description:
			"Aucun message, conversation, mission ou routine dans {{space}} ne répond à « {{query}} ».",
		action: "Rechercher dans tous les espaces",
	},
}

export { search }
