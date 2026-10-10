import Foundation
import Testing

@testable import Kiroshi

struct MissionTranscriptTests {
    let utc: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    @Test func thePromptAndTheCompanionShowUnderTheirDayAndTheSummonsIsHidden() {
        let day = 1_791_619_860_000
        let messages = [
            MissionTesting.message(
                id: "reply", seq: 3, role: "assistant", content: "Done.", createdAt: day + 60_000,
                botId: "b-1"),
            MissionTesting.message(
                id: "summons", seq: 1, content: "Carry out this mission.", createdAt: day),
            MissionTesting.message(
                id: "prompt", seq: 2, content: "Split it.", createdAt: day + 30_000),
            MissionTesting.message(
                id: "writing", seq: 4, role: "assistant", content: "", createdAt: day + 90_000,
                botId: "b-1"),
        ].map(MissionTesting.decoded)

        let rows = MissionTranscript.rows(of: messages, calendar: utc)

        #expect(
            rows == [
                .day(
                    id: "day-prompt",
                    at: Date(timeIntervalSince1970: TimeInterval(day + 30_000) / 1000)),
                .person(
                    id: "prompt", text: MissionTranscript.markdown("Split it."), attachments: []),
                .companion(id: "reply", text: MissionTranscript.markdown("Done.")),
            ])
    }

    @Test func aNewDayOpensANewSeparator() {
        let messages = [
            MissionTesting.message(id: "first", seq: 1, content: "One", createdAt: 0),
            MissionTesting.message(id: "next", seq: 2, content: "Two", createdAt: 86_400_000),
        ].map(MissionTesting.decoded)

        #expect(
            MissionTranscript.rows(of: messages, calendar: utc).map(\.id) == [
                "day-first", "first", "day-next", "next",
            ])
    }

    @Test func aStoredMessageReplacesTheOneSentWithTheSameId() {
        let sent = MissionTesting.decoded(MissionTesting.message(id: "a", seq: .max, content: "Hi"))
        let stored = MissionTesting.decoded(MissionTesting.message(id: "a", seq: 7, content: "Hi"))
        let earlier = MissionTesting.decoded(MissionTesting.message(id: "b", seq: 6, content: "Yo"))

        let messages = MissionTranscript.upserting(stored, into: [sent, earlier])

        #expect(messages.map(\.id) == ["b", "a"])
        #expect(messages.last?.seq == 7)
    }
}
