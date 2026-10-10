import Foundation
import Testing

@testable import Kiroshi

struct UserDefaultsLastSpaceStoreTests {
    let store = UserDefaultsLastSpaceStore(key: "test.lastSpaceId.\(UUID().uuidString)")

    @Test func remembersTheLastPickedSpaceUntilCleared() {
        #expect(store.load() == nil)

        store.save("studio")
        #expect(store.load() == "studio")

        store.clear()
        #expect(store.load() == nil)
    }
}
