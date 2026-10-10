import SwiftUI

struct CompanionAvatar: View {
    enum Size {
        case title
        case row
        case hero

        var points: CGFloat {
            switch self {
            case .title: 28
            case .row: 52
            case .hero: 72
            }
        }

        var glyphFont: Font.TextStyle {
            switch self {
            case .title: .caption2
            case .row: .subheadline
            case .hero: .title3
            }
        }
    }

    let companion: Companion?
    let size: Size

    init(_ companion: Companion?, size: Size) {
        self.companion = companion
        self.size = size
    }

    var body: some View {
        ScaledHexagon(companion: companion, size: size)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .accessibilityHidden(true)
    }
}

private struct ScaledHexagon: View {
    let companion: Companion?
    let size: CompanionAvatar.Size
    @ScaledMetric private var side: CGFloat

    init(companion: Companion?, size: CompanionAvatar.Size) {
        self.companion = companion
        self.size = size
        _side = ScaledMetric(wrappedValue: size.points, relativeTo: size.glyphFont)
    }

    var body: some View {
        Image(systemName: "hexagon.fill")
            .resizable()
            .scaledToFit()
            .foregroundStyle(Color.kiroshi(companion == nil ? .muted : .railAvatar))
            .overlay {
                if let companion {
                    Canvas { context, canvas in
                        let glyph = Text(companion.glyph)
                            .font(.system(size.glyphFont, design: .monospaced, weight: .bold))
                            .foregroundStyle(Color.kiroshi(.foreground))
                        context.draw(glyph, at: CGPoint(x: canvas.width / 2, y: canvas.height / 2))
                    }
                }
            }
            .frame(width: side, height: side)
    }
}

extension Companion {
    static let glyphs = ["/\\", "#=", "{}", ".:", "%*", "<>", "+-", "[]", "~=", "::", "*.", "|/"]

    var glyph: String {
        let seed = id.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0x7fff_ffff }
        return Self.glyphs[seed % Self.glyphs.count]
    }
}
