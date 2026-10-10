enum ConversationEvent: Equatable, Sendable {
    case messageStored(TranscriptMessage)
    case agent(AgentEvent)
    case companionsChanged

    init?(_ event: RelayEvent) {
        switch event.name {
        case "conversation://message-stored":
            guard let message = try? event.payload(as: TranscriptMessage.self) else { return nil }
            self = .messageStored(message)
        case "agent://event":
            guard let agent = try? event.payload(as: AgentEvent.self) else { return nil }
            self = .agent(agent)
        case "companion://created", "companion://deleted", "companion://updated":
            self = .companionsChanged
        default:
            return nil
        }
    }
}
