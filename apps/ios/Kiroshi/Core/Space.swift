struct Space: Decodable, Identifiable, Equatable, Sendable {
    enum Role: String, Decodable, Sendable {
        case owner
        case member
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case role
        case isHostOnline = "online"
    }

    let id: String
    let name: String
    let role: Role
    var isHostOnline: Bool
}
