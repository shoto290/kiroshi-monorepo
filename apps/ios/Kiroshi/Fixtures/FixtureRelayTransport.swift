#if DEBUG
    import Foundation

    struct FixtureRelayTransport: RelayTransport {
        let onlineSpaceIds: Set<Space.ID>

        func open(_ request: URLRequest) async throws -> any RelaySocket {
            let path = request.url?.pathComponents ?? []
            let spaceId = path.dropLast(2).last ?? ""
            guard onlineSpaceIds.contains(spaceId) else {
                throw RelayClosure(code: RelayClosure.hostOffline)
            }
            return ScriptedRelaySocket(sharedSpaceId: "space-\(spaceId)")
        }
    }
#endif
