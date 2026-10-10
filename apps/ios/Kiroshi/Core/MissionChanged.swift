struct MissionChanged: Decodable, Equatable, Sendable {
    let missionId: String
    let state: Mission.State
    let stateSeq: Int
    let isAgentRunning: Bool
    let lastActivityAt: Int?
}

extension MissionChanged {
    static let eventName = "mission://changed"

    init?(_ event: RelayEvent) {
        guard event.name == Self.eventName, let changed = try? event.payload(as: Self.self)
        else { return nil }
        self = changed
    }
}
