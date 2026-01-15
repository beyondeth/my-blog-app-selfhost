"use client"

import { forwardRef, useCallback, useState } from "react"
import { Video } from "lucide-react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseVideoUploadConfig } from "./use-video-upload"
import { useVideoUploadButton } from "./use-video-upload"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Alert Dialog ---
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

type IconProps = React.SVGProps<SVGSVGElement>
type IconComponent = ({ className, ...props }: IconProps) => React.ReactElement

export interface VideoUploadButtonProps
  extends Omit<ButtonProps, "type" | "onError">,
    UseVideoUploadConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Optional custom icon component to render instead of the default.
   */
  icon?: React.MemoExoticComponent<IconComponent> | React.FC<IconProps>
}

/**
 * Button component for uploading videos in a Tiptap editor.
 *
 * 비디오 업로드 버튼 컴포넌트
 * - 클릭 시 파일 선택 다이얼로그 오픈
 * - 선택된 비디오 파일을 R2에 업로드
 * - 서버에서 FFmpeg 압축 처리
 * - 처리 완료 시 에디터에 비디오 노드 삽입
 */
export const VideoUploadButton = forwardRef<
  HTMLButtonElement,
  VideoUploadButtonProps
>(
  (
    {
      editor: providedEditor,
      text,
      hideWhenUnavailable = false,
      onInserted,
      onError,
      onClick,
      icon: CustomIcon,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    // 에러 모달 상태
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const {
      isVisible,
      canInsert,
      openFileDialog,
      handleFileSelect,
      fileInputRef,
      label,
      isActive,
    } = useVideoUploadButton({
      editor,
      hideWhenUnavailable,
      onInserted,
      // 에러 발생 시 모달로 표시
      onError: (error) => {
        setErrorMessage(error)
        onError?.(error)
      },
    })

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        openFileDialog()
      },
      [openFileDialog, onClick]
    )

    if (!isVisible) {
      return null
    }

    // 아이콘 렌더링 - 버튼은 항상 정상 상태 유지 (로딩 상태는 노드 자체가 표시)
    const renderIcon = () => {
      if (CustomIcon) {
        return <CustomIcon className="tiptap-button-icon" />
      }
      return <Video className="tiptap-button-icon" size={18} />
    }

    return (
      <>
        {/* 숨겨진 파일 입력 - 다양한 비디오 형식 지원 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/mpeg,video/3gpp,video/x-ms-wmv,video/ogg,video/x-flv,.mp4,.webm,.mov,.avi,.mkv,.mpeg,.mpg,.3gp,.wmv,.ogv,.flv"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        <Button
          type="button"
          data-style="ghost"
          data-active-state={isActive ? "on" : "off"}
          role="button"
          tabIndex={-1}
          disabled={!canInsert}
          data-disabled={!canInsert}
          aria-label={label}
          aria-pressed={isActive}
          tooltip={label}
          onClick={handleClick}
          {...buttonProps}
          ref={ref}
        >
          {children ?? (
            <>
              {renderIcon()}
              {text && <span className="tiptap-button-text">{text}</span>}
            </>
          )}
        </Button>

        {/* 에러 모달 - 파일 크기 초과, 지원하지 않는 형식 등 */}
        <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>업로드 실패</AlertDialogTitle>
              <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setErrorMessage(null)}>
                확인
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }
)

VideoUploadButton.displayName = "VideoUploadButton"
