import Foundation
import Observation

@MainActor
@Observable
final class ConversationsStore {
    enum Phase: Equatable {
        case loading
        case loaded
        case failed
    }

    private(set) var phase = Phase.loading
    private(set) var summaries: [CompanionSummary] = []
    var opened: Companion?

    @ObservationIgnored private var instanceId: Space.ID?
    @ObservationIgnored private var spaceId: String?
    @ObservationIgnored private var relay: ConversationRelay?
    @ObservationIgnored private var opening: Companion.ID?
    @ObservationIgnored private var working: Set<String> = []
    @ObservationIgnored private var loading: Task<Void, Never>?
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let calendar: Calendar

    init(
        opening: Companion.ID? = nil, now: @escaping () -> Date = Date.init,
        calendar: Calendar = .current
    ) {
        self.opening = opening
        self.now = now
        self.calendar = calendar
    }

    func follow(_ connection: RelayConnection) async {
        if instanceId != connection.instanceId {
            instanceId = connection.instanceId
            spaceId = nil
            phase = .loading
            summaries = []
            working = []
            opened = nil
        }
        relay = ConversationRelay(connection: connection)
        for await update in await connection.updates() {
            switch update {
            case .state(.online(let sharedSpaceId)):
                spaceId = sharedSpaceId
                reload()
            case .state:
                break
            case .event(let event):
                guard let event = ConversationEvent(event) else { continue }
                apply(event)
            }
        }
        loading?.cancel()
        loading = nil
    }

    @discardableResult
    func reload() -> Task<Void, Never>? {
        guard let spaceId, let relay else { return nil }
        if phase == .failed {
            phase = .loading
        }
        loading?.cancel()
        let task = Task { await load(spaceId, through: relay) }
        loading = task
        return task
    }

    func refresh() async {
        await reload()?.value
    }

    private func apply(_ event: ConversationEvent) {
        switch event {
        case .messageStored(let message):
            update(message.conversationId) { $0.lastMessage = MessagePreview(message) }
        case .agent(let agent):
            guard let conversationId = agent.scope?.conversationId else { return }
            apply(agent.change, to: conversationId)
        case .companionsChanged:
            reload()
        }
    }

    private func apply(_ change: AgentEvent.Change, to conversationId: String) {
        switch change {
        case .turn(let state):
            setWorking(state.isWorking, in: conversationId)
        case .messageStarted:
            setWorking(true, in: conversationId)
        case .messageCompleted(let message):
            update(conversationId) { $0.lastMessage = MessagePreview(message) }
        case .turnEnded:
            setWorking(false, in: conversationId)
        case .messageDelta, .activity, .other:
            break
        }
    }

    private func setWorking(_ isWorking: Bool, in conversationId: String) {
        if isWorking {
            working.insert(conversationId)
        } else {
            working.remove(conversationId)
        }
        update(conversationId) { $0.isWorking = isWorking }
    }

    private func update(_ conversationId: String, _ change: (inout CompanionSummary) -> Void) {
        guard let index = summaries.firstIndex(where: { $0.conversationId == conversationId })
        else { return }
        var changed = summaries
        change(&changed[index])
        publish(changed)
    }

    private func load(_ spaceId: String, through relay: ConversationRelay) async {
        do {
            let companions = try await relay.companions(in: spaceId)
            let loaded = try await withThrowingTaskGroup(of: CompanionSummary.self) { group in
                for companion in companions {
                    group.addTask {
                        try await Self.summary(of: companion, in: spaceId, through: relay)
                    }
                }
                var loaded: [CompanionSummary] = []
                for try await summary in group {
                    loaded.append(summary)
                }
                return loaded
            }
            guard !Task.isCancelled else { return }
            publish(
                loaded.map { summary in
                    var summary = summary
                    summary.isWorking = summary.conversationId.map(working.contains) ?? false
                    return summary
                })
            phase = .loaded
            if let opening, let companion = companions.first(where: { $0.id == opening }) {
                self.opening = nil
                opened = companion
            }
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            phase = .failed
        }
    }

    private nonisolated static func summary(
        of companion: Companion, in spaceId: String, through relay: ConversationRelay
    ) async throws -> CompanionSummary {
        let conversationId = try await relay.mainChat(of: companion.id, in: spaceId)
        let last = try await relay.latestMessages(in: conversationId, limit: 1).last
        return CompanionSummary(
            companion: companion, conversationId: conversationId,
            lastMessage: last.map(MessagePreview.init))
    }

    private func publish(_ changed: [CompanionSummary]) {
        let time = ConversationTime(now: now(), calendar: calendar)
        summaries = Self.ordered(changed).map { summary in
            var summary = summary
            summary.timeLabel =
                summary.isWorking
                ? String(localized: "Now")
                : summary.lastMessage.map { time.listLabel(for: $0.sentAt) }
            return summary
        }
    }

    private static func ordered(_ summaries: [CompanionSummary]) -> [CompanionSummary] {
        summaries.sorted { left, right in
            switch (left.lastMessage?.sentAt, right.lastMessage?.sentAt) {
            case (let left?, let right?) where left != right: left > right
            case (.some, .none): true
            case (.none, .some): false
            default:
                left.companion.name.localizedStandardCompare(right.companion.name)
                    == .orderedAscending
            }
        }
    }
}
