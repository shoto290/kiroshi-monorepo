import type { UserPreferences as GeneratedUserPreferences } from "@/lib/bindings"

export type { ColorScheme, UserPreferencesError } from "@/lib/bindings"

export type BotIdBySpace = Record<string, string>

type AlwaysSerialized =
	| "activityPanelOpen"
	| "firstRunDone"
	| "lastBotIdBySpace"

export type UserPreferences = GeneratedUserPreferences &
	Required<Pick<GeneratedUserPreferences, AlwaysSerialized>>
