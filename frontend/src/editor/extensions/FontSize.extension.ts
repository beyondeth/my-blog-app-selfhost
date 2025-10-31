import { Extension } from '@tiptap/core';

// TipTap 커맨드 타입 확장
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * 선택된 텍스트에 font-size 적용
       */
      setFontSize: (fontSize: string) => ReturnType;
      /**
       * 선택된 텍스트의 font-size 제거
       */
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * FontSize Extension
 *
 * TipTap의 TextStyle에 fontSize 속성을 추가하는 커스텀 확장
 * - 인라인 스타일로 font-size를 적용 (예: <span style="font-size: 17px">텍스트</span>)
 * - setFontSize() 커맨드를 제공하여 선택된 텍스트에 글자 크기 적용
 *
 * 사용법:
 * editor.chain().focus().setFontSize('17px').run();
 * editor.chain().focus().unsetFontSize().run();
 */
export const FontSize = Extension.create({
  name: 'fontSize',

  // TextStyle 마크에 fontSize 속성 추가
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'], // textStyle 마크에 속성 추가
        attributes: {
          fontSize: {
            default: null,
            // HTML에서 파싱: style="font-size: 17px" 읽어오기
            parseHTML: (element) => element.style.fontSize || null,
            // HTML로 렌더링: fontSize 값이 있으면 인라인 스타일로 출력
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  // 에디터 커맨드 추가
  addCommands() {
    return {
      /**
       * 선택된 텍스트에 font-size 적용
       * @param fontSize - CSS font-size 값 (예: '17px', '20px', '1.5rem')
       */
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },

      /**
       * 선택된 텍스트의 font-size 제거
       */
      unsetFontSize:
        () =>
        ({ chain }: any) => {
          return chain().setMark('textStyle', { fontSize: null }).run();
        },
    };
  },
});
