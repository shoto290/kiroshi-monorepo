import {
	BLANK_BOT_PERMISSIONS,
	DEFAULT_BOT_OUTPUT_STYLE,
} from "@workspace/ui/components/bot-settings"

import type { OnboardingWorld } from "./onboarding-controller"

import type {
	Bot,
	BotDraft,
	SuggestedBot,
} from "../conversations/store-contract"

export type OnboardingGreeting = {
	botId: string
	text: string
}

export type OnboardingRefusals = {
	suggest?: unknown
	create?: unknown
	greet?: unknown
}

export type FakeOnboardingWorld = OnboardingWorld & {
	homeBot: string | null
	suggestions: SuggestedBot[]
	refusals: OnboardingRefusals
	sent: string[]
	drafted: BotDraft[]
	greetings: OnboardingGreeting[]
	opened: string[]
	firstRunDone: number
}

export const SUGGESTED_WRITER: SuggestedBot = {
	id: "writer",
	name: "Quill",
	job: "a writing partner",
	description: "Draft, tighten and polish what the reader writes.",
	blurb: "Drafts and edits with you.",
}

export const SUGGESTED_SCOUT: SuggestedBot = {
	id: "researcher",
	name: "Scout",
	job: "a research assistant",
	description: "Dig into the questions the reader brings.",
	blurb: "Finds sources and sums them up.",
}

const HOME_BOT = "bot-home"

const botFrom = (draft: BotDraft): Bot => ({
	id: `bot-${draft.name.toLowerCase()}`,
	name: draft.name,
	title: draft.job,
	model: "sonnet",
	avatarAnimal: "owl",
	avatarBlot: "cyan",
	avatarImagePath: null,
	workingDir: null,
	instructions: draft.description,
	deniedTools: [],
	permissions: BLANK_BOT_PERMISSIONS,
	outputStyle: DEFAULT_BOT_OUTPUT_STYLE,
	createdAt: 0,
	changesNothing: false,
	memory: "",
	sectionId: null,
	pinPosition: null,
})

const refuseWith = (refusal: unknown) => {
	if (refusal !== undefined) {
		throw refusal
	}
}

export const createFakeOnboardingWorld = (): FakeOnboardingWorld => {
	const fake: FakeOnboardingWorld = {
		homeBot: HOME_BOT,
		suggestions: [SUGGESTED_WRITER, SUGGESTED_SCOUT],
		refusals: {},
		sent: [],
		drafted: [],
		greetings: [],
		opened: [],
		firstRunDone: 0,

		homeBotId: () => fake.homeBot,

		send: async (text) => {
			fake.sent.push(text)
		},

		suggest: async () => {
			refuseWith(fake.refusals.suggest)
			return fake.suggestions
		},

		create: async (draft) => {
			refuseWith(fake.refusals.create)
			fake.drafted.push(draft)
			return botFrom(draft)
		},

		greet: async (botId, text) => {
			refuseWith(fake.refusals.greet)
			fake.greetings.push({ botId, text })
		},

		open: (botId) => {
			fake.opened.push(botId)
		},

		markFirstRunDone: async () => {
			fake.firstRunDone += 1
		},
	}

	return fake
}
