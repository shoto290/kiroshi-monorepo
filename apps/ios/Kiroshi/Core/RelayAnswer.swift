import Foundation

struct RelayAnswer: Sendable {
    let status: Int
    let frame: Data

    func body<Body: Decodable>(as type: Body.Type) throws -> Body {
        try JSONDecoder().decode(Envelope<Body>.self, from: frame).body
    }

    private struct Envelope<Body: Decodable>: Decodable {
        let body: Body
    }
}
