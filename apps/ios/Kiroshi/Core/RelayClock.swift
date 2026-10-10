protocol RelayClock: Sendable {
    func sleep(for duration: Duration) async throws
}

struct ContinuousRelayClock: RelayClock {
    func sleep(for duration: Duration) async throws {
        try await ContinuousClock().sleep(for: duration)
    }
}
