@testable import Kiroshi

final class TestRelayClock: RelayClock {
    struct Sleep: Sendable {
        let duration: Duration
        let wake: AsyncStream<Void>.Continuation
    }

    let sleeps: AsyncStream<Sleep>
    private let sleepsContinuation: AsyncStream<Sleep>.Continuation

    init() {
        (sleeps, sleepsContinuation) = AsyncStream.makeStream()
    }

    func sleep(for duration: Duration) async throws {
        let (wake, wakeContinuation) = AsyncStream<Void>.makeStream()
        try await withTaskCancellationHandler {
            sleepsContinuation.yield(Sleep(duration: duration, wake: wakeContinuation))
            for await _ in wake {
                return
            }
            throw CancellationError()
        } onCancel: {
            wakeContinuation.finish()
        }
    }

    func nextSleep(of duration: Duration) async -> Sleep? {
        var iterator = sleeps.makeAsyncIterator()
        while let sleep = await iterator.next() {
            if sleep.duration == duration {
                return sleep
            }
        }
        return nil
    }

    func wakeNextSleep(of duration: Duration) async {
        while let sleep = await nextSleep(of: duration) {
            if case .enqueued = sleep.wake.yield() {
                return
            }
        }
    }
}
