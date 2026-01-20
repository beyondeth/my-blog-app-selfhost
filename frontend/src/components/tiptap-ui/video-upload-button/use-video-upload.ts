"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { type Editor } from "@tiptap/react"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { isExtensionAvailable } from "@/lib/tiptap-utils"
import { useVideoUpload as useVideoUploadHook } from "@/hooks/video/useVideoUpload"
import { isValidVideoMimeType, isValidVideoFileSize, formatFileSize, DEFAULT_VIDEO_CONFIG } from "@/types/video"
import type { VideoStatus } from "@/editor/extensions/VideoEmbed.extension"
import { useVideoUploadStore } from "@/stores/videoUploadStore"

/**
 * Configuration for the video upload functionality
 */
export interface UseVideoUploadConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether the button should hide when insertion is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful video insertion.
   */
  onInserted?: () => void
  /**
   * Callback function called when an error occurs.
   */
  onError?: (error: string) => void
}

/**
 * Checks if video can be inserted in the current editor state
 */
export function canInsertVideo(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!isExtensionAvailable(editor, "videoEmbed")) return false
  return editor.can().insertContent({ type: "videoEmbed" })
}

/**
 * Checks if video is currently active
 */
export function isVideoActive(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  return editor.isActive("videoEmbed")
}

/**
 * Determines if the video button should be shown
 */
export function shouldShowVideoButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isExtensionAvailable(editor, "videoEmbed")) return false

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canInsertVideo(editor)
  }

  return true
}

/**
 * Custom hook that provides video upload functionality for Tiptap editor
 */
export function useVideoUploadButton(config?: UseVideoUploadConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onInserted,
    onError,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  // 임시 비디오 ID 저장 (업로드 완료 후 실제 ID로 교체용)
  const tempVideoIdRef = useRef<string | null>(null)

  const canInsert = canInsertVideo(editor)
  const isActive = isVideoActive(editor)
  const isVisible = shouldShowVideoButton({ editor: editor ?? null, hideWhenUnavailable })

  // 비디오 업로드 스토어 액션 (진행률 UI 표시용)
  const {
    startUpload: storeStartUpload,
    updateProgress: storeUpdateProgress,
    setProcessing: storeSetProcessing,
    completeUpload: storeCompleteUpload,
    setError: storeSetError,
    replaceVideoId: storeReplaceVideoId,
  } = useVideoUploadStore()

  // 비디오 업로드 훅
  const { state: uploadState, uploadVideo, reset: resetUpload } = useVideoUploadHook({
    onSuccess: (result) => {
      if (editor && result.success && tempVideoIdRef.current) {
        // 스토어: 실제 videoId로 교체 후 완료 처리
        storeReplaceVideoId(tempVideoIdRef.current, result.videoId)
        storeCompleteUpload(result.videoId)

        // 기존 임시 노드를 업데이트 (새 노드 삽입 X)
        const updated = editor.commands.updateVideoStatus(
          tempVideoIdRef.current,  // 임시 ID로 노드 찾기
          result.status as VideoStatus,
          result.url,
          result.videoId,  // 실제 서버 videoId로 교체
        )

        if (updated) {
          onInserted?.()
        }
      }
      tempVideoIdRef.current = null
      setIsUploading(false)
    },
    onError: (error) => {
      // 스토어: 에러 상태 설정
      if (tempVideoIdRef.current) {
        storeSetError(tempVideoIdRef.current, error)
      }

      // 에러 시 임시 노드를 failed 상태로 업데이트
      if (editor && tempVideoIdRef.current) {
        editor.commands.updateVideoStatus(
          tempVideoIdRef.current,
          'failed' as VideoStatus,
        )
      }
      tempVideoIdRef.current = null
      onError?.(error)
      setIsUploading(false)
    },
    onProgress: (progress) => {
      // 스토어: 진행률 업데이트 (VideoNode에서 구독하여 표시)
      if (tempVideoIdRef.current) {
        storeUpdateProgress(tempVideoIdRef.current, progress)
      }
    },
  })

  // 업로드 완료 후 서버 처리 단계 진입 시 스토어 상태 업데이트
  useEffect(() => {
    if (uploadState.stage === 'processing' && tempVideoIdRef.current) {
      storeSetProcessing(tempVideoIdRef.current)
    }
  }, [uploadState.stage, storeSetProcessing])

  // 파일 선택 다이얼로그 열기
  const openFileDialog = useCallback(() => {
    if (!editor || !canInsert || isUploading) return
    fileInputRef.current?.click()
  }, [editor, canInsert, isUploading])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 파일 검증
    if (!isValidVideoMimeType(file.type)) {
      onError?.(`지원하지 않는 비디오 형식입니다. (지원: MP4, WebM, MOV)`)
      return
    }

    if (!isValidVideoFileSize(file.size)) {
      onError?.(`파일 크기가 너무 큽니다. (최대: ${formatFileSize(DEFAULT_VIDEO_CONFIG.maxFileSize)})`)
      return
    }

    // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
    event.target.value = ''

    // 업로드 시작
    setIsUploading(true)
    resetUpload()

    // 먼저 uploading 상태의 비디오 노드 삽입
    if (editor) {
      // 임시 ID 생성 및 저장 (업로드 완료 후 실제 ID로 교체됨)
      const tempId = `temp-${Date.now()}`
      tempVideoIdRef.current = tempId

      // 스토어: 업로드 시작 (진행률 0%로 등록)
      storeStartUpload(tempId)

      editor.chain().focus().insertVideo({
        videoId: tempId,
        status: 'uploading',
      }).run()
    }

    // 업로드 실행
    await uploadVideo(file)
  }, [editor, onError, uploadVideo, resetUpload, storeStartUpload])

  return {
    isVisible,
    isActive,
    canInsert: canInsert && !isUploading,
    isUploading,
    uploadState,
    openFileDialog,
    handleFileSelect,
    fileInputRef,
    label: "비디오 추가",
  }
}
