import SwiftUI

extension View {
    func primaryAction() -> some View {
        fontWeight(.semibold)
            .buttonSizing(.flexible)
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(.primary)
    }

    func secondaryAction() -> some View {
        fontWeight(.semibold)
            .buttonSizing(.flexible)
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .tint(.primary)
    }

    func plainAction() -> some View {
        buttonSizing(.flexible)
            .frame(minHeight: 48)
            .buttonStyle(.borderless)
            .tint(.primary)
    }

    func bottomActions() -> some View {
        padding(.horizontal, 24)
            .padding(.bottom, 8)
    }
}
