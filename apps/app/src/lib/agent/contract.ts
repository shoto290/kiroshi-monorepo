import type {
	AgentCommand_Serialize,
	ConnectionState,
	TransportError as HostTransportError,
	Json,
	PermissionDecision,
	RuntimeScope,
} from "@/lib/bindings"

export type {
	Account,
	AgentCommand_Serialize as AgentCommand,
	CheckReport_Serialize as CheckReport,
	ConnectionState,
	LiveSession,
	PermissionDecision,
	RuntimeScope,
	SessionHandle,
	SignInError,
} from "@/lib/bindings"

export type FrontTransportError =
	| { kind: "readFailed"; detail: string }
	| { kind: "unknownFailure"; detail: string }

export type TransportError = HostTransportError | FrontTransportError

export type TurnState =
	| "idle"
	| "submitting"
	| "running"
	| "stopping"
	| "failed"

export type MessageRole = "user" | "assistant"

export type MessageCompletion =
	| "streaming"
	| "complete"
	| "cancelled"
	| "failed"

export type ChatMessage = {
	id: string
	role: MessageRole
	text: string
	completion: MessageCompletion
	timestamp: number
}

export type ActivityKind = "tool" | "permission"

export type ActivityStatus = "pending" | "running" | "succeeded" | "failed"

export type ActivityEvent = {
	id: string
	title: string
	kind: ActivityKind
	status: ActivityStatus
}

export type PermissionRequest = {
	id: string
	toolName: string
	title: string
	detail: string | null
}

export type QuestionOption = {
	label: string
	description: string | null
	preview: string | null
}

export type AskedQuestion = {
	header: string
	question: string
	options: QuestionOption[]
	multiSelect: boolean
}

export type QuestionSubject = {
	kind: "applicationScope"
	application: string
}

export type QuestionRequest = {
	id: string
	questions: AskedQuestion[]
	subject?: QuestionSubject
}

export type QuestionAnswers = Record<string, string>

export type TurnOutcome = "completed" | "cancelled" | "failed"

export type TurnEnded = {
	sessionId: string | null
	outcome: TurnOutcome
	structuredOutput?: Json
	totalCostUsd?: number
	modelUsage?: Json
}

export type ScopedEvent = {
	scope: RuntimeScope | null
	event: AgentEvent
}

export type EvolvedBundle = "bot" | "user" | "space"

export type AgentEvent =
	| { type: "connectionChanged"; state: ConnectionState }
	| { type: "turnChanged"; state: TurnState }
	| { type: "sessionReady"; sessionId: string; resumed: boolean }
	| { type: "commandsListed"; commands: AgentCommand_Serialize[] }
	| { type: "messageStarted"; message: ChatMessage }
	| { type: "messageDelta"; id: string; seq: number; text: string }
	| { type: "messageCompleted"; message: ChatMessage }
	| { type: "activity"; activity: ActivityEvent }
	| { type: "permissionRequested"; request: PermissionRequest }
	| { type: "questionRequested"; request: QuestionRequest }
	| { type: "permissionResolved"; id: string; decision: PermissionDecision }
	| { type: "turnEnded"; ended: TurnEnded }
	| {
			type: "botEvolved"
			bundle: EvolvedBundle
			commitId: string
			title: string
	  }
	| { type: "failed"; error: TransportError }
