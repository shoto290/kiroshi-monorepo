import SwiftUI

struct SignInRootView: View {
    @Bindable var model: SignInModel

    var body: some View {
        switch model.stage {
        case .signedOut:
            NavigationStack(path: $model.path) {
                OpeningView(model: model)
                    .navigationDestination(for: SignInStep.self) { step in
                        switch step {
                        case .email: EmailView(model: model)
                        case .code: CodeView(model: model)
                        }
                    }
            }
        case .loadingSpaces:
            LoadingSpacesView(model: model)
        case .spaces(let spaces) where spaces.isEmpty:
            NoSpaceView(model: model)
        case .spaces(let spaces):
            SpaceListView(model: model, spaces: spaces)
        case .spacesUnreachable:
            SpacesUnreachableView(model: model)
        }
    }
}
