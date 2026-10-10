#if DEBUG
    import Foundation

    enum CloudFixture {
        static let email = "sam@example.com"
        static let session = Session(bearer: "fixture-bearer", email: email)
        static let codeRequestPath = "/api/auth/email-otp/send-verification-otp"
        static let signInPath = "/api/auth/sign-in/email-otp"
        static let spacesPath = "/instances"

        static let codeSent = ScriptedTransport.Answer.status(
            200, #"{"status":true,"expiresAt":"2026-10-10T12:05:00.000Z"}"#)
        static let signedIn = ScriptedTransport.Answer.status(
            200,
            #"""
            {"token":"fixture-bearer","user":{"id":"7d3f1c2a-0000-4000-8000-000000000001","email":"sam@example.com","createdAt":"2026-10-10T12:00:00.000Z"},"session":{"expiresAt":"2026-10-17T12:00:00.000Z"}}
            """#)
        static let noSpaces = ScriptedTransport.Answer.status(200, "[]")
        static let twoSpaces = ScriptedTransport.Answer.status(
            200,
            #"""
            [{"id":"9b1e0000-0000-4000-8000-000000000001","name":"Studio","role":"owner","createdAt":"2026-10-01T09:00:00.000Z","online":true},{"id":"9b1e0000-0000-4000-8000-000000000002","name":"Bench","role":"member","createdAt":"2026-10-02T09:00:00.000Z","online":false}]
            """#)

        static func error(_ status: Int, code: String, message: String) -> ScriptedTransport.Answer
        {
            .status(
                status,
                #"{"error":{"code":"\#(code)","message":"\#(message)","status":\#(status)}}"#)
        }

        static func refused(_ message: String) -> ScriptedTransport.Answer {
            error(401, code: "UNAUTHENTICATED", message: message)
        }
    }

    enum SignInFixture: String, CaseIterable {
        case opening = "1.1"
        case email = "1.2"
        case code = "1.3"
        case signingIn = "1.4"
        case loadingSpaces = "1.5"
        case couldNotSendCode = "1.6"
        case wrongCode = "1.7"
        case tooManyWrongCodes = "1.7b"
        case expiredCode = "1.8"
        case tooManyCodes = "1.9"
        case noSpace = "1.10"
        case spaces
        case spacesUnreachable = "spaces-unreachable"

        static var launchArgument: SignInFixture? {
            UserDefaults.standard.string(forKey: "fixture").flatMap(SignInFixture.init(rawValue:))
        }

        fileprivate var answers: [String: ScriptedTransport.Answer] {
            switch self {
            case .signingIn: [CloudFixture.signInPath: .pending]
            case .loadingSpaces: [CloudFixture.spacesPath: .pending]
            case .couldNotSendCode: [CloudFixture.codeRequestPath: .offline]
            case .wrongCode: [CloudFixture.signInPath: CloudFixture.refused("Code is wrong")]
            case .tooManyWrongCodes:
                [
                    CloudFixture.signInPath: CloudFixture.refused(
                        "Too many wrong codes, ask for a new one")
                ]
            case .expiredCode: [CloudFixture.signInPath: CloudFixture.refused("Code has expired")]
            case .tooManyCodes:
                [
                    CloudFixture.codeRequestPath: CloudFixture.error(
                        429, code: "TOO_MANY_REQUESTS", message: "Too many requests")
                ]
            case .noSpace: [CloudFixture.spacesPath: CloudFixture.noSpaces]
            case .spaces: [CloudFixture.spacesPath: CloudFixture.twoSpaces]
            case .spacesUnreachable: [CloudFixture.spacesPath: .offline]
            case .opening, .email, .code: [:]
            }
        }

        fileprivate var isSignedIn: Bool {
            switch self {
            case .loadingSpaces, .noSpace, .spaces, .spacesUnreachable: true
            default: false
            }
        }

        fileprivate var typedCode: String {
            switch self {
            case .code, .tooManyCodes: "482"
            case .signingIn, .expiredCode: "482913"
            case .wrongCode: "482918"
            case .tooManyWrongCodes: "482931"
            default: ""
            }
        }
    }

    extension SignInModel {
        static func fixture(_ fixture: SignInFixture) -> SignInModel {
            let model = SignInModel(
                cloud: KiroshiCloud(
                    baseURL: KiroshiCloud.productionURL,
                    transport: ScriptedTransport(fixture.answers)),
                sessions: InMemorySessionStore(fixture.isSignedIn ? CloudFixture.session : nil))
            if fixture != .opening {
                model.email = CloudFixture.email
            }
            model.code = fixture.typedCode
            switch fixture {
            case .email:
                model.path = [.email]
            case .couldNotSendCode:
                model.path = [.email]
                model.continueWithEmail()
            case .code:
                model.path = [.email, .code]
            case .signingIn, .wrongCode, .tooManyWrongCodes, .expiredCode:
                model.path = [.email, .code]
                model.codeChanged()
            case .tooManyCodes:
                model.path = [.email, .code]
                model.sendNewCodeTapped()
            case .opening, .loadingSpaces, .noSpace, .spaces, .spacesUnreachable:
                break
            }
            return model
        }
    }
#endif
