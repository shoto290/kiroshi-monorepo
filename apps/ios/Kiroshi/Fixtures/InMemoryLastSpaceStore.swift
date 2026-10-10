#if DEBUG
    final class InMemoryLastSpaceStore: LastSpaceStore {
        private(set) var saved: Space.ID?

        init(_ saved: Space.ID? = nil) {
            self.saved = saved
        }

        func load() -> Space.ID? {
            saved
        }

        func save(_ id: Space.ID) {
            saved = id
        }

        func clear() {
            saved = nil
        }
    }
#endif
