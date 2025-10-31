"use client"

import { useCallback, useState, useEffect } from "react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Utils ---
import { isExtensionAvailable } from "@/lib/tiptap-utils"

export const YOUTUBE_SHORTCUT_KEY = "mod+shift+y"

/**
 * Configuration for the YouTube button functionality
 */
export interface UseYoutubeConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether the button should hide when YouTube is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called after a successful insertion.
   */
  onInserted?: (url: string) => void
}

/**
 * YouTube URL validation regex
 */
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?)([\w-]+)(&\S+)?$/

/**
 * Checks if URL is a valid YouTube URL
 */
export function isValidYoutubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url)
}

/**
 * Checks if YouTube can be inserted in the current editor state
 */
export function canInsertYoutube(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false
  if (!isExtensionAvailable(editor, "youtube")) return false

  return editor.can().setYoutubeVideo({ src: "test" })
}

/**
 * Inserts YouTube video into the editor
 */
export function insertYoutube(editor: Editor | null, url: string): boolean {
  if (!editor || !editor.isEditable) return false
  if (!canInsertYoutube(editor)) return false

  if (!isValidYoutubeUrl(url)) {
    toast.error('올바른 YouTube URL을 입력해주세요')
    return false
  }

  try {
    const success = editor
      .chain()
      .focus()
      .setYoutubeVideo({ src: url })
      .run()

    if (success) {
      toast.success('YouTube 동영상이 추가되었습니다')
    } else {
      toast.error('YouTube 동영상 추가에 실패했습니다')
    }

    return success
  } catch (error) {
    console.error('YouTube insertion failed:', error)
    toast.error('YouTube 동영상 추가에 실패했습니다')
    return false
  }
}

/**
 * Determines if the YouTube button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  if (!editor || !editor.isEditable) return false
  if (!isExtensionAvailable(editor, "youtube")) return false

  if (hideWhenUnavailable) {
    return canInsertYoutube(editor)
  }

  return true
}

/**
 * Custom hook that provides YouTube insertion functionality for Tiptap editor
 */
export function useYoutube(config?: UseYoutubeConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onInserted,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const canInsert = canInsertYoutube(editor)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable }))
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  const handleInsert = useCallback(() => {
    if (!editor) return false

    const url = prompt('YouTube URL을 입력하세요:')
    if (!url) return false

    const success = insertYoutube(editor, url)
    if (success) {
      onInserted?.(url)
    }
    return success
  }, [editor, onInserted])

  return {
    isVisible,
    handleInsert,
    canInsert,
    label: "YouTube",
    shortcutKeys: YOUTUBE_SHORTCUT_KEY,
  }
}
