import Foundation
import Observation
import Testing

@testable import Kiroshi

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct ThreadStoreTests {
    let transport = TestRelayTransport()
    let clock = TestRelayClock()
    let juniper = Companion(id: "juniper", name: "Juniper")
    let sentAt = Date(milliseconds: 1_791_000_000_000)

    func makeConnection() -> RelayConnection {
        RelayConnection(
            baseURL: KiroshiCloud.productionURL, instanceId: "instance-1", bearer: "fixture-bearer",
            environment: RelayEnvironment(transport: transport, clock: clock),
            backoff: Backoff(jitter: { $0 }))
    }

    func waitUntil(_ condition: @escaping @MainActor @Sendable () -> Bool) async {
        for await isMet in Observations({ condition() }) where isMet {
            return
        }
    }

    func makeStore() -> ThreadStore {
        var ids = (1...).lazy.map { "id-\($0)" }.makeIterator()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return ThreadStore(
            companion: juniper, now: { [sentAt] in sentAt }, makeId: { ids.next()! },
            calendar: calendar)
    }

    func follow(_ host: TestHost, _ store: ThreadStore) async -> (
        RelayConnection, Task<Void, Never>
    ) {
        let connection = makeConnection()
        let following = Task { await store.follow(connection) }
        await connection.start()
        await transport.nextOpening().accept(host.socket)
        await waitUntil { store.phase == .loaded }
        return (connection, following)
    }

    func texts(_ store: ThreadStore) -> [String] {
        store.entries.map { entry in
            switch entry {
            case .message(let message): (message.isYours ? "you: " : "") + message.text
            case .activities(let group): "[\(group.summary)]"
            }
        }
    }

    let twoDays = [
        TestHost.message(
            "m1", in: "chat-juniper", seq: 1, isYours: true, "Can you draft the notes?",
            at: 1_790_900_000_000),
        TestHost.message(
            "m2", in: "chat-juniper", seq: 2, isYours: false, "Drafted.", at: 1_790_900_060_000),
        TestHost.message(
            "m3", in: "chat-juniper", seq: 3, isYours: true, "Thanks!", at: 1_791_000_000_000),
    ]

    @Test func readsTheCompanionsConversationAsTheHostStoresIt() async throws {
        let host = TestHost(messages: ["chat-juniper": twoDays])
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        #expect(store.conversationId == "chat-juniper")
        #expect(texts(store) == ["you: Can you draft the notes?", "Drafted.", "you: Thanks!"])
        let opensDay = store.entries.map { entry -> Bool in
            guard case .message(let message) = entry else { return false }
            return message.opensDay
        }
        #expect(opensDay == [true, false, true])
        #expect(!store.isWorking)
        following.cancel()
        await connection.stop()
    }

    @Test func asksForTheMainChatOfTheCompanionInTheSharedSpace() async throws {
        let host = TestHost()
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        let call = try #require(await host.nextCall("conversation_main_chat"))
        let page = try #require(await host.nextCall("conversation_message_page"))

        #expect(try call.args(as: TestHost.BotArgs.self).botId == "juniper")
        #expect(try call.args(as: TestHost.BotArgs.self).spaceId == "s-1")
        #expect(try page.args(as: TestHost.PageArgs.self).limit == ThreadStore.pageSize)
        #expect(store.entries.isEmpty)
        following.cancel()
        await connection.stop()
    }

    @Test func aMessageLeftUnfinishedOpensTheThreadWorking() async {
        let unfinished =
            #"{"id":"m1","conversationId":"chat-juniper","turnId":"t","seq":1,"role":"assistant","content":"Draft","completion":"streaming","createdAt":1,"authorBotId":null,"authorAccountId":null,"authorName":null,"repliedToMessageId":null,"runtimeSessionId":null}"#
        let host = TestHost(messages: ["chat-juniper": [unfinished]])
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        #expect(store.isWorking)
        following.cancel()
        await connection.stop()
    }

    @Test func aTurnArrivesLiveWithItsToolsAndItsReply() async {
        let host = TestHost(messages: ["chat-juniper": Array(twoDays.prefix(1))])
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        host.pushAgent("chat-juniper", #"{"type":"turnChanged","state":"running"}"#)
        host.pushAgent(
            "chat-juniper",
            #"{"type":"activity","activity":{"id":"t1","title":"Read · a.md","kind":"tool","status":"running"}}"#
        )
        host.pushAgent(
            "chat-juniper",
            #"{"type":"activity","activity":{"id":"t1","title":"Read · a.md","kind":"tool","status":"succeeded"}}"#
        )
        host.pushAgent(
            "chat-juniper",
            #"{"type":"activity","activity":{"id":"t2","title":"Read · b.md","kind":"tool","status":"running"}}"#
        )
        host.pushAgent(
            "chat-juniper",
            #"{"type":"activity","activity":{"id":"t3","title":"Bash · List tags","kind":"tool","status":"running"}}"#
        )
        host.pushAgent(
            "chat-juniper",
            #"{"type":"messageStarted","message":{"id":"r1","role":"assistant","text":"","completion":"streaming","timestamp":1791000000000}}"#
        )
        host.pushAgent("chat-juniper", #"{"type":"messageDelta","id":"r1","seq":1,"text":"Draft"}"#)
        host.pushAgent("chat-juniper", #"{"type":"messageDelta","id":"r1","seq":2,"text":"ed."}"#)
        await waitUntil { texts(store).last == "Drafted." }

        #expect(
            texts(store) == [
                "you: Can you draft the notes?", "[The agent read 2 files, ran 1 command]",
                "Drafted.",
            ])
        #expect(store.runningScope?.runtimeSessionId == "session-1")

        host.pushAgent(
            "chat-juniper",
            #"{"type":"activity","activity":{"id":"t4","title":"Write · notes.md","kind":"tool","status":"succeeded"}}"#
        )
        host.pushAgent(
            "chat-juniper",
            #"{"type":"messageCompleted","message":{"id":"r2","role":"assistant","text":"They’re waiting.","completion":"complete","timestamp":1791000000000}}"#
        )
        host.pushAgent(
            "chat-juniper", #"{"type":"turnEnded","ended":{"sessionId":null,"outcome":"success"}}"#)
        await waitUntil { !store.isWorking }

        #expect(texts(store).suffix(2) == ["[The agent edited 1 file]", "They’re waiting."])
        #expect(store.runningScope == nil)
        following.cancel()
        await connection.stop()
    }

    @Test func eventsOfAnotherConversationChangeNothing() async {
        let host = TestHost(messages: ["chat-juniper": Array(twoDays.prefix(1))])
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        host.push(
            event: "conversation://message-stored",
            payload: TestHost.message(
                "x1", in: "chat-atlas", seq: 1, isYours: true, "Elsewhere", at: 1))
        host.pushAgent("chat-atlas", #"{"type":"turnChanged","state":"running"}"#)
        host.push(
            event: "conversation://message-stored",
            payload: TestHost.message(
                "m9", in: "chat-juniper", seq: 9, isYours: true, "Here", at: 1_790_900_000_000))
        await waitUntil { store.entries.count == 2 }

        #expect(texts(store) == ["you: Can you draft the notes?", "you: Here"])
        #expect(!store.isWorking)
        following.cancel()
        await connection.stop()
    }

    @Test func sendingRunsATurnOnTheHost() async throws {
        let host = TestHost { call in
            call.command == "conversation_send_turn" ? TestHost.ok(call, "4") : nil
        }
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        store.draft = "  Can you draft the release notes?\n"
        await store.send()?.value
        let call = try #require(await host.nextCall("conversation_send_turn"))

        let args = try call.args(as: SendTurnArgs.self)
        #expect(args.summoned == [])
        #expect(args.message.id == "id-1")
        #expect(args.message.turnId == "id-2")
        #expect(args.message.conversationId == "chat-juniper")
        #expect(args.message.content == "Can you draft the release notes?")
        #expect(args.message.createdAt == sentAt.milliseconds)
        #expect(call.text.contains(#""repliedToMessageId":null"#))
        #expect(texts(store) == ["you: Can you draft the release notes?"])
        #expect(store.draft.isEmpty)
        #expect(store.isWorking)
        #expect(store.sendFailure == nil)
        following.cancel()
        await connection.stop()
    }

    @Test func theStoredEchoOfASentMessageIsNotShownTwice() async throws {
        let host = TestHost { call in
            call.command == "conversation_send_turn" ? TestHost.ok(call, "1") : nil
        }
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        host.push(
            event: "conversation://message-stored",
            payload: TestHost.message(
                "id-1", in: "chat-juniper", seq: 1, isYours: true, "Hi", at: 1))
        await waitUntil { store.entries.count == 1 }
        store.draft = "Hi"
        await store.send()?.value

        #expect(texts(store) == ["you: Hi"])
        following.cancel()
        await connection.stop()
    }

    @Test func sendingIsUnavailableWhileTheHostIsOffline() async {
        let host = TestHost()
        let store = makeStore()
        let (connection, following) = await follow(host, store)
        store.draft = "Hello"
        #expect(store.canSend)

        host.socket.push(.close(RelayClosure.hostOffline))
        await waitUntil { !store.isReachable }

        #expect(!store.canSend)
        #expect(store.send() == nil)
        #expect(store.draft == "Hello")
        following.cancel()
        await connection.stop()
    }

    @Test func aSendCutOffByTheHostLeavingKeepsTheDraftAndSaysSo() async {
        let host = TestHost()
        let store = makeStore()
        let (connection, following) = await follow(host, store)
        let sending = Task {
            _ = await host.nextCall("conversation_send_turn")
            host.socket.push(.close(RelayClosure.hostOffline))
        }

        store.draft = "Hello"
        await store.send()?.value
        await sending.value

        #expect(store.sendFailure == .hostOffline)
        #expect(store.draft == "Hello")
        #expect(store.entries.isEmpty)
        #expect(!store.isWorking)
        following.cancel()
        await connection.stop()
    }

    @Test func aTurnAlreadyRunningSaysTheCompanionIsStillWorking() async {
        let host = TestHost { call in
            guard call.command == "conversation_send_turn" else { return nil }
            return TestHost.refused(
                call, status: 500,
                #"{"kind":"turnAlreadyRunning","conversationId":"chat-juniper","turnId":"t0"}"#)
        }
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        store.draft = "Hello"
        await store.send()?.value

        #expect(store.sendFailure == .stillWorking)
        #expect(store.draft == "Hello")
        #expect(store.entries.isEmpty)
        following.cancel()
        await connection.stop()
    }

    @Test func anErrorAnswerSaysSendingFailed() async {
        let host = TestHost { call in
            guard call.command == "conversation_send_turn" else { return nil }
            return TestHost.refused(call, status: 502, #""the host could not run the call""#)
        }
        let store = makeStore()
        let (connection, following) = await follow(host, store)

        store.draft = "Hello"
        await store.send()?.value

        #expect(store.sendFailure == .refused)
        #expect(store.draft == "Hello")
        #expect(!store.isWorking)
        following.cancel()
        await connection.stop()
    }

    @Test func stoppingCancelsTheRunningTurnWithItsScope() async throws {
        let host = TestHost { call in
            call.command == "agent_cancel_turn" ? TestHost.ok(call, "null") : nil
        }
        let store = makeStore()
        let (connection, following) = await follow(host, store)
        host.pushAgent("chat-juniper", #"{"type":"turnChanged","state":"running"}"#)
        await waitUntil { store.runningScope != nil }

        await store.stop()?.value
        let call = try #require(await host.nextCall("agent_cancel_turn"))

        #expect(try call.args(as: CancelArgs.self).scope.conversationId == "chat-juniper")
        #expect(try call.args(as: CancelArgs.self).scope.runtimeSessionId == "session-1")
        following.cancel()
        await connection.stop()
    }

    struct SendTurnArgs: Decodable {
        struct Message: Decodable {
            let id: String
            let conversationId: String
            let turnId: String
            let content: String
            let createdAt: Int
        }

        let message: Message
        let summoned: [String]
    }

    struct CancelArgs: Decodable {
        let scope: AgentEvent.Scope
    }
}
