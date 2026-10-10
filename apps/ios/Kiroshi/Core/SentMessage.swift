struct SentMessage: Encodable, Equatable, Sendable {
    enum CodingKeys: String, CodingKey {
        case id
        case conversationId
        case turnId
        case content
        case createdAt
        case repliedToMessageId
    }

    let id: String
    let conversationId: String
    let turnId: String
    let content: String
    let createdAt: Int
    let repliedToMessageId: String?

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(conversationId, forKey: .conversationId)
        try container.encode(turnId, forKey: .turnId)
        try container.encode(content, forKey: .content)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(repliedToMessageId, forKey: .repliedToMessageId)
    }
}
