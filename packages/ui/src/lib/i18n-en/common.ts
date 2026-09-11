const common = {
	boot: {
		status: "Starting Kiroshi",
	},
	spaces: {
		unavailable: {
			title: "Spaces could not be read",
			description:
				"Your companions are safe on the record. Try again to open your spaces.",
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
			clicks: "Clicking a notification will no longer open its conversation",
			focus: "Notifications may now appear while the app is in front",
			reveal: "The window could not be brought to the front",
			send: "A notification could not be shown",
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
			botsBusy_one:
				"{{count}} companion is still running. Stop them to restart.",
			botsBusy_other:
				"{{count}} companions are still running. Stop them to restart.",
			restart: "Restart now",
			postpone: "Later",
			releaseNotes: "Read the full release notes in your browser",
		},
	},
} as const

export { common }
