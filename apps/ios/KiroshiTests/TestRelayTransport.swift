import Foundation

@testable import Kiroshi

final class TestRelayTransport: RelayTransport {
    struct Opening: Sendable {
        let request: URLRequest
        let reply: AsyncStream<Result<any RelaySocket, any Error>>.Continuation

        func accept(_ socket: any RelaySocket) {
            reply.yield(.success(socket))
        }

        func refuse(_ status: Int) {
            reply.yield(.failure(RelayRefusal(status: status)))
        }

        func close(_ code: Int) {
            reply.yield(.failure(RelayClosure(code: code)))
        }
    }

    let openings: AsyncStream<Opening>
    private let openingsContinuation: AsyncStream<Opening>.Continuation

    init() {
        (openings, openingsContinuation) = AsyncStream.makeStream()
    }

    func open(_ request: URLRequest) async throws -> any RelaySocket {
        let (reply, continuation) = AsyncStream<Result<any RelaySocket, any Error>>.makeStream()
        openingsContinuation.yield(Opening(request: request, reply: continuation))
        var iterator = reply.makeAsyncIterator()
        guard let result = await iterator.next() else { throw CancellationError() }
        return try result.get()
    }

    func nextOpening() async -> Opening {
        var iterator = openings.makeAsyncIterator()
        guard let opening = await iterator.next() else {
            preconditionFailure("The relay transport stopped opening")
        }
        return opening
    }
}
