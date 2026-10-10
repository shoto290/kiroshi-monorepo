import SwiftUI

struct MissionThreadView: View {
    let missions: MissionsStore
    let space: SpaceStore
    @State private var thread: MissionThreadStore

    init(mission: Mission, missions: MissionsStore, space: SpaceStore) {
        self.missions = missions
        self.space = space
        _thread = State(initialValue: MissionThreadStore(mission: mission))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                ForEach(thread.rows) { row in
                    MissionThreadRowView(row: row)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
        }
        .defaultScrollAnchor(.bottom)
        .overlay {
            if thread.hasFailed {
                ContentUnavailableView {
                    Label("Couldn’t load this mission", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(
                        "The mission is still there; only this view didn’t load. Go back and open it again."
                    )
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            MissionComposer(thread: thread)
        }
        .navigationTitle(thread.mission.objective)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(subtitle)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                    Text(thread.mission.objective)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .task(id: space.connection.map(ObjectIdentifier.init)) {
            guard let connection = space.connection else { return }
            await thread.follow(connection)
        }
        .onDisappear { thread.leave() }
    }

    private var subtitle: String {
        [thread.mission.ticket.externalId, missions.companionName(of: thread.mission)]
            .compactMap(\.self)
            .joined(separator: " · ")
    }
}

struct MissionThreadRowView: View {
    let row: MissionThreadRow

    var body: some View {
        switch row {
        case .day(_, let at):
            Text(Self.dayLabel(at))
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
        case .person(_, let text, let attachments):
            VStack(alignment: .leading, spacing: 6) {
                if !text.isEmpty {
                    Text(Self.markdown(text))
                }
                ForEach(attachments, id: \.self) { name in
                    Label(name, systemImage: "paperclip")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(.systemGray5), in: .rect(cornerRadius: 20))
            .padding(.leading, 56)
            .frame(maxWidth: .infinity, alignment: .trailing)
        case .companion(_, let text):
            Text(Self.markdown(text))
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
    }

    static func dayLabel(_ at: Date, calendar: Calendar = .current) -> String {
        let time = at.formatted(.dateTime.hour().minute())
        if calendar.isDateInToday(at) { return "Today \(time)" }
        if calendar.isDateInYesterday(at) { return "Yesterday \(time)" }
        return "\(at.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))) \(time)"
    }

    private static func markdown(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(text)
    }
}
