struct RelayEnvironment: Sendable {
    static let live = RelayEnvironment(
        transport: URLSessionRelayTransport(), clock: ContinuousRelayClock())

    let transport: any RelayTransport
    let clock: any RelayClock
}
