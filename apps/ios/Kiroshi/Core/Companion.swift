struct Companion: Decodable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let tint: CompanionTint?
    let picturePath: String?

    init(id: String, name: String, tint: CompanionTint? = nil, picturePath: String? = nil) {
        self.id = id
        self.name = name
        self.tint = tint
        self.picturePath = picturePath
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        tint = try? container.decodeIfPresent(CompanionTint.self, forKey: .avatarBlot)
        picturePath = try? container.decodeIfPresent(String.self, forKey: .avatarImagePath)
    }

    var pictureFile: String? {
        picturePath?.split(separator: "/").last.map(String.init)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case avatarBlot
        case avatarImagePath
    }
}

enum CompanionTint: String, Decodable, Hashable, Sendable {
    case red
    case yellow
    case green
    case cyan
    case blue
    case purple
    case pink
    case orange
}
