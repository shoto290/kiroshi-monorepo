import SwiftUI

struct MissionRow: View {
    let mission: Mission
    let companion: MissionCompanion?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(mission.ticket.externalId)
                .font(.footnote.monospaced())
                .foregroundStyle(Color.kiroshi(.mutedForeground))
            Text(mission.objective)
                .font(.headline)
                .lineLimit(lineLimit)
            HStack(spacing: 6) {
                CompanionAvatar(companion, size: .inline, isWorking: mission.isAgentRunning)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(Color.kiroshi(.mutedForeground))
                    .lineLimit(lineLimit)
            }
        }
        .padding(.vertical, 4)
        .foregroundStyle(Color.kiroshi(.foreground))
        .accessibilityElement(children: .combine)
    }

    private var lineLimit: Int {
        dynamicTypeSize.isAccessibilitySize ? 3 : 1
    }

    private var detail: String {
        [companion?.name, mission.statusLine].compactMap(\.self).joined(separator: " · ")
    }
}
