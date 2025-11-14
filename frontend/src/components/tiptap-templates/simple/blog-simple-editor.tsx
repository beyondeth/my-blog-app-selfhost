"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { toast } from "sonner"

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

// --- Hooks ---
import { useUploadFile } from "@/hooks/useFiles"
import { normalizeImageUrl } from "@/utils/imageUtils"

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
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
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

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"


// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

// 에디터 스타일
import "@/editor/styles/editor.css"

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
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
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
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
        <ImageUploadButton text="Add" />
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
   * 선택된 썸네일 이미지 ID
   */
  thumbnailImageId?: string
  /**
   * 썸네일 변경 시 호출되는 콜백
   */
  onThumbnailChange?: (imageId: string) => void
}

export function BlogSimpleEditor({
  content: initialContent = '',
  onChange,
  placeholder = '내용을 입력하세요...',
  className = '',
  thumbnailImageId,
  onThumbnailChange,
}: BlogSimpleEditorProps = {}) {
  const isMobile = useIsMobile()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)

  // S3 파일 업로드 mutation
  const uploadMutation = useUploadFile()

  // S3 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (
    file: File,
    onProgress?: (event: { progress: number }) => void,
    abortSignal?: AbortSignal
  ): Promise<string> => {
    try {
      // 파일 크기 체크 (5MB) - 프론트엔드에서 사전 검증
      const MAX_FILE_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`이미지는 1개당 최대 ${MAX_FILE_SIZE / (1024 * 1024)}MB까지 업로드 가능합니다`)
      }

      // S3 업로드
      const result = await uploadMutation.mutateAsync({
        file,
        fileType: 'image' as const,
      })

      // URL 추출 및 정규화
      const imageUrl = (result as any).url || (result as any).accessUrl
      const finalUrl = normalizeImageUrl(imageUrl)

      // 이미지 업로드는 여러 개일 수 있으므로 개별 토스트는 표시하지 않음
      // ImageUploadManager에서 배치 토스트를 표시함

      return finalUrl
    } catch (error) {
      console.error('Image upload failed:', error)
      const errorMessage = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다'
      toast.error(errorMessage)
      throw error
    }
  }, [uploadMutation])

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

      Typography,
      Superscript,
      Subscript,
      Selection,

      // ImageUploadNode - 빠른 이미지 삽입용
      ImageUploadNode.configure({
        type: "mediumImage",  // MediumStyleImage extension과 매칭
        accept: "image/*",
        maxSize: 5 * 1024 * 1024,
        limit: 10,  // 최대 10개 이미지
        upload: handleImageUpload,
        onError: (error) => {
          // 개발 환경에서만 콘솔 에러 표시
          if (process.env.NODE_ENV === 'development') {
            console.error("Upload failed:", error)
          }
          // 에러 메시지는 이미 ImageUploadNode에서 표시했으므로 중복 표시 안 함
        },
      }),
    ],
    content: initialContent || '<p></p>',
  })

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  // 썸네일 선택 이벤트 리스너 (ResizableImageComponent에서 발생)
  useEffect(() => {
    const handleThumbnailSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ imageId: string }>
      const { imageId } = customEvent.detail

      // 에디터 storage 업데이트
      if (editor) {
        (editor.storage as any).thumbnailImageId = imageId
      }

      // 부모 컴포넌트에 알림
      onThumbnailChange?.(imageId)
    }

    window.addEventListener('thumbnail-selected', handleThumbnailSelected)

    return () => {
      window.removeEventListener('thumbnail-selected', handleThumbnailSelected)
    }
  }, [editor, onThumbnailChange])

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

  return (
    <EditorContext.Provider value={{ editor }}>
      <div className="simple-editor-wrapper">
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
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        {isMounted && (
          <EditorContent
            editor={editor}
            role="presentation"
            className="simple-editor-content"
          />
        )}
      </div>
    </EditorContext.Provider>
  )
}
