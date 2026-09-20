export type {
	ApplicationMark_Serialize as McpServerMark,
	AvatarAnimal,
	AvatarBlot,
	Bot,
	BotChangedFile,
	BotDraft,
	BotHistoryEntry,
	BotIdentity,
	Chat,
	ContextCheckpoint,
	Conversation,
	EnvEntry_Serialize as EnvEntry,
	EnvOwner,
	EnvScope_Serialize as EnvScope,
	HistoryAuthor as BotHistoryAuthor,
	HistoryFileChange as BotFileChange,
	Json as BotSkillValue,
	McpServer_Serialize as BotMcpServer,
	MessageReference,
	NewAssistantMessage,
	NewTurn,
	NewUserMessage,
	Participant,
	ParticipantRole,
	PinnedBubble as MessagePin,
	PluginScope,
	RosterPin,
	RuntimeSession,
	Section,
	SectionError,
	Skill as BotSkill,
	SkillDraft as BotSkillDraft,
	SkillFront as BotSkillFront,
	Space,
	SpaceError,
	SpacePreferences,
	SuggestedBot,
	TranscriptStoreError,
} from "@/lib/bindings"

export type BotModel = string

export type ConversationDraft = {
	spaceId: string
	sectionId: string | null
	title: string
	botIds: string[]
}

export type ConversationEdit = {
	title: string
	instructions: string
	sectionId: string | null
}
