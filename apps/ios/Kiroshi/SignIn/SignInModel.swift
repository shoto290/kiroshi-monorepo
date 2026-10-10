import Foundation
import Observation

enum SignInStep: Hashable {
    case email
    case code
}

enum AccountStage: Equatable {
    case signedOut
    case loadingSpaces
    case spaces([Space])
    case spacesUnreachable
}

enum EmailProblem: Equatable {
    case unreachable
    case tooManyCodes
    case invalidEmail
}

enum CodeProblem: Equatable {
    case wrongCode
    case tooManyWrongCodes
    case expiredCode
    case tooManyCodes
    case unreachable

    var needsNewCode: Bool {
        self == .tooManyWrongCodes || self == .expiredCode
    }
}

@MainActor
@Observable
final class SignInModel {
    static let codeLength = 6

    var path: [SignInStep] = []
    var email = ""
    var code = ""
    private(set) var stage: AccountStage
    private(set) var signedInEmail = ""
    private(set) var isRequestingCode = false
    private(set) var isSigningIn = false
    private(set) var emailProblem: EmailProblem?
    private(set) var codeProblem: CodeProblem?
    var isConfirmingSignOut = false
    @ObservationIgnored var onSignOut: () -> Void = {}
    @ObservationIgnored private(set) var revocation: Task<Void, Never>?

    @ObservationIgnored private let cloud: KiroshiCloud
    @ObservationIgnored private let sessions: any SessionStore
    @ObservationIgnored private var session: Session?
    @ObservationIgnored private var work: Task<Void, Never>?

    init(cloud: KiroshiCloud, sessions: any SessionStore) {
        self.cloud = cloud
        self.sessions = sessions
        session = sessions.load()
        stage = session == nil ? .signedOut : .loadingSpaces
        signedInEmail = session?.email ?? ""
    }

    var needsNewCode: Bool {
        codeProblem?.needsNewCode ?? false
    }

    func start() {
        path = [.email]
    }

    func continueWithEmail() {
        run { [weak self] in await self?.requestCode() }
    }

    func sendNewCodeTapped() {
        run { [weak self] in await self?.sendNewCode() }
    }

    func codeChanged() {
        let digits = String(code.filter(\.isASCII).filter(\.isNumber).prefix(Self.codeLength))
        if digits != code {
            code = digits
            return
        }
        if let codeProblem, !codeProblem.needsNewCode {
            self.codeProblem = nil
        }
        if code.count == Self.codeLength, codeProblem == nil {
            run { [weak self] in await self?.signIn() }
        }
    }

    func useDifferentEmail() {
        work?.cancel()
        code = ""
        codeProblem = nil
        path = [.email]
    }

    func checkAgain() {
        stage = .loadingSpaces
    }

    func useAnotherAccount() {
        signOut()
        email = ""
        path = [.email]
    }

    func requestCode() async {
        email = email.trimmingCharacters(in: .whitespacesAndNewlines)
        emailProblem = nil
        isRequestingCode = true
        defer { isRequestingCode = false }
        guard let answer = try? await cloud.requestCode(for: email) else { return }
        switch answer {
        case .sent:
            code = ""
            codeProblem = nil
            path = [.email, .code]
        case .tooManyRequests: emailProblem = .tooManyCodes
        case .invalidEmail: emailProblem = .invalidEmail
        case .unreachable: emailProblem = .unreachable
        }
    }

    func sendNewCode() async {
        isRequestingCode = true
        defer { isRequestingCode = false }
        guard let answer = try? await cloud.requestCode(for: email) else { return }
        switch answer {
        case .sent:
            code = ""
            codeProblem = nil
        case .tooManyRequests: codeProblem = .tooManyCodes
        case .invalidEmail, .unreachable: codeProblem = .unreachable
        }
    }

    func signIn() async {
        isSigningIn = true
        defer { isSigningIn = false }
        guard let answer = try? await cloud.signIn(email: email, code: code) else { return }
        switch answer {
        case .signedIn(let granted):
            try? sessions.save(granted)
            session = granted
            signedInEmail = granted.email
            code = ""
            path = []
            stage = .loadingSpaces
        case .wrongCode: codeProblem = .wrongCode
        case .tooManyWrongCodes: codeProblem = .tooManyWrongCodes
        case .expiredCode:
            codeProblem = .expiredCode
            code = ""
        case .unreachable: codeProblem = .unreachable
        }
    }

    func loadSpaces() async {
        guard let session else { return }
        guard let answer = try? await cloud.spaces(bearer: session.bearer) else { return }
        switch answer {
        case .spaces(let spaces): stage = .spaces(spaces)
        case .unauthenticated: endSession()
        case .unreachable: stage = .spacesUnreachable
        }
    }

    func signOutTapped() {
        isConfirmingSignOut = true
    }

    func signOut() {
        if let bearer = session?.bearer {
            revocation = Task { [cloud] in await cloud.signOut(bearer: bearer) }
        }
        endSession()
    }

    private func endSession() {
        onSignOut()
        work?.cancel()
        sessions.clear()
        session = nil
        signedInEmail = ""
        code = ""
        codeProblem = nil
        emailProblem = nil
        isConfirmingSignOut = false
        path = []
        stage = .signedOut
    }

    private func run(_ operation: @escaping @MainActor () async -> Void) {
        work?.cancel()
        work = Task { await operation() }
    }
}
