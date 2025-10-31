"use client"

import { forwardRef, useCallback } from "react"

// --- Tiptap UI ---
import type { UseYoutubeConfig } from "@/components/tiptap-ui/youtube-button"
import {
  YOUTUBE_SHORTCUT_KEY,
  useYoutube,
} from "@/components/tiptap-ui/youtube-button"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"

// --- Icons ---
import { YoutubeIcon } from "@/components/tiptap-icons/youtube-icon"

export interface YoutubeButtonProps
  extends Omit<ButtonProps, "type">,
    UseYoutubeConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string
  /**
   * Optional show shortcut keys in the button.
   * @default false
   */
  showShortcut?: boolean
}

export function YoutubeShortcutBadge({
  shortcutKeys = YOUTUBE_SHORTCUT_KEY,
}: {
  shortcutKeys?: string
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for inserting YouTube videos in a Tiptap editor.
 *
 * For custom button implementations, use the `useYoutube` hook instead.
 */
export const YoutubeButton = forwardRef<HTMLButtonElement, YoutubeButtonProps>(
  (
    {
      editor: providedEditor,
      text,
      hideWhenUnavailable = false,
      onInserted,
      showShortcut = false,
      onClick,
      children,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const {
      isVisible,
      canInsert,
      handleInsert,
      label,
      shortcutKeys,
    } = useYoutube({
      editor,
      hideWhenUnavailable,
      onInserted,
    })

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        handleInsert()
      },
      [handleInsert, onClick]
    )

    if (!isVisible) {
      return null
    }

    return (
      <Button
        type="button"
        data-style="ghost"
        role="button"
        tabIndex={-1}
        disabled={!canInsert}
        data-disabled={!canInsert}
        aria-label={label}
        tooltip="YouTube"
        onClick={handleClick}
        {...buttonProps}
        ref={ref}
      >
        {children ?? (
          <>
            <YoutubeIcon className="tiptap-button-icon" />
            {text && <span className="tiptap-button-text">{text}</span>}
            {showShortcut && (
              <YoutubeShortcutBadge shortcutKeys={shortcutKeys} />
            )}
          </>
        )}
      </Button>
    )
  }
)

YoutubeButton.displayName = "YoutubeButton"
