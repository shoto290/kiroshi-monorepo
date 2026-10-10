import SwiftUI

extension View {
    func primaryAction() -> some View {
        fontWeight(.semibold)
            .buttonSizing(.flexible)
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(Color.kiroshi(.primary))
            .foregroundStyle(Color.kiroshi(.primaryForeground))
    }

    func secondaryAction() -> some View {
        fontWeight(.semibold)
            .buttonSizing(.flexible)
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(Color.kiroshi(.secondaryForeground))
    }

    func plainAction() -> some View {
        buttonSizing(.flexible)
            .frame(minHeight: 48)
            .buttonStyle(.borderless)
            .tint(Color.kiroshi(.foreground))
    }

    func bottomActions() -> some View {
        padding(.horizontal, 24)
            .padding(.bottom, 8)
    }
}
