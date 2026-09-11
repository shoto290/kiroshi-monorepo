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
	solo: "conversation en tête-à-tête",
	unavailable: {
		title: "La recherche a échoué",
		description: "Modifiez votre recherche pour réessayer.",
	},
	rest: {
		chats: "Conversations récentes",
		missions: "Missions récentes",
		routines: "Routines",
		messages: {
			title: "Rechercher dans tous les messages",
			body: "Tapez un mot pour chercher dans tous les messages de {{space}}. Mots entiers seulement : « rout » ne trouve pas « routine ».",
		},
		none: {
			chats: "Aucune conversation ici",
			missions: "Aucune mission ici",
			routines: "Aucune routine ici",
			body: {
				chats:
					"Aucune conversation dans {{space}}. Cherchez dans tous les espaces pour en trouver une.",
				missions:
					"Aucune mission dans {{space}}. Cherchez dans tous les espaces pour en trouver une.",
				routines:
					"Aucune routine dans {{space}}. Cherchez dans tous les espaces pour en trouver une.",
			},
		},
		action: "Chercher dans tous les espaces",
	},
	empty: {
		title: "Rien ne correspond ici",
		description: "Aucun résultat pour « {{query}} » dans {{space}}.",
		action: "Rechercher dans tous les espaces",
	},
}

export { search }
