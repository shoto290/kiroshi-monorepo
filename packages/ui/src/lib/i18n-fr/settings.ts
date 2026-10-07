const settings = {
	breadcrumb: {
		title: "Réglages",
	},
	rail: {
		profile: "Profil",
		account: "Compte",
		space: "Espace",
		secrets: "Secrets",
		appearance: "Apparence",
		notifications: "Notifications",
		language: "Langue",
		skills: "Compétences",
		applications: "Applications",
		history: "Historique",
		danger: "Zone sensible",
	},
	account: {
		signedOut: {
			title: "Se connecter à Kiroshi",
			body: "Hébergez un espace pour des personnes hors de votre réseau, ou rejoignez celui qu’on héberge pour vous. Kiroshi ouvre votre navigateur pour vous connecter.",
			signIn: "Se connecter",
		},
		waiting: {
			label: "En attente de votre navigateur…",
			cancel: "Annuler",
			caption:
				"Terminez la connexion dans votre navigateur. Kiroshi prend le relais ensuite.",
		},
		signedIn: {
			title: "Connecté",
			body: "Vous pouvez héberger des espaces pour des personnes hors de votre réseau, et rejoindre ceux qu’elles hébergent pour vous.",
			name: "Nom",
			email: "E-mail",
			signOut: "Se déconnecter",
			caption:
				"Les espaces que vous hébergez ou avez rejoints via Kiroshi cessent de fonctionner ici jusqu’à votre prochaine connexion.",
		},
		unreachable: {
			title: "Impossible de joindre Kiroshi",
			description: "Vérifiez votre connexion et reconnectez-vous.",
		},
	},
	plugin: {
		author: {
			bot: "Un compagnon",
		},
	},
	profile: {
		name: {
			label: "Nom affiché",
			placeholder: "Sans nom",
		},
		picture: {
			file: "Fichier de photo de profil",
			add: "Ajouter une photo",
			change: "Changer la photo",
			remove: "Retirer la photo",
		},
	},
	notifications: {
		label: "Me prévenir quand",
		event: {
			question: {
				label: "Un compagnon pose une question",
				description: "Il attend votre réponse pour continuer.",
			},
			permission: {
				label: "Un compagnon demande une autorisation",
				description:
					"Il attend votre autorisation pour lancer une commande ou modifier un fichier.",
			},
			turn: {
				label: "Un compagnon termine son tour",
				description: "Il a fini et attend votre prochain message.",
			},
		},
		sound: {
			label: "Son",
			switch: "Jouer un son",
			description:
				"Kiroshi joue un bref carillon à chaque notification, même quand votre système l’affiche en silence.",
		},
	},
	language: {
		label: "Langue",
		machine: "Système",
	},
	appearance: {
		scheme: {
			label: "Thème",
			option: {
				light: "Clair",
				dark: "Sombre",
				system: "Système",
			},
		},
	},
	space: {
		untitled: "Espace sans nom",
		name: {
			label: "Nom",
			placeholder: "Sans nom",
		},
		host: {
			label: "Hôte",
			hint: "Cet espace vit sur un autre Kiroshi. Son nom se règle là-bas.",
		},
		colour: {
			label: "Couleur",
			none: "Aucune couleur",
		},
		share: {
			label: "Lien de partage",
			copy: "Copier le lien de partage",
			copied: "Lien de partage copié",
			hint: "Collez-le dans Rejoindre un espace sur un autre Kiroshi.",
			warning:
				"Toute personne disposant de ce lien obtient cet espace, ses compagnons et ses conversations.",
			hostDown:
				"L’hôte ne tourne pas, il n’y a donc pas encore de lien. Redémarrez Kiroshi pour le lancer.",
		},
		transfer: {
			export: "Exporter cet espace",
			import: "Importer un espace",
			exported: "{{name}} exporté",
			imported: "{{name}} importé",
			exportFailed: "Impossible d’exporter {{name}}",
			importFailed: "Impossible d’importer l’espace",
			retry: "Réessayer",
			reason: {
				unsupportedArchive:
					"Cette archive est au format version {{found}}, cette app lit la version {{supported}}.",
				unversionedArchive:
					"Cette archive ne porte aucune version de format, cette app lit la version {{supported}}.",
				unreadableArchive: "L’archive n’a pas pu être lue.",
				unwritableArchive: "L’archive n’a pas pu être écrite.",
				generic: "Une erreur est survenue, rien n’a été modifié.",
			},
		},
		danger: {
			delete: "Supprimer l’espace",
			description:
				"Les compagnons présents uniquement dans cet espace sont supprimés avec lui. C’est irréversible.",
			last: "Vous ne pouvez pas supprimer votre dernier espace.",
			confirm: {
				title: "Supprimer {{name}} ?",
			},
		},
	},
} as const

export { settings }
