/**
 * TipTap Extension Type Declarations
 * Simple Editor의 color-highlight 컴포넌트가 사용하는 선택적 확장 명령어 타입 선언
 */

import '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    /**
     * nodeBackground extension commands (선택적 - Simple Editor 컴포넌트 호환용)
     * 실제 extension이 설치되지 않았다면 런타임에서 extension availability 체크로 무시됨
     */
    nodeBackground: {
      /**
       * Toggle node background color
       */
      toggleNodeBackgroundColor: (color: string) => ReturnType
      /**
       * Unset node background color
       */
      unsetNodeBackgroundColor: () => ReturnType
    }
  }
}
