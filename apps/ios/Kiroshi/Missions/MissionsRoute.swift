enum MissionsRoute: Hashable {
    case settings
    case mission(Mission)
}

extension MissionsRoute {
    @MainActor static var atLaunch: [MissionsRoute] {
        #if DEBUG
            if SignInFixture.opened == .missionThread {
                return [.mission(MissionsFixture.splitOnboarding)]
            }
        #endif
        return []
    }
}
