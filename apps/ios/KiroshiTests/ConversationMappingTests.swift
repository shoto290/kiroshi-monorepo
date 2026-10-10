import Foundation
import Testing

@testable import Kiroshi

struct ConversationMappingTests {
    func event(_ name: String, _ payload: String) -> ConversationEvent? {
        let frame = #"{"event":{"event":"\#(name)","payload":\#(payload)}}"#
        return ConversationEvent(RelayEvent(name: name, frame: Data(frame.utf8)))
    }

    @Test func readsAStoredMessage() throws {
        let stored = event(
            "conversation://message-stored",
            FixtureHost.messageJSON(
                id: "m1", conversationId: "c1", seq: 3, role: "user", content: "Hi", createdAt: 5))

        guard case .messageStored(let message) = stored else {
            Issue.record("Expected a stored message")
            return
        }
        #expect(message.id == "m1")
        #expect(message.seq == 3)
        #expect(message.role == .user)
        #expect(MessagePreview(message).line == "You: Hi")
    }

    @Test func readsAScopedAgentEvent() {
        let agent = event(
            "agent://event",
            #"{"scope":{"conversationId":"c1","botId":"b1","runtimeSessionId":"r1","epoch":2},"event":{"type":"messageDelta","id":"m1","seq":4,"text":"lo"},"turn":null}"#
        )

        #expect(
            agent
                == .agent(
                    AgentEvent(
                        scope: AgentEvent.Scope(
                            conversationId: "c1", botId: "b1", runtimeSessionId: "r1", epoch: 2),
                        change: .messageDelta(id: "m1", text: "lo"))))
    }

    @Test func anAgentEventItDoesNotDrawIsKeptAsOther() {
        let agent = event(
            "agent://event",
            #"{"scope":null,"event":{"type":"permissionRequested","request":{}},"turn":null}"#)

        #expect(agent == .agent(AgentEvent(scope: nil, change: .other)))
    }

    @Test func companionChangesAskForTheListAgain() {
        #expect(
            event("companion://created", #"{"id":"b1","name":"Juniper"}"#) == .companionsChanged)
        #expect(event("companion://deleted", #"{"id":"b1","spaceId":"s1"}"#) == .companionsChanged)
    }

    @Test func otherEventsAreNotTheConversationsConcern() {
        #expect(event("mission://changed", "{}") == nil)
    }

    @Test func toolsAreSummedUpByWhatTheAgentDid() {
        let group = ActivityGroup(
            id: "g",
            activities: [
                .init(id: "1", title: "Read · a.md"), .init(id: "2", title: "Bash · List tags"),
                .init(id: "3", title: "Read · b.md"), .init(id: "4", title: "Edit · c.md"),
                .init(id: "5", title: "Grep · TODO"), .init(id: "6", title: "Task"),
            ])

        #expect(
            group.summary
                == "The agent read 2 files, ran 1 command, edited 1 file, searched 1 time, used 1 tool"
        )
    }

    @Test func listTimesFollowTheDistanceFromToday() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = Date(timeIntervalSince1970: 1_791_633_600)
        let time = ConversationTime(
            now: now, calendar: calendar, locale: Locale(identifier: "en_GB"))

        #expect(time.listLabel(for: now.addingTimeInterval(-3_600)) == "11:00")
        #expect(time.listLabel(for: now.addingTimeInterval(-86_400)) == "Yesterday")
        #expect(time.listLabel(for: now.addingTimeInterval(-4 * 86_400)) == "Tuesday")
        #expect(time.threadLabel(for: now.addingTimeInterval(-3_600)) == "Today 11:00")
    }
}
