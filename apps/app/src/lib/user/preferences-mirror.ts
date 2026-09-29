import {
	activateLanguage,
	DEFAULT_LANGUAGE,
	type Language,
	languageOf,
} from "@workspace/ui/lib/i18n"

import type {
	BotIdBySpace,
	ColorScheme,
	UserPreferences,
} from "./preferences-contract"

const COLOR_SCHEME_KEY = "theme"
const LANGUAGE_KEY = "language"
const ACTIVITY_PANEL_OPEN_KEY = "activityPanelOpen"
const FIRST_RUN_DONE_KEY = "firstRunDone"
const LAST_SPACE_KEY = "lastSpaceId"
const LAST_BOT_BY_SPACE_KEY = "lastBotIdBySpace"
const DROPPED_LAST_BOT_KEY = "lastBotId"

const COLOR_SCHEMES: ColorScheme[] = ["system", "light", "dark"]

const DEFAULT_COLOR_SCHEME: ColorScheme = "system"

const SWITCH_ON = "on"
const SWITCH_OFF = "off"

export type MirroredPreferences = {
	colorScheme: ColorScheme
	language: Language | null
	activityPanelOpen: boolean
	firstRunDone: boolean
	lastSpaceId: string | null
	lastBotIdBySpace: BotIdBySpace
}

const colorSchemeOf = (value: string | null): ColorScheme =>
	COLOR_SCHEMES.find((scheme) => scheme === value) ?? DEFAULT_COLOR_SCHEME

const isBotIdBySpace = (value: unknown): value is BotIdBySpace =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every((botId) => typeof botId === "string")

const botIdBySpaceOf = (value: unknown): BotIdBySpace =>
	isBotIdBySpace(value) ? value : {}

const parseBotIdBySpace = (value: string | null): BotIdBySpace => {
	try {
		return botIdBySpaceOf(JSON.parse(value ?? ""))
	} catch {
		return {}
	}
}

const sameBotIdBySpace = (one: BotIdBySpace, other: BotIdBySpace) => {
	const spaceIds = Object.keys(one)
	return (
		spaceIds.length === Object.keys(other).length &&
		spaceIds.every((spaceId) => one[spaceId] === other[spaceId])
	)
}

export const lastBotIn = (
	mirrored: MirroredPreferences,
	spaceId: string | null,
) => (spaceId === null ? null : (mirrored.lastBotIdBySpace[spaceId] ?? null))

export const activeLanguageOf = (chosen: string | null): Language =>
	languageOf(chosen) ?? languageOf(navigator.language) ?? DEFAULT_LANGUAGE

export const applyLanguage = (chosen: Language | null) => {
	activateLanguage(activeLanguageOf(chosen))
}

export const mirrorOf = (record: UserPreferences): MirroredPreferences => ({
	colorScheme: colorSchemeOf(record.colorScheme),
	language: languageOf(record.language),
	activityPanelOpen: record.activityPanelOpen === true,
	firstRunDone: record.firstRunDone === true,
	lastSpaceId: record.lastSpaceId ?? null,
	lastBotIdBySpace: botIdBySpaceOf(record.lastBotIdBySpace),
})

export const sameMirror = (
	one: MirroredPreferences,
	other: MirroredPreferences,
) =>
	one.colorScheme === other.colorScheme &&
	one.language === other.language &&
	one.activityPanelOpen === other.activityPanelOpen &&
	one.firstRunDone === other.firstRunDone &&
	one.lastSpaceId === other.lastSpaceId &&
	sameBotIdBySpace(one.lastBotIdBySpace, other.lastBotIdBySpace)

export const readMirror = (): MirroredPreferences => ({
	colorScheme: colorSchemeOf(localStorage.getItem(COLOR_SCHEME_KEY)),
	language: languageOf(localStorage.getItem(LANGUAGE_KEY)),
	activityPanelOpen:
		localStorage.getItem(ACTIVITY_PANEL_OPEN_KEY) === SWITCH_ON,
	firstRunDone: localStorage.getItem(FIRST_RUN_DONE_KEY) === SWITCH_ON,
	lastSpaceId: localStorage.getItem(LAST_SPACE_KEY),
	lastBotIdBySpace: parseBotIdBySpace(
		localStorage.getItem(LAST_BOT_BY_SPACE_KEY),
	),
})

const keep = (key: string, value: string | null) => {
	if (value === null) {
		localStorage.removeItem(key)
		return
	}

	localStorage.setItem(key, String(value))
}

export const writeMirror = (mirrored: MirroredPreferences) => {
	localStorage.setItem(COLOR_SCHEME_KEY, mirrored.colorScheme)
	keep(LANGUAGE_KEY, mirrored.language)
	localStorage.setItem(
		ACTIVITY_PANEL_OPEN_KEY,
		mirrored.activityPanelOpen ? SWITCH_ON : SWITCH_OFF,
	)
	localStorage.setItem(
		FIRST_RUN_DONE_KEY,
		mirrored.firstRunDone ? SWITCH_ON : SWITCH_OFF,
	)
	keep(LAST_SPACE_KEY, mirrored.lastSpaceId)
	keep(LAST_BOT_BY_SPACE_KEY, JSON.stringify(mirrored.lastBotIdBySpace))
	localStorage.removeItem(DROPPED_LAST_BOT_KEY)
}

const MIRROR_KEYS = [
	COLOR_SCHEME_KEY,
	LANGUAGE_KEY,
	ACTIVITY_PANEL_OPEN_KEY,
	FIRST_RUN_DONE_KEY,
	LAST_SPACE_KEY,
	LAST_BOT_BY_SPACE_KEY,
]

export const isMirrorKey = (key: string | null) =>
	MIRROR_KEYS.some((mirrored) => mirrored === key)
