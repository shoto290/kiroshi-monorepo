import type {
	HistoryChange,
	HistoryDay,
} from "@workspace/ui/components/plugin-settings/history-panel"

export const INSTRUCTIONS_PATCH = `diff --git a/AGENTS.md b/AGENTS.md
index 3c1f7a2..8b40d19 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -12,7 +12,8 @@
 You are the Nest Keeper.

-Answer with the file you would touch.
+Answer with the file you would touch, then the change.
+Search the package for a component that already does the job first.

 Every visual belongs to packages/ui.`

export const ADDED_SKILL_PATCH = `diff --git a/skills/release-notes/SKILL.md b/skills/release-notes/SKILL.md
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/skills/release-notes/SKILL.md
@@ -0,0 +1,5 @@
+---
+name: release-notes
+description: How this project words a changelog entry
+---
+One line per change, in the past tense.`

export const MODEL_PATCH = `diff --git a/bot.json b/bot.json
index 9f2ad41..6d5be07 100644
--- a/bot.json
+++ b/bot.json
@@ -1,5 +1,5 @@
 {
   "name": "Nest Keeper",
-  "model": "haiku-4-5",
+  "model": "sonnet-4-5",
   "changesNothing": false
 }`

export const WIDE_LINE_PATCH = `diff --git a/AGENTS.md b/AGENTS.md
index 8b40d19..a71c904 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,3 +1,3 @@
 You are the Nest Keeper.
-Answer with the file you would touch.
+Answer with the file you would touch, then the change it needs, then the one sentence a reader who has never opened this repository would need in order to understand why that file and not another one, written without a single abbreviation.`

export const UNREADABLE_PATCH = `The bundle was restored from a snapshot rather than from a commit, so there is no patch to read here — only the note the host wrote in its place.`

export const RETOUCHED_CHANGE: HistoryChange = {
	id: "change-5",
	author: "bot",
	sentence: "Tightened the wording of the instructions",
	detail: "Four passes over the same paragraph, kept as one change.",
	at: "2026-03-04T09:12:00Z",
	time: "09:12",
	retouchCount: 4,
}

export const UNDONE_CHANGE: HistoryChange = {
	id: "change-3",
	author: "user",
	sentence: "Raised the tool budget to twelve calls",
	at: "2026-03-03T17:04:00Z",
	time: "17:04",
	isUndone: true,
}

export const LONG_SENTENCE_CHANGE: HistoryChange = {
	id: "change-long",
	author: "bot",
	sentence:
		"Rewrote the instructions so the companion names the file it would touch, says why that file and not another one, and stops before it writes anything",
	detail:
		"The same sentence again, long enough that the second line has nowhere left to go either, and no break to hide behind.",
	at: "2026-03-04T11:30:00Z",
	time: "11:30",
}

export const HISTORY_DAYS: HistoryDay[] = [
	{
		id: "2026-03-04",
		label: "Today",
		changes: [
			{
				id: "change-6",
				author: "bot",
				sentence: "Switched the model to Claude Sonnet 4.5",
				detail: "The runs were being cut short on the smaller model.",
				at: "2026-03-04T09:42:00Z",
				time: "09:42",
			},
			RETOUCHED_CHANGE,
			{
				id: "change-4",
				author: "user",
				sentence: "Added the release-notes skill",
				at: "2026-03-04T08:15:00Z",
				time: "08:15",
			},
		],
	},
	{
		id: "2026-03-03",
		label: "Yesterday",
		changes: [
			UNDONE_CHANGE,
			{
				id: "change-2",
				author: "user",
				sentence: "Rewrote the instructions",
				detail: "The companion names the file it would touch before it moves.",
				at: "2026-03-03T10:21:00Z",
				time: "10:21",
			},
		],
	},
	{
		id: "2026-02-19",
		label: "19 February",
		changes: [
			{
				id: "change-1",
				author: "bot",
				sentence: "Created the bundle",
				at: "2026-02-19T14:08:00Z",
				time: "14:08",
			},
		],
	},
]

export const HISTORY_OLDEST_DATE = "19 February 2026"

export const LONG_SENTENCE_DAYS: HistoryDay[] = [
	{
		id: "2026-03-04",
		label: "Today",
		changes: [LONG_SENTENCE_CHANGE],
	},
]

export const LONG_SIGNALLED_DAYS: HistoryDay[] = [
	{
		id: "2026-03-04",
		label: "Today",
		changes: [
			{
				...LONG_SENTENCE_CHANGE,
				id: "change-long-signalled",
				retouchCount: 4,
				isUndone: true,
			},
		],
	},
]
