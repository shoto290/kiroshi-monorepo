import Foundation
import Testing

@testable import Kiroshi

struct MissionThreadFrameTests {
    let thread = "thread-mission-1"

    @Test func aStoredMessageOfTheThreadIsShown() {
        let payload = MissionTesting.message(id: "m-1", seq: 4, content: "Go")
        let frame = MissionThreadFrame(
            MissionTesting.event("conversation://message-stored", payload: payload),
            conversationId: thread)

        #expect(frame == .stored(MissionTesting.decoded(payload)))
    }

    @Test func aStoredMessageOfAnotherConversationIsIgnored() {
        let payload = MissionTesting.message(
            id: "m-1", seq: 4, content: "Go", conversationId: "elsewhere")

        #expect(
            MissionThreadFrame(
                MissionTesting.event("conversation://message-stored", payload: payload),
                conversationId: thread) == nil)
    }

    @Test func theCompanionSpeakingInTheThreadRereadsIt() {
        let spoke = MissionTesting.event(
            "conversation://companion-spoke",
            payload: #"{"conversationId":"thread-mission-1","authorBotId":"b-1","text":"Done"}"#)
        let elsewhere = MissionTesting.event(
            "conversation://companion-spoke",
            payload: #"{"conversationId":"other","authorBotId":"b-1","text":"Done"}"#)

        #expect(MissionThreadFrame(spoke, conversationId: thread) == .reread)
        #expect(MissionThreadFrame(elsewhere, conversationId: thread) == nil)
    }

    @Test(arguments: [
        ("messageCompleted", MissionThreadFrame?.some(.reread)),
        ("turnEnded", .reread),
        ("messageDelta", nil),
    ])
    func theAgentFinishingInTheThreadRereadsIt(type: String, expected: MissionThreadFrame?) {
        let event = MissionTesting.event(
            "agent://event",
            payload:
                #"{"scope":{"conversationId":"thread-mission-1","botId":"b-1"},"turn":null,"event":{"type":"\#(type)"}}"#
        )

        #expect(MissionThreadFrame(event, conversationId: thread) == expected)
    }

    @Test func anUnrelatedEventIsIgnored() {
        #expect(
            MissionThreadFrame(
                MissionTesting.event("mission://changed", payload: "{}"), conversationId: thread)
                == nil)
    }
}
