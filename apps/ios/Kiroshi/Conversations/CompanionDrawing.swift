import SwiftUI

struct CompanionDrawing: Decodable, Sendable {
    let cells: [Cell]
    let tones: [Double]
    let toneOpacities: [ToneOpacity]
    let cellCorners: [Point]
    let cellColour: Channels
    let groundColour: Channels
    let outline: Outline

    struct Cell: Decodable, Sendable {
        let u: Double
        let v: Double
        let radius: Double
    }

    struct Point: Decodable, Sendable {
        let u: Double
        let v: Double
    }

    struct ToneOpacity: Decodable, Sendable {
        let tone: Double
        let opacity: Double
    }

    struct Channels: Decodable, Sendable {
        let red: Double
        let green: Double
        let blue: Double

        var color: Color {
            Color(.sRGB, red: red, green: green, blue: blue)
        }
    }

    struct Outline: Decodable, Sendable {
        let side: Double
        let path: Path

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            side = try container.decode(Double.self, forKey: .side)
            let svg = try container.decode(String.self, forKey: .path)
            guard let path = Path(svgOutline: svg) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .path, in: container, debugDescription: "Unreadable outline \(svg)")
            }
            self.path = path
        }

        private enum CodingKeys: String, CodingKey {
            case side
            case path
        }
    }

    func cellsPath(lit tone: Double, side: Double) -> Path {
        var path = Path()
        for (cell, cellTone) in zip(cells, tones) where cellTone == tone {
            let corners = cellCorners.map { corner in
                CGPoint(
                    x: (cell.u + cell.radius * corner.u) * side,
                    y: (cell.v + cell.radius * corner.v) * side)
            }
            path.addLines(corners)
            path.closeSubpath()
        }
        return path
    }

    func outlinePath(side: Double) -> Path {
        let scale = side / outline.side
        return outline.path.applying(CGAffineTransform(scaleX: scale, y: scale))
    }
}

extension Path {
    init?(svgOutline svg: String) {
        var tokens = svg.split(whereSeparator: { $0 == " " || $0 == "," }).makeIterator()
        var path = Path()
        var current = CGPoint.zero
        func number() -> Double? {
            tokens.next().flatMap { Double($0) }
        }
        func point() -> CGPoint? {
            guard let x = number(), let y = number() else { return nil }
            return CGPoint(x: x, y: y)
        }
        while let command = tokens.next() {
            switch command {
            case "M", "L":
                guard let next = point() else { return nil }
                if command == "M" { path.move(to: next) } else { path.addLine(to: next) }
                current = next
            case "A":
                guard let radius = number(), number() != nil, number() != nil,
                    let isLarge = number(), let sweeps = number(), let end = point()
                else { return nil }
                path.addSVGArc(
                    from: current, to: end, radius: radius, isLarge: isLarge != 0,
                    sweeps: sweeps != 0)
                current = end
            case "Z":
                path.closeSubpath()
            default:
                return nil
            }
        }
        self = path
    }

    private mutating func addSVGArc(
        from start: CGPoint, to end: CGPoint, radius: Double, isLarge: Bool, sweeps: Bool
    ) {
        let halfX = (start.x - end.x) / 2
        let halfY = (start.y - end.y) / 2
        let halfChord = halfX * halfX + halfY * halfY
        guard halfChord > 0, radius > 0 else {
            addLine(to: end)
            return
        }
        let radius = max(radius, halfChord.squareRoot())
        let reach = (max(0, radius * radius - halfChord) / halfChord).squareRoot()
        let side: Double = isLarge == sweeps ? -1 : 1
        let centerX = side * reach * halfY
        let centerY = side * reach * -halfX
        let center = CGPoint(x: centerX + (start.x + end.x) / 2, y: centerY + (start.y + end.y) / 2)
        let startAngle = atan2(halfY - centerY, halfX - centerX)
        var delta = atan2(-halfY - centerY, -halfX - centerX) - startAngle
        if sweeps, delta < 0 { delta += 2 * .pi }
        if !sweeps, delta > 0 { delta -= 2 * .pi }
        addRelativeArc(
            center: center, radius: radius, startAngle: .radians(startAngle),
            delta: .radians(delta))
    }
}
