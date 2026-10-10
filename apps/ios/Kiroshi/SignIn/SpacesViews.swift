import SwiftUI

struct LoadingSpacesView: View {
    let model: SignInModel

    var body: some View {
        ProgressView {
            Text("Loading your spaces…")
                .foregroundStyle(.secondary)
        }
        .controlSize(.large)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task { await model.loadSpaces() }
    }
}

struct NoSpaceView: View {
    let model: SignInModel

    var body: some View {
        ViewThatFits(in: .vertical) {
            noSpaces
            ScrollView { noSpaces }
        }
        .safeAreaBar(edge: .bottom) {
            VStack(spacing: 4) {
                Button("Check again", action: model.checkAgain)
                    .secondaryAction()
                Button("Use another account", action: model.useAnotherAccount)
                    .fontWeight(.medium)
                    .plainAction()
            }
            .bottomActions()
        }
    }

    private var noSpaces: some View {
        ContentUnavailableView {
            Label("No spaces yet", systemImage: "square.stack")
        } description: {
            VStack(spacing: 14) {
                Text(
                    "Turn on hosting for a space on your Mac, or ask someone to invite you. It shows up here."
                )
                Text("Signed in as \(model.signedInEmail)")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

struct SpacesUnreachableView: View {
    let model: SignInModel

    var body: some View {
        ContentUnavailableView {
            Label("Couldn’t load your spaces", systemImage: "wifi.exclamationmark")
        } description: {
            Text("Couldn’t reach Kiroshi. Check your connection and try again.")
        }
        .safeAreaBar(edge: .bottom) {
            Button("Check again", action: model.checkAgain)
                .secondaryAction()
                .bottomActions()
        }
    }
}

struct SpaceListView: View {
    let model: SignInModel
    let spaces: [Space]

    var body: some View {
        NavigationStack {
            List(spaces) { space in
                Text(space.name)
            }
            .navigationTitle("Spaces")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsView(model: model, spaces: spaces)
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
        }
    }
}

#if DEBUG
    #Preview("1.5 Signed in · loading spaces") {
        SignInRootView(model: .fixture(.loadingSpaces))
    }

    #Preview("1.10 No remote space") {
        SignInRootView(model: .fixture(.noSpace))
    }

    #Preview("Spaces") {
        SignInRootView(model: .fixture(.spaces))
    }

    #Preview("Spaces unreachable") {
        SignInRootView(model: .fixture(.spacesUnreachable))
    }
#endif
