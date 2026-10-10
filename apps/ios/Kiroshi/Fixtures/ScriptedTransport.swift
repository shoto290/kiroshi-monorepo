#if DEBUG
    import Foundation

    actor ScriptedTransport: HTTPTransport {
        enum Answer: Sendable {
            case status(Int, String)
            case offline
            case pending
        }

        private var answers: [String: Answer]
        private(set) var requests: [URLRequest] = []

        init(_ answers: [String: Answer] = [:]) {
            self.answers = answers
        }

        func answer(_ path: String, with answer: Answer) {
            answers[path] = answer
        }

        func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
            requests.append(request)
            guard let url = request.url else { throw URLError(.badURL) }
            switch answers[url.path(), default: .offline] {
            case .status(let status, let body):
                let response = HTTPURLResponse(
                    url: url, statusCode: status, httpVersion: nil, headerFields: nil)
                return (Data(body.utf8), response ?? URLResponse())
            case .offline:
                throw URLError(.notConnectedToInternet)
            case .pending:
                let (stream, continuation) = AsyncStream<Never>.makeStream()
                for await _ in stream {}
                continuation.finish()
                throw CancellationError()
            }
        }
    }
#endif
