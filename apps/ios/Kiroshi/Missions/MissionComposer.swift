import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct MissionComposer: View {
    @Bindable var thread: MissionThreadStore
    @State private var isPickingPhotos = false
    @State private var isPickingFiles = false
    @State private var photos: [PhotosPickerItem] = []
    @State private var couldNotAttach = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let problem {
                Label(problem, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(Color.kiroshi(.destructive))
            }
            if !thread.attachments.isEmpty {
                ScrollView(.horizontal) {
                    HStack {
                        ForEach(thread.attachments) { attachment in
                            Button {
                                thread.attachments.removeAll { $0.id == attachment.id }
                            } label: {
                                Label(attachment.name, systemImage: "xmark.circle.fill")
                                    .lineLimit(1)
                            }
                            .buttonStyle(.bordered)
                            .accessibilityLabel("Remove \(attachment.name)")
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    Button("Photo Library", systemImage: "photo.on.rectangle") {
                        isPickingPhotos = true
                    }
                    Button("Choose File", systemImage: "folder") {
                        isPickingFiles = true
                    }
                } label: {
                    Image(systemName: "plus")
                        .font(.body.weight(.medium))
                        .padding(4)
                        .accessibilityLabel("Attach")
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
                .tint(Color.kiroshi(.mutedForeground))
                .foregroundStyle(Color.kiroshi(.foreground))
                HStack(alignment: .bottom, spacing: 8) {
                    TextField("Answer this mission…", text: $thread.draft, axis: .vertical)
                        .lineLimit(1...6)
                        .padding(.vertical, 8)
                        .foregroundStyle(Color.kiroshi(.foreground))
                    if thread.isSending {
                        ProgressView()
                            .padding(.vertical, 8)
                    } else if thread.canSend {
                        Button("Send", systemImage: "arrow.up.circle.fill") { thread.send() }
                            .labelStyle(.iconOnly)
                            .font(.title)
                            .padding(.vertical, 2)
                    }
                }
                .padding(.leading, 14)
                .padding(.trailing, 4)
                .overlay {
                    RoundedRectangle(cornerRadius: 20).strokeBorder(Color.kiroshi(.border))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.kiroshi(.card))
        .photosPicker(isPresented: $isPickingPhotos, selection: $photos, matching: .images)
        .fileImporter(
            isPresented: $isPickingFiles, allowedContentTypes: [.item],
            allowsMultipleSelection: true, onCompletion: attachFiles
        )
        .task(id: photos) { await attachPhotos() }
    }

    private var problem: String? {
        if couldNotAttach { return "Couldn’t attach that file. Pick it again." }
        if !thread.isOnline, thread.hasLoaded {
            return "The host’s Mac is offline. You can send again once it’s back."
        }
        return switch thread.sendProblem {
        case .couldNotSend: "Couldn’t send your answer. Send it again."
        case .tooLarge: "Couldn’t send your files: they’re too large. Remove one and send again."
        case .offline: "Couldn’t send: the host’s Mac is offline. Send again once it’s back."
        case nil: nil
        }
    }

    private func attachPhotos() async {
        guard !photos.isEmpty else { return }
        couldNotAttach = false
        for photo in photos {
            guard let data = try? await photo.loadTransferable(type: Data.self) else {
                couldNotAttach = true
                continue
            }
            let suffix = photo.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
            thread.attachments.append(
                PickedAttachment(
                    id: UUID(), name: "Photo \(thread.attachments.count + 1).\(suffix)", data: data)
            )
        }
        photos = []
    }

    private func attachFiles(_ result: Result<[URL], any Error>) {
        couldNotAttach = false
        guard case .success(let urls) = result else {
            couldNotAttach = true
            return
        }
        for url in urls {
            let isScoped = url.startAccessingSecurityScopedResource()
            defer { if isScoped { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else {
                couldNotAttach = true
                continue
            }
            thread.attachments.append(
                PickedAttachment(id: UUID(), name: url.lastPathComponent, data: data))
        }
    }
}
