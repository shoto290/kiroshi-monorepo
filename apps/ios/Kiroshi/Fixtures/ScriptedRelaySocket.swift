#if DEBUG
    import Foundation

    final class ScriptedRelaySocket: RelaySocket {
        enum Inbound: Sendable {
            case frame(String)
            case close(Int)
        }

        let sent: AsyncStream<String>
        private let sentContinuation: AsyncStream<String>.Continuation
        private let inbound: AsyncStream<Inbound>
        private let inboundContinuation: AsyncStream<Inbound>.Continuation
        private let sharedSpaceId: String?
        private let answersPings: Bool

        init(sharedSpaceId: String? = nil, answersPings: Bool = true) {
            (sent, sentContinuation) = AsyncStream.makeStream()
            (inbound, inboundContinuation) = AsyncStream.makeStream()
            self.sharedSpaceId = sharedSpaceId
            self.answersPings = answersPings
        }

        func push(_ message: Inbound) {
            inboundContinuation.yield(message)
        }

        func send(_ text: String) async throws {
            sentContinuation.yield(text)
            guard let sharedSpaceId,
                let call = try? JSONDecoder().decode(Call.self, from: Data(text.utf8)),
                call.command == "relay_shared_space"
            else { return }
            push(.frame(#"{"id":\#(call.id),"status":200,"body":{"spaceId":"\#(sharedSpaceId)"}}"#))
        }

        func receive() async throws -> String {
            var iterator = inbound.makeAsyncIterator()
            switch await iterator.next() {
            case .frame(let text): return text
            case .close(let code): throw RelayClosure(code: code)
            case nil: throw CancellationError()
            }
        }

        func ping() async throws {
            guard answersPings else { throw RelayClosure(code: 0) }
        }

        func close() {
            push(.close(1000))
        }

        private struct Call: Decodable {
            let id: Int
            let command: String
        }
    }
#endif
