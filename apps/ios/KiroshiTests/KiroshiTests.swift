import Foundation
import Testing

struct KiroshiTests {
    @Test func theAppIsNamedKiroshi() {
        let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
        #expect(name == "Kiroshi")
    }
}
