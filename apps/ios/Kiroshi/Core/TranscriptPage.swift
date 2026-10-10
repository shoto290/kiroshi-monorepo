struct TranscriptPage: Decodable, Sendable {
    let conversationId: String
    let messages: [TranscriptMessage]
}
