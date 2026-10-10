import Testing

@testable import Kiroshi

@Suite(.serialized)
struct KeychainSessionStoreTests {
    let store = KeychainSessionStore(service: "com.kiroshi.app.ios.tests.session")

    @Test func keepsTheSessionUntilCleared() throws {
        store.clear()
        #expect(store.load() == nil)

        try store.save(CloudFixture.session)
        #expect(store.load() == CloudFixture.session)

        let next = Session(bearer: "next-bearer", email: "sam@example.com")
        try store.save(next)
        #expect(store.load() == next)

        store.clear()
        #expect(store.load() == nil)
    }
}
