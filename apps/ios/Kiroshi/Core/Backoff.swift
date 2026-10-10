struct Backoff: Sendable {
    static let first = Duration.seconds(1)
    static let cap = Duration.seconds(60)

    static let randomJitter: @Sendable (Duration) -> Duration = { delay in
        delay * Double.random(in: 0.5...1)
    }

    private let jitter: @Sendable (Duration) -> Duration
    private var attempt = 0

    init(jitter: @escaping @Sendable (Duration) -> Duration = Backoff.randomJitter) {
        self.jitter = jitter
    }

    mutating func next() -> Duration {
        let delay = min(Self.first * (1 << min(attempt, 6)), Self.cap)
        attempt += 1
        return jitter(delay)
    }

    mutating func reset() {
        attempt = 0
    }
}
