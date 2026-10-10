struct MissionThreadPage: Decodable, Equatable, Sendable {
    let messages: [MissionThreadMessage]
    let hasMore: Bool
}
