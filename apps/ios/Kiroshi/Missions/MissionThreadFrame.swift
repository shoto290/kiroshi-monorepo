enum MissionThreadFrame: Equatable, Sendable {
    case stored(MissionThreadMessage)
    case reread

    static let closingAgentEvents: Set<String> = ["messageCompleted", "turnEnded"]

    init?(_ event: RelayEvent, conversationId: String) {
        switch event.name {
        case "conversation://message-stored":
            guard let message = try? event.payload(as: MissionThreadMessage.self),
                message.conversationId == conversationId
            else { return nil }
            self = .stored(message)
        case "conversation://companion-spoke":
            guard (try? event.payload(as: InConversation.self))?.conversationId == conversationId
            else { return nil }
            self = .reread
        case "agent://event":
            guard let scoped = try? event.payload(as: ScopedAgentEvent.self),
                scoped.scope?.conversationId == conversationId,
                Self.closingAgentEvents.contains(scoped.event.type)
            else { return nil }
            self = .reread
        default:
            return nil
        }
    }
}

private struct InConversation: Decodable {
    let conversationId: String
}

private struct ScopedAgentEvent: Decodable {
    struct Kind: Decodable {
        let type: String
    }

    let scope: InConversation?
    let event: Kind
}
