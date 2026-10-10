import Foundation

protocol LastSpaceStore {
    func load() -> Space.ID?
    func save(_ id: Space.ID)
    func clear()
}

struct UserDefaultsLastSpaceStore: LastSpaceStore {
    var key = "lastSpaceId"

    func load() -> Space.ID? {
        UserDefaults.standard.string(forKey: key)
    }

    func save(_ id: Space.ID) {
        UserDefaults.standard.set(id, forKey: key)
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
