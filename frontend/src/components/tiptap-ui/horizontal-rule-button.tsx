"use client"

import { forwardRef, useCallback } from "react"
import type { Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { DividerIcon } from "@/components/tiptap-icons/divider-icon"

export interface HorizontalRuleButtonProps
  extends Omit<ButtonProps, "type"> {
  label?: string
  editor?: Editor | null
}

export const HorizontalRuleButton = forwardRef<
  HTMLButtonElement,
  HorizontalRuleButtonProps
>(({ editor: providedEditor, label = "구분선", onClick, children, ...buttonProps }, ref) => {
  const { editor } = useTiptapEditor(providedEditor)

  const canInsert =
    editor?.can().chain().focus().setHorizontalRule().run() ?? false

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented) return
      editor?.chain().focus().setHorizontalRule().run()
    },
    [editor, onClick]
  )

  if (!editor) {
    return null
  }

  return (
    <Button
      type="button"
      data-style="ghost"
      disabled={!canInsert}
      aria-label={label}
      tooltip={label}
      onClick={handleClick}
      {...buttonProps}
      ref={ref}
    >
      {children ?? (
        <>
          <DividerIcon className="tiptap-button-icon" />
        </>
      )}
    </Button>
  )
})

HorizontalRuleButton.displayName = "HorizontalRuleButton"
