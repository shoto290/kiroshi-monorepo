#if DEBUG
    final class InMemorySessionStore: SessionStore {
        private(set) var saved: Session?

        init(_ saved: Session? = nil) {
            self.saved = saved
        }

        func load() -> Session? {
            saved
        }

        func save(_ session: Session) throws {
            saved = session
        }

        func clear() {
            saved = nil
        }
    }
#endif
