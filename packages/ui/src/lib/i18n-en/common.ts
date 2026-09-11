const common = {
	boot: {
		status: "Starting Kiroshi",
	},
	spaces: {
		unavailable: {
			title: "Couldn't load your spaces",
			description: "Your companions are still there.",
		},
	},
	dialog: {
		close: "Close",
		retry: "Try again",
	},
	confirm: {
		cancel: "Cancel",
	},
	sidebar: {
		label: "Sidebar",
		toggle: "Toggle sidebar",
		close: "Close sidebar",
		resize: "Resize sidebar",
	},
	notice: {
		label: "Notices",
		close: "Close notice",
	},
	notification: {
		question: "Asked you a question",
		approval: "Wants your approval",
		finishedTurn: "Finished its turn",
		mission: {
			question: "Asked you a question on {{ticket}}",
			waiting_human: "Needs you on {{ticket}}",
			ready_to_merge: "{{ticket}} is ready to merge",
		},
		failure: {
			clicks:
				"Notifications won't open their conversation. Restart Kiroshi to fix it.",
			focus:
				"Notifications may show while you're in Kiroshi. Restart Kiroshi to fix it.",
			reveal: "Couldn't bring Kiroshi to the front. Switch to it yourself.",
			send: "Couldn't show a notification. Check Kiroshi's notification permission.",
		},
	},
	update: {
		badge: {
			available: "Download update",
			downloading: "Downloading update",
			ready: "Restart to update",
			error: "Update failed, download again",
		},
		panel: {
			title: "Update ready",
			version: "Version {{version}}",
			botsBusy_one: "{{count}} companion is still running. Stop it to restart.",
			botsBusy_other:
				"{{count}} companions are still running. Stop them to restart.",
			restart: "Restart now",
			postpone: "Later",
			releaseNotes: "Read the full release notes in your browser",
		},
	},
} as const

export { common }
