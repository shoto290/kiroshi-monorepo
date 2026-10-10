import Foundation
import Observation

@MainActor
@Observable
final class ThreadStore {
    enum Phase: Equatable {
        case loading
        case loaded
    }

    static let pageSize = 50

    let companion: Companion
    private(set) var phase = Phase.loading
    private(set) var entries: [ThreadEntry] = []
    private(set) var isWorking = false
    private(set) var isReachable = false
    private(set) var isSending = false
    private(set) var runningScope: AgentEvent.Scope?
    private(set) var sendFailure: SendFailure?
    var draft = ""

    @ObservationIgnored private(set) var conversationId: String?
    @ObservationIgnored private var relay: ConversationRelay?
    @ObservationIgnored private var loading: Task<Void, Never>?
    @ObservationIgnored private var sending: Task<Void, Never>?
    @ObservationIgnored private var stopping: Task<Void, Never>?
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let makeId: () -> String
    @ObservationIgnored private let calendar: Calendar

    init(
        companion: Companion,
        now: @escaping () -> Date = Date.init,
        makeId: @escaping () -> String = { UUID().uuidString.lowercased() },
        calendar: Calendar = .current
    ) {
        self.companion = companion
        self.now = now
        self.makeId = makeId
        self.calendar = calendar
    }

    var canSend: Bool {
        isReachable && conversationId != nil && !isSending && !isWorking
            && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func follow(_ connection: RelayConnection) async {
        let relay = ConversationRelay(connection: connection)
        self.relay = relay
        for await update in await connection.updates() {
            switch update {
            case .state(.online(let spaceId)):
                isReachable = true
                loading?.cancel()
                loading = Task { await load(in: spaceId, through: relay) }
            case .state:
                isReachable = false
            case .event(let event):
                guard let event = ConversationEvent(event) else { continue }
                apply(event)
            }
        }
        isReachable = false
        for task in [loading, sending, stopping] {
            task?.cancel()
        }
    }

    @discardableResult
    func send() -> Task<Void, Never>? {
        guard canSend, let relay, let conversationId else { return nil }
        let message = SentMessage(
            id: makeId(), conversationId: conversationId, turnId: makeId(),
            content: draft.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: now().milliseconds, repliedToMessageId: nil)
        draft = ""
        sendFailure = nil
        isSending = true
        sending = Task { await deliver(message, through: relay) }
        return sending
    }

    @discardableResult
    func stop() -> Task<Void, Never>? {
        guard let relay, let runningScope else { return nil }
        stopping = Task { try? await relay.cancelTurn(runningScope) }
        return stopping
    }

    private func deliver(_ message: SentMessage, through relay: ConversationRelay) async {
        defer { isSending = false }
        do {
            try await relay.sendTurn(message)
            insert(
                ThreadMessage(
                    id: message.id, isYours: true, text: message.content,
                    sentAt: Date(milliseconds: message.createdAt)))
            isWorking = true
        } catch is CancellationError {
            return
        } catch {
            if draft.isEmpty {
                draft = message.content
            }
            sendFailure = SendFailure(error)
        }
    }

    private func load(in spaceId: String, through relay: ConversationRelay) async {
        do {
            let conversationId = try await relay.mainChat(of: companion.id, in: spaceId)
            let messages = try await relay.latestMessages(
                in: conversationId, limit: Self.pageSize)
            guard !Task.isCancelled else { return }
            self.conversationId = conversationId
            entries = messages.map { message in
                .message(
                    ThreadMessage(
                        id: message.id, isYours: message.role == .user, text: message.content,
                        sentAt: Date(milliseconds: message.createdAt)))
            }
            isWorking = messages.last?.completion.isUnderway ?? false
            markDays()
            phase = .loaded
        } catch {
            return
        }
    }

    private func apply(_ event: ConversationEvent) {
        switch event {
        case .messageStored(let message) where message.conversationId == conversationId:
            insert(
                ThreadMessage(
                    id: message.id, isYours: message.role == .user, text: message.content,
                    sentAt: Date(milliseconds: message.createdAt)))
        case .agent(let agent) where agent.scope?.conversationId == conversationId:
            if let scope = agent.scope {
                runningScope = scope
            }
            apply(agent.change)
        case .messageStored, .agent, .companionsChanged:
            break
        }
    }

    private func apply(_ change: AgentEvent.Change) {
        switch change {
        case .turn(let state):
            isWorking = state.isWorking
        case .messageStarted(let message):
            isWorking = true
            insert(
                ThreadMessage(
                    id: message.id, isYours: message.role == .user, text: message.text,
                    sentAt: Date(milliseconds: message.timestamp)))
        case .messageDelta(let id, let text):
            updateMessage(id) { $0.text += text }
        case .messageCompleted(let message):
            if !updateMessage(message.id, { $0.text = message.text }) {
                insert(
                    ThreadMessage(
                        id: message.id, isYours: message.role == .user, text: message.text,
                        sentAt: Date(milliseconds: message.timestamp)))
            }
        case .activity(let activity) where activity.kind == .tool:
            isWorking = true
            record(ActivityGroup.Activity(id: activity.id, title: activity.title))
        case .turnEnded:
            isWorking = false
            runningScope = nil
        case .activity, .other:
            break
        }
    }

    private func insert(_ message: ThreadMessage) {
        guard !updateMessage(message.id, { $0.text = message.text }) else { return }
        entries.append(.message(message))
        markDays()
    }

    @discardableResult
    private func updateMessage(_ id: String, _ change: (inout ThreadMessage) -> Void) -> Bool {
        guard let index = entries.firstIndex(where: { $0.id == id }),
            case .message(var message) = entries[index]
        else { return false }
        change(&message)
        entries[index] = .message(message)
        return true
    }

    private func record(_ activity: ActivityGroup.Activity) {
        guard case .activities(var group) = entries.last else {
            entries.append(
                .activities(ActivityGroup(id: "activities-\(activity.id)", activities: [activity])))
            return
        }
        if let index = group.activities.firstIndex(where: { $0.id == activity.id }) {
            group.activities[index] = activity
        } else {
            group.activities.append(activity)
        }
        entries[entries.count - 1] = .activities(group)
    }

    private func markDays() {
        var previous: Date?
        for index in entries.indices {
            guard case .message(var message) = entries[index] else { continue }
            let opensDay =
                previous.map { !calendar.isDate($0, inSameDayAs: message.sentAt) } ?? true
            previous = message.sentAt
            if message.opensDay != opensDay {
                message.opensDay = opensDay
                entries[index] = .message(message)
            }
        }
    }
}
