import SwiftUI

struct SpaceChrome<Route: Hashable>: ViewModifier {
    let store: SpaceStore
    let settings: Route

    func body(content: Content) -> some View {
        content
            .safeAreaInset(edge: .top) {
                if let offlineSpace = store.offlineSpace {
                    HostOfflineLine(space: offlineSpace, email: store.email)
                        .padding(.horizontal)
                        .padding(.top, 8)
                }
            }
            .navigationTitle(store.currentSpace?.name ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarTitleMenu {
                SpaceMenu(store: store)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(value: settings) {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
    }
}

extension View {
    func spaceChrome<Route: Hashable>(store: SpaceStore, settings: Route) -> some View {
        modifier(SpaceChrome(store: store, settings: settings))
    }
}
