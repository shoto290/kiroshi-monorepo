import SwiftUI

struct SettingsView: View {
    @Bindable var model: SignInModel
    let spaces: [Space]

    var body: some View {
        List {
            Section {
                LabeledContent("Email", value: model.signedInEmail)
                Button("Sign out", role: .destructive, action: model.signOutTapped)
            } header: {
                Text("Account")
                    .textCase(.uppercase)
            } footer: {
                Text("Your spaces stop working on this iPhone until you sign in again.")
            }
            Section {
            } footer: {
                Text(Self.version)
                    .frame(maxWidth: .infinity)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Sign out of Kiroshi?", isPresented: $model.isConfirmingSignOut) {
            Button("Cancel", role: .cancel) {}
            Button("Sign out", role: .destructive, action: model.signOut)
        } message: {
            Text(Self.signOutMessage(for: spaces))
        }
    }

    static func signOutMessage(for spaces: [Space]) -> String {
        let names = spaces.map(\.name)
        switch names.count {
        case 0:
            return "Your spaces leave this iPhone until you sign in again."
        case 1:
            return "\(names[0]) leaves this iPhone until you sign in again."
        default:
            let listed = names.dropLast().joined(separator: ", ") + " and " + names[names.count - 1]
            return "\(listed) leave this iPhone until you sign in again."
        }
    }

    private static let version: String = {
        let info = Bundle.main.infoDictionary
        let marketing = info?["CFBundleShortVersionString"] as? String ?? ""
        let build = info?["CFBundleVersion"] as? String ?? ""
        return "Kiroshi \(marketing) (\(build))"
    }()
}

#if DEBUG
    #Preview("5.1 Settings") {
        NavigationStack {
            SettingsView(model: .fixture(.spaces), spaces: CloudFixture.artboardSpaces)
        }
    }

    #Preview("5.2 Sign out · confirmation alert") {
        @Previewable @State var model = SignInModel.fixture(.spaces)
        NavigationStack {
            SettingsView(model: model, spaces: CloudFixture.artboardSpaces)
        }
        .onAppear(perform: model.signOutTapped)
    }
#endif
