struct Mission: Decodable, Identifiable, Hashable, Sendable {
    enum State: String, Decodable, Sendable {
        case working
        case waitingBot = "waiting_bot"
        case waitingHuman = "waiting_human"
        case readyToMerge = "ready_to_merge"
        case failed
        case done
        case closed
    }

    struct Ticket: Decodable, Hashable, Sendable {
        let externalId: String
    }

    struct Status: Decodable, Hashable, Sendable {
        let text: String
        let writtenAt: Int
    }

    let id: String
    let botId: String
    let threadConversationId: String
    let objective: String
    let ticket: Ticket
    var state: State
    var stateSeq: Int
    var isAgentRunning: Bool
    let openedAt: Int
    let closedAt: Int?
    var lastActivityAt: Int?
    let status: Status?
}
