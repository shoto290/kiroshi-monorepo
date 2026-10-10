import SwiftUI

struct MissionRow: View {
    let mission: Mission
    let companionName: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(mission.ticket.externalId)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
            Text(mission.objective)
                .font(.headline)
                .lineLimit(lineLimit)
            HStack(spacing: 6) {
                Image(systemName: "hexagon.fill")
                    .foregroundStyle(.quaternary)
                    .accessibilityHidden(true)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(lineLimit)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private var lineLimit: Int {
        dynamicTypeSize.isAccessibilitySize ? 3 : 1
    }

    private var detail: String {
        [companionName, mission.statusLine].compactMap(\.self).joined(separator: " · ")
    }
}
