import Foundation

enum MissionThreadRow: Identifiable, Equatable {
    case day(id: String, at: Date)
    case person(id: String, text: String, attachments: [String])
    case companion(id: String, text: String)

    var id: String {
        switch self {
        case .day(let id, _), .person(let id, _, _), .companion(let id, _): id
        }
    }
}

enum MissionTranscript {
    static let summonses: Set<String> = [
        "Carry out this mission.",
        "The coding agent of this mission is blocked and waiting on you.",
    ]

    static func rows(of messages: [MissionThreadMessage], calendar: Calendar) -> [MissionThreadRow]
    {
        var rows: [MissionThreadRow] = []
        var shownDay: Date?
        for message in messages.sorted(by: { $0.seq < $1.seq }) {
            guard let row = row(of: message) else { continue }
            let sentAt = Date(timeIntervalSince1970: TimeInterval(message.createdAt) / 1000)
            let day = calendar.startOfDay(for: sentAt)
            if day != shownDay {
                rows.append(.day(id: "day-\(message.id)", at: sentAt))
                shownDay = day
            }
            rows.append(row)
        }
        return rows
    }

    static func upserting(_ message: MissionThreadMessage, into messages: [MissionThreadMessage])
        -> [MissionThreadMessage]
    {
        (messages.filter { $0.id != message.id } + [message]).sorted { $0.seq < $1.seq }
    }

    private static func row(of message: MissionThreadMessage) -> MissionThreadRow? {
        let content = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return nil }
        guard message.role == .user, message.authorBotId == nil else {
            return .companion(id: message.id, text: content)
        }
        guard !summonses.contains(content) else { return nil }
        let split = MissionAttachmentBlock.split(content)
        return .person(id: message.id, text: split.text, attachments: split.names)
    }
}
