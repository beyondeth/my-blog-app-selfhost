"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { Selection } from "@tiptap/extensions"

// --- 커스텀 Extensions ---
import { MediumStyleImage } from "@/editor/extensions/MediumStyleImage.extension"
import { CustomYoutube } from "@/editor/extensions/CustomYoutube.extension"
import { YoutubeAutoEmbed } from "@/editor/extensions/YoutubeAutoEmbed.extension"
import { VideoEmbed } from "@/editor/extensions/VideoEmbed.extension"

// --- Hooks ---
import { useUploadFile } from "@/hooks/useFiles"
import { IMAGE_UPLOAD_POLICY, normalizeImageUrl } from "@/utils/imageUtils"
import type { ImageUploadProgress } from "@/utils/imageUpload"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { VideoUploadButton } from "@/components/tiptap-ui/video-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import { HorizontalRuleButton } from "@/components/tiptap-ui/horizontal-rule-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { Github } from "lucide-react"

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"
import GithubResourcePopover from "@/components/posts/GithubResourcePopover"


// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

// 에디터 스타일
import "@/editor/styles/editor.css"

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  githubUrl,
  githubDescription,
  onGithubUrlChange,
  onGithubDescriptionChange,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  githubUrl: string
  githubDescription: string
  onGithubUrlChange: (value: string) => void
  onGithubDescriptionChange: (value: string) => void
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList"]}
          portal={isMobile}
        />
        <BlockquoteButton />
        <CodeBlockButton />
        <HorizontalRuleButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Image" />
        <VideoUploadButton text="Video" />
        <GithubResourcePopover
          githubUrl={githubUrl}
          githubDescription={githubDescription}
          onGithubUrlChange={onGithubUrlChange}
          onGithubDescriptionChange={onGithubDescriptionChange}
        >
          <Button
            type="button"
            tooltip="GitHub resource"
            aria-label="GitHub resource"
            data-active-state={githubUrl.trim() ? "on" : "off"}
          >
            <Github className="tiptap-button-icon" />
          </Button>
        </GithubResourcePopover>
      </ToolbarGroup>

      <Spacer />

      </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
)

/**
 * BlogSimpleEditor Props
 */
export interface BlogSimpleEditorProps {
  /**
   * 에디터 초기 content (HTML)
   * @default ''
   */
  content?: string
  /**
   * Content 변경 시 호출되는 콜백
   */
  onChange?: (content: string) => void
  /**
   * placeholder 텍스트
   * @default '내용을 입력하세요...'
   */
  placeholder?: string
  /**
   * 추가 CSS 클래스
   */
  className?: string
  /**
   * 선택된 썸네일 이미지 ID (for edit mode)
   */
  thumbnailImageId?: string
  /**
   * 썸네일 변경 시 호출되는 콜백 (for edit mode)
   */
  onThumbnailChange?: (imageId: string) => void
  /**
   * 초기 썸네일 인덱스 (for new post mode)
   */
  initialThumbnailIndex?: number
  /**
   * 썸네일 인덱스 변경 시 호출되는 콜백 (for new post mode)
   */
  onThumbnailIndexChange?: (index: number) => void
  /**
   * 파일 ID 목록 변경 시 호출되는 콜백
   */
  onFileIdsChange?: (fileIds: string[]) => void
  /**
   * 이미지 업로드가 진행 중인지 부모 폼에 알립니다.
   */
  onUploadStateChange?: (state: {
    isUploading: boolean
    pendingCount: number
    progress: number
    stage?: ImageUploadProgress["stage"]
  }) => void
  githubUrl?: string
  githubDescription?: string
  onGithubUrlChange?: (value: string) => void
  onGithubDescriptionChange?: (value: string) => void
}

