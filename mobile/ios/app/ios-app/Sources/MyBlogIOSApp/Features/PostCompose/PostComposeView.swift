import PhotosUI
import UIKit
import SwiftUI

struct PostComposeView: View {
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.colorScheme) private var colorScheme
    let onSubmitSuccess: (() -> Void)?

    @State private var bodyText = ""
    @State private var category = "general"
    @State private var isPublished = true
    @State private var isSubmitting = false
    @State private var isUploadingImages = false
    @State private var errorMessage: String?
    @State private var createdPostId: String?
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @State private var attachedImages: [ComposeUploadedImage] = []
    @State private var selectedThumbnailFileId: String?
    private let maxAttachments = 10
    @State private var shouldCleanupUploadsOnDisappear = true

    init(onSubmitSuccess: (() -> Void)? = nil) {
        self.onSubmitSuccess = onSubmitSuccess
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    composeCard
                    visibilityCard
                    actionSection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
            .background(backgroundColor)
            .navigationBarHidden(true)
            .onChange(of: selectedPhotoItems) { _, newItems in
                guard !newItems.isEmpty else { return }
                Task { await uploadPickedImages(newItems) }
            }
            .onDisappear {
                cleanupTemporaryUploadsIfNeeded()
            }
        }
    }

    private var header: some View {
        HStack {
            Text("새 글 작성")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(primaryText)
            Spacer()
            Button {
                Task { await submit() }
            } label: {
                if isSubmitting {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.black)
                        .frame(width: 74, height: 34)
                } else {
                    Text("게시")
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 74, height: 34)
                }
            }
            .buttonStyle(.plain)
            .background(Capsule().fill(formInvalid || isUploadingImages ? Color.gray.opacity(0.35) : selectedChipFill))
            .foregroundStyle(formInvalid ? primaryText.opacity(0.7) : selectedChipText)
            .disabled(isSubmitting || isUploadingImages || formInvalid)
        }
    }

    private var composeCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            composeLabel("본문")
            ZStack(alignment: .topLeading) {
                if bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("새로운 소식이 있나요?")
                        .font(.body)
                        .foregroundStyle(.gray)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 18)
                }

                TextEditor(text: $bodyText)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 260)
                    .padding(10)
                    .foregroundStyle(primaryText)
            }
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(surfaceBackground)
            )

            HStack {
                PhotosPicker(
                    selection: $selectedPhotoItems,
                    maxSelectionCount: maxAttachments - attachedImages.count,
                    matching: .images
                ) {
                    Label("이미지 추가", systemImage: "photo.on.rectangle.angled")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(primaryText)
                }
                .disabled(isUploadingImages || attachedImages.count >= maxAttachments)

                Spacer()

                if isUploadingImages {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("업로드 중")
                            .font(.caption)
                            .foregroundStyle(.gray)
                    }
                } else {
                    Text("\(attachedImages.count)/\(maxAttachments)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.gray)
                }
            }

            if !attachedImages.isEmpty {
                attachmentSection
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(cardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(cardStroke, lineWidth: 1)
        )
    }

    private var visibilityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            composeLabel("카테고리")
            TextField("예: general", text: $category)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(primaryText)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(surfaceBackground)
                )

            Toggle(isOn: $isPublished) {
                Text("즉시 발행")
                    .foregroundStyle(primaryText)
                    .font(.subheadline.weight(.semibold))
            }
            .toggleStyle(.switch)
            .tint(colorScheme == .dark ? .white : .blue)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(cardBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(cardStroke, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var actionSection: some View {
        if let errorMessage {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red.opacity(0.95))
                .frame(maxWidth: .infinity, alignment: .leading)
        }

        if let createdPostId {
            VStack(alignment: .leading, spacing: 8) {
                Text("작성 완료: \(createdPostId)")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.green)

                Button("홈 피드로 이동") {
                    onSubmitSuccess?()
                }
                .buttonStyle(.plain)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(selectedChipText)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(selectedChipFill)
                )
            }
            .padding(.top, 2)
        }
    }

    private var attachmentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("첨부 이미지")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.gray)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(attachedImages) { image in
                        ZStack(alignment: .topTrailing) {
                            VStack(spacing: 6) {
                                Image(uiImage: image.previewImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 88, height: 88)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(
                                                selectedThumbnailFileId == image.fileId
                                                    ? selectedChipFill
                                                    : cardStroke,
                                                lineWidth: selectedThumbnailFileId == image.fileId ? 2 : 1
                                            )
                                    )
                                    .onTapGesture {
                                        selectedThumbnailFileId = image.fileId
                                    }

                                Text(selectedThumbnailFileId == image.fileId ? "썸네일" : "탭해서 썸네일")
                                    .font(.caption2)
                                    .foregroundStyle(selectedThumbnailFileId == image.fileId ? .green : .gray)
                            }

                            Button {
                                removeAttachment(image)
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.callout)
                                    .foregroundStyle(.white, .black.opacity(0.72))
                            }
                            .offset(x: 6, y: -6)
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func composeLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.gray)
    }

    private var formInvalid: Bool {
        bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? .black : Color(.systemGroupedBackground)
    }

    private var cardBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.05) : Color.black.opacity(0.03)
    }

    private var surfaceBackground: Color {
        colorScheme == .dark ? Color.white.opacity(0.07) : Color.black.opacity(0.05)
    }

    private var cardStroke: Color {
        colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }

    private var primaryText: Color {
        colorScheme == .dark ? .white : .primary
    }

    private var selectedChipFill: Color {
        colorScheme == .dark ? .white : .black
    }

    private var selectedChipText: Color {
        colorScheme == .dark ? .black : .white
    }

    private func submit() async {
        guard let repository = appStore.makeFeedRepository() else {
            errorMessage = "로그인 또는 세션을 확인해주세요."
            return
        }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            let trimmedBody = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
            let firstLine = trimmedBody.split(separator: "\n").first.map(String.init) ?? "새 글"
            let derivedTitle = String(firstLine.prefix(70)).trimmingCharacters(in: .whitespacesAndNewlines)
            let post = try await repository.createPost(
                title: derivedTitle.isEmpty ? "새 글" : derivedTitle,
                content: trimmedBody,
                category: category.trimmingCharacters(in: .whitespacesAndNewlines),
                isPublished: isPublished,
                contentMarkdown: trimmedBody.isEmpty ? nil : trimmedBody,
                attachedFileIds: attachedImages.map(\.fileId),
                thumbnailImageId: selectedThumbnailFileId
            )
            shouldCleanupUploadsOnDisappear = false
            createdPostId = post.id
            clearDraft()
            onSubmitSuccess?()
        } catch {
            errorMessage = readableMessage(for: error, phase: .publish)
        }
    }

    private func clearDraft() {
        bodyText = ""
        category = "general"
        isPublished = true
        selectedPhotoItems = []
        attachedImages = []
        selectedThumbnailFileId = nil
    }

    @MainActor
    private func uploadPickedImages(_ items: [PhotosPickerItem]) async {
        guard let repository = appStore.makeFeedRepository() else {
            errorMessage = "로그인 또는 세션을 확인해주세요."
            selectedPhotoItems = []
            return
        }

        let remainingSlots = max(0, maxAttachments - attachedImages.count)
        guard remainingSlots > 0 else {
            errorMessage = "이미지는 최대 \(maxAttachments)개까지 첨부할 수 있습니다."
            selectedPhotoItems = []
            return
        }

        let targets = Array(items.prefix(remainingSlots))
        isUploadingImages = true
        defer {
            isUploadingImages = false
            selectedPhotoItems = []
        }

        for item in targets {
            do {
                guard let rawData = try await item.loadTransferable(type: Data.self),
                      let prepared = prepareImageForUpload(rawData)
                else {
                    continue
                }

                let fileName = "ios-post-\(UUID().uuidString).jpg"
                let uploaded = try await repository.uploadPostImage(
                    fileData: prepared.uploadData,
                    fileName: fileName,
                    mimeType: "image/jpeg",
                )

                attachedImages.append(
                    ComposeUploadedImage(
                        fileId: uploaded.id,
                        previewImage: prepared.previewImage
                    )
                )

                if selectedThumbnailFileId == nil {
                    selectedThumbnailFileId = uploaded.id
                }
            } catch {
                errorMessage = readableMessage(for: error, phase: .upload)
            }
        }
    }

    private func removeAttachment(_ attachment: ComposeUploadedImage) {
        Task {
            if let repository = appStore.makeFeedRepository() {
                try? await repository.deleteUploadedFile(fileId: attachment.fileId)
            }
            await MainActor.run {
                attachedImages.removeAll { $0.id == attachment.id }
                if selectedThumbnailFileId == attachment.fileId {
                    selectedThumbnailFileId = attachedImages.first?.fileId
                }
            }
        }
    }

    private func cleanupTemporaryUploadsIfNeeded() {
        guard shouldCleanupUploadsOnDisappear else { return }
        let fileIds = attachedImages.map(\.fileId)
        guard !fileIds.isEmpty else { return }

        Task {
            guard let repository = appStore.makeFeedRepository() else { return }
            await withTaskGroup(of: Void.self) { group in
                for fileId in fileIds {
                    group.addTask {
                        try? await repository.deleteUploadedFile(fileId: fileId)
                    }
                }
            }
        }
    }

    private func prepareImageForUpload(_ rawData: Data) -> PreparedUploadImage? {
        guard let original = UIImage(data: rawData) else { return nil }
        let resized = resizeIfNeeded(original, maxDimension: 2048)
        guard let uploadData = compressJPEG(resized, maxBytes: 9_500_000) else { return nil }
        return PreparedUploadImage(previewImage: resized, uploadData: uploadData)
    }

    private func resizeIfNeeded(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let longest = max(size.width, size.height)
        guard longest > maxDimension else { return image }

        let scale = maxDimension / longest
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    private func compressJPEG(_ image: UIImage, maxBytes: Int) -> Data? {
        var quality: CGFloat = 0.86
        while quality >= 0.45 {
            if let data = image.jpegData(compressionQuality: quality), data.count <= maxBytes {
                return data
            }
            quality -= 0.08
        }
        return image.jpegData(compressionQuality: 0.4)
    }

    private func readableMessage(for error: Error, phase: ComposeErrorPhase) -> String {
        if let apiError = error as? APIError {
            if apiError.type == .unauthorized || apiError.status == 401 {
                return "세션이 만료되었습니다. 다시 로그인해 주세요."
            }
            if apiError.status == 413 || apiError.code.contains("FILE_SIZE") {
                return "이미지 용량이 너무 큽니다. 더 작은 이미지를 선택해 주세요."
            }
            if apiError.type == .network {
                return "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요."
            }
            let normalized = apiError.message.trimmingCharacters(in: .whitespacesAndNewlines)
            if !normalized.isEmpty {
                return normalized
            }
        }

        switch phase {
        case .upload:
            return "이미지 업로드에 실패했습니다."
        case .publish:
            return "게시글 저장에 실패했습니다."
        }
    }
}

private struct ComposeUploadedImage: Identifiable {
    let id = UUID()
    let fileId: String
    let previewImage: UIImage
}

private struct PreparedUploadImage {
    let previewImage: UIImage
    let uploadData: Data
}

private enum ComposeErrorPhase {
    case upload
    case publish
}
