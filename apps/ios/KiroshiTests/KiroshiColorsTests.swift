import Testing
import UIKit

@testable import Kiroshi

struct KiroshiColorsTests {
    @Test(arguments: KiroshiColor.allCases)
    func everyNamedColourResolvesInTheCatalogue(_ name: KiroshiColor) {
        #expect(UIColor(named: name.rawValue, in: .main, compatibleWith: nil) != nil)
    }

    @Test func theAppAccentIsThePrimaryToken() {
        let accent = Bundle.main.object(forInfoDictionaryKey: "NSAccentColorName") as? String
        #expect(accent == KiroshiColor.primary.rawValue)
    }
}
