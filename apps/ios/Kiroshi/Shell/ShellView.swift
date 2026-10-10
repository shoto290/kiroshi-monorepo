import SwiftUI

struct ShellView: View {
    let store: SpaceStore
    let account: SignInModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView {
            Tab("Conversations", systemImage: "bubble.left.and.bubble.right.fill") {
                SpaceScreen(store: store, account: account, section: .conversations)
            }
            Tab("Missions", systemImage: "target") {
                SpaceScreen(store: store, account: account, section: .missions)
            }
        }
        .tint(.primary)
        .task(id: RelayFollow(spaceId: store.currentSpaceId, isInForeground: isInForeground)) {
            guard isInForeground else { return }
            await store.follow()
        }
        .task(id: isInForeground) {
            guard isInForeground else { return }
            await store.refreshSpaces()
        }
    }

    private var isInForeground: Bool {
        scenePhase != .background
    }
}

private struct RelayFollow: Hashable {
    let spaceId: Space.ID
    let isInForeground: Bool
}

#if DEBUG
    #Preview("2.1 Space · title closed") {
        SignInRootView(model: .fixture(.space))
    }

    #Preview("2.2 Space · menu open") {
        SignInRootView(model: .fixture(.spaceMenu))
    }

    #Preview("2.3 Space · host offline") {
        SignInRootView(model: .fixture(.hostOffline))
    }
#endif
