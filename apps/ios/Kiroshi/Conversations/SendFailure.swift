enum SendFailure: Equatable {
    case hostOffline
    case stillWorking
    case refused

    init(_ error: any Error) {
        switch error {
        case ConversationCallError.refused(_, kind: "turnAlreadyRunning"): self = .stillWorking
        case is RelayCallError: self = .hostOffline
        default: self = .refused
        }
    }
}
