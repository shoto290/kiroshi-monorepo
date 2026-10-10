import SwiftUI

struct ShellView: View {
    let store: SpaceStore
    let account: SignInModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab = SpaceSection.atLaunch

    var body: some View {
        TabView(selection: $tab) {
            Tab(
                "Conversations", systemImage: "bubble.left.and.bubble.right.fill",
                value: .conversations
            ) {
                SpaceScreen(store: store, account: account, section: .conversations)
            }
            Tab("Missions", systemImage: "target", value: SpaceSection.missions) {
                MissionsScreen(store: store, account: account)
            }
        }
        .environment(store.pictures)
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

extension SpaceSection {
    @MainActor static var atLaunch: SpaceSection {
        #if DEBUG
            if SignInFixture.opened?.opensOnMissions == true { return .missions }
        #endif
        return .conversations
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
