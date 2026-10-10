import Foundation

struct RelayEvent: Sendable {
    let name: String
    let frame: Data

    func payload<Payload: Decodable>(as type: Payload.Type) throws -> Payload {
        try JSONDecoder().decode(Envelope<Payload>.self, from: frame).event.payload
    }

    private struct Envelope<Payload: Decodable>: Decodable {
        struct Event: Decodable {
            let payload: Payload
        }

        let event: Event
    }
}