export const BlogSimpleEditor = React.memo(function BlogSimpleEditor({
  content: initialContent = '',
  onChange,
  placeholder = 'Write your content...',
  className = '',
  thumbnailImageId,
  onThumbnailChange,
  initialThumbnailIndex,
  onThumbnailIndexChange,
  onFileIdsChange,
  onUploadStateChange,
  githubUrl = "",
  githubDescription = "",
  onGithubUrlChange = () => undefined,
  onGithubDescriptionChange = () => undefined,
}: BlogSimpleEditorProps = {}) {
  const isMobile = useIsMobile()
  const { height } = useWindowSize()

  // 디버깅: 썸네일 관련 prop 확인 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 [THUMBNAIL_TRACK] BlogSimpleEditor mounted with props:', {
      hasOnThumbnailChange: !!onThumbnailChange,
      onThumbnailChangeType: typeof onThumbnailChange,
      hasOnThumbnailIndexChange: !!onThumbnailIndexChange,
      thumbnailImageId: thumbnailImageId,
      initialThumbnailIndex: initialThumbnailIndex
    });
  }

  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)

  // 이미지 목록 추적 상태 (new post mode용)
  const uploadedImagesRef = useRef<Array<{id: string, url: string, uploadOrder: number}>>([]);
  const nextUploadOrderRef = useRef(0);
  const thumbnailIndexRef = useRef(initialThumbnailIndex || -1);
  const pendingUploadCountRef = useRef(0);
  const uploadProgressRef = useRef(new Map<File, ImageUploadProgress>());
  const onFileIdsChangeRef = useRef(onFileIdsChange);
  const onUploadStateChangeRef = useRef(onUploadStateChange);
  onFileIdsChangeRef.current = onFileIdsChange;
  onUploadStateChangeRef.current = onUploadStateChange;

  const emitUploadState = useCallback(() => {
    const progressEntries = Array.from(uploadProgressRef.current.values());
    const progress = progressEntries.length
      ? Math.round(
          progressEntries.reduce((sum, entry) => sum + entry.progress, 0) /
            progressEntries.length
        )
      : 0;
    const activeEntry = progressEntries.find((entry) => entry.progress < 100);

    onUploadStateChangeRef.current?.({
      isUploading: pendingUploadCountRef.current > 0,
      pendingCount: pendingUploadCountRef.current,
      progress,
      stage: activeEntry?.stage,
    });
  }, []);

  const updatePendingUploadCount = useCallback((change: number) => {
    pendingUploadCountRef.current = Math.max(0, pendingUploadCountRef.current + change);
    emitUploadState();
  }, [emitUploadState]);

  useEffect(() => () => {
    onUploadStateChangeRef.current?.({
      isUploading: false,
      pendingCount: 0,
      progress: 0,
    });
  }, []);

  // S3 파일 업로드 mutation
  const uploadMutation = useUploadFile()
  // S3 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (
    file: File,
    onProgress?: (event: ImageUploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<{ url: string; fileId: string }> => {
    const uploadOrder = nextUploadOrderRef.current;
    nextUploadOrderRef.current += 1;
    uploadProgressRef.current.set(file, { progress: 0, stage: "validating" });
    updatePendingUploadCount(1)
    try {
      // S3 업로드
      const result = await uploadMutation.mutateAsync({
        file,
        fileType: 'image' as const,
        signal: abortSignal,
        onProgress: (event) => {
          uploadProgressRef.current.set(file, event);
          onProgress?.(event);
          emitUploadState();
        },
      })

      // FileUpload 객체에서 정보 추출
      const fileId = result.id
      const imageUrl = result.accessUrl || result.fileUrl
      const finalUrl = normalizeImageUrl(imageUrl)

      console.log('[BlogSimpleEditor] Upload completed:', {
        fileId,
        imageUrl,
        finalUrl,
        hasFileId: !!fileId
      });

      // 이미지 목록에 추가 (new post mode)
      if (fileId) {
        const nextImages = [
          ...uploadedImagesRef.current.filter((image) => image.id !== fileId),
          { id: fileId, url: finalUrl, uploadOrder },
        ].sort((a, b) => a.uploadOrder - b.uploadOrder);
        uploadedImagesRef.current = nextImages;
        onFileIdsChangeRef.current?.(nextImages.map((image) => image.id));
      } else {
        throw new Error('Failed to get file ID from upload result');
      }

      // 이미지 업로드는 여러 개일 수 있으므로 개별 토스트는 표시하지 않음
      // ImageUploadManager에서 배치 토스트를 표시함

      return { url: finalUrl, fileId }
    } catch (error) {
      console.error('Image upload failed:', error)
      throw error
    } finally {
      uploadProgressRef.current.delete(file);
      updatePendingUploadCount(-1)
    }
  }, [emitUploadState, updatePendingUploadCount, uploadMutation])

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: `simple-editor ${className}`,
      },
    },
    onUpdate: ({ editor }) => {
      // Content 변경 시 onChange 콜백 호출
      const html = editor.getHTML()

      onChange?.(html)
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
      }),
      HorizontalRule,
      TextAlign.configure({
        types: ["heading", "paragraph", "listItem"],
        alignments: ["left", "center", "right", "justify"],
      }),

      // 텍스트 스타일 및 색상
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),

      // 이미지 - MediumStyleImage 사용
      MediumStyleImage,

      // YouTube 임베드
      CustomYoutube.configure({
        inline: false,
        width: 685,
        height: 540,
        controls: true,
        allowFullscreen: true,
        addPasteHandler: true,
        HTMLAttributes: {
          class: 'youtube-video',
        },
      }),
      YoutubeAutoEmbed, // URL 자동 변환

      // 비디오 업로드 (R2 + FFmpeg 압축)
      VideoEmbed,

      Typography,
      Superscript,
      Subscript,
      Selection,

      // ImageUploadNode - 빠른 이미지 삽입용
      ImageUploadNode.configure({
        type: "mediumImage",  // MediumStyleImage extension과 매칭
        accept: "image/*",
        maxSize: IMAGE_UPLOAD_POLICY.maxInputSizeBytes,
        limit: 10,  // 최대 10개 이미지
        upload: handleImageUpload,
        onError: (error) => {
          // 개발 환경에서만 콘솔 에러 표시
          if (process.env.NODE_ENV === 'development') {
            console.error("Upload failed:", error)
          }
          // 에러 메시지는 이미 표시했으므로 중복 표시 안 함
        },
      }),
    ],
    content: initialContent || '<p></p>',
  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  // 썸네일 선택 이벤트 리스너 (MediumImageNode에서 발생)
  useEffect(() => {
    console.log('🎯 [THUMBNAIL_TRACK] Setting up thumbnail event listener');

    const handleThumbnailSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ imageId: string }>
      const { imageId } = customEvent.detail

      // 디버깅: 썸네일 선택 이벤트 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 [THUMBNAIL_TRACK] User clicked thumbnail button:', {
          imageId,
          hasOnThumbnailChange: !!onThumbnailChange,
          hasOnThumbnailIndexChange: !!onThumbnailIndexChange
        });
      }

      // 에디터 storage 업데이트
      if (editor) {
        (editor.storage as any).thumbnailImageId = imageId
      }

      // Edit 모드: imageId를 직접 전달
      if (onThumbnailChange) {
        try {
          onThumbnailChange(imageId);
        } catch (error) {
          console.error('Error calling onThumbnailChange:', error);
        }
      }

      // New Post 모드: imageId를 index로 변환하여 전달
      if (onThumbnailIndexChange) {
        // 🐛 BUG FIX: ref를 통해 항상 최신 uploadedImages 상태에 접근
        const currentUploadedImages = uploadedImagesRef.current;
        const imageIndex = currentUploadedImages.findIndex(img => img.id === imageId);

        // 디버깅: 인덱스 찾기 과정 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 [THUMBNAIL_TRACK] Converting imageId to index:', {
            selectedImageId: imageId,
            totalImages: currentUploadedImages.length,
            foundIndex: imageIndex,
            availableIds: currentUploadedImages.map(img => img.id)
          });
        }

        if (imageIndex !== -1) {
          thumbnailIndexRef.current = imageIndex;
          console.log('✅ [THUMBNAIL_TRACK] Selected thumbnail at index:', imageIndex, 'imageId:', imageId);
          onThumbnailIndexChange(imageIndex);
        } else {
          // 찾지 못하면 미선택 상태로 설정 (사용자가 다시 선택하도록 유도)
          thumbnailIndexRef.current = -1;
          onThumbnailIndexChange(-1);

          // 개발 환경에서만 경고 표시
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [THUMBNAIL_TRACK] Image ID not found in uploaded images:', imageId);
            console.warn('⚠️ [THUMBNAIL_TRACK] Available image IDs:', currentUploadedImages.map(img => img.id));
          }
        }
      }
    }

    window.addEventListener('thumbnail-selected', handleThumbnailSelected)

    return () => {
      console.log('🎯 [THUMBNAIL_TRACK] Cleaning up thumbnail event listener');
      window.removeEventListener('thumbnail-selected', handleThumbnailSelected)
    }
  }, [editor, onThumbnailChange, onThumbnailIndexChange])

  // 에디터 storage 초기화 (부모로부터 받은 thumbnailImageId)
  useEffect(() => {
    if (editor && thumbnailImageId !== undefined) {
      (editor.storage as any).thumbnailImageId = thumbnailImageId
    }
  }, [editor, thumbnailImageId])

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!editor) {
    return null
  }

  const toolbarElement = (
    <Toolbar
      ref={toolbarRef}
      style={{
        ...(isMobile
          ? {
              bottom: `calc(100% - ${height - rect.y}px)`,
            }
          : {}),
      }}
    >
      {mobileView === "main" ? (
        <MainToolbarContent
          onHighlighterClick={() => setMobileView("highlighter")}
          onLinkClick={() => setMobileView("link")}
          isMobile={isMobile}
          githubUrl={githubUrl}
          githubDescription={githubDescription}
          onGithubUrlChange={onGithubUrlChange}
          onGithubDescriptionChange={onGithubDescriptionChange}
        />
      ) : (
        <MobileToolbarContent
          type={mobileView === "highlighter" ? "highlighter" : "link"}
          onBack={() => setMobileView("main")}
        />
      )}
    </Toolbar>
  )

  const editorContentElement = isMounted ? (
    <EditorContent
      editor={editor}
      role="presentation"
      className="simple-editor-content"
    />
  ) : null

  return (
    <EditorContext.Provider value={{ editor }}>
      <div className="simple-editor-wrapper">
        {toolbarElement}
        {editorContentElement}
      </div>
    </EditorContext.Provider>
  )
})
