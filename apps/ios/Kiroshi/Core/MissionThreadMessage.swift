struct MissionThreadMessage: Decodable, Identifiable, Equatable, Sendable {
    enum Role: String, Decodable, Sendable {
        case user
        case assistant
    }

    let id: String
    let conversationId: String
    let seq: Int
    let role: Role
    let content: String
    let createdAt: Int
    let authorBotId: String?
}
