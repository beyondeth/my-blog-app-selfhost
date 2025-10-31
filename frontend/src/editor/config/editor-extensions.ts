/**
 * TipTap Editor Extensions Configuration
 * 에디터 확장 기능 설정
 */

import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
// import Youtube from '@tiptap/extension-youtube'; // 기본 YouTube extension 대신 커스텀 사용
import { CustomYoutube } from '../extensions/CustomYoutube.extension';
import { BulletList, OrderedList, ListItem } from '@tiptap/extension-list';
import CodeBlock from '@tiptap/extension-code-block';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import { EDITOR_DOCUMENT_CONFIG, YOUTUBE_CONFIG } from '../constants/editor.constants';
import { ResizableImage } from '../extensions';
import { YoutubeAutoEmbed } from '../extensions/YoutubeAutoEmbed.extension';

// lowlight 인스턴스 생성 및 언어 등록
const lowlight = createLowlight(common);
lowlight.register({ javascript, typescript, js: javascript, ts: typescript });

/**
 * 기본 에디터 확장 기능 설정
 */
export const getEditorExtensions = (placeholder?: string) => [
  // 기본 스타터 킷
  StarterKit.configure({
    heading: false, // 커스텀 Heading 사용
    codeBlock: false, // CodeBlockLowlight 사용
    bulletList: false,
    orderedList: false,
    listItem: false,
  }),
  
  // 커스텀 이미지 확장
  ResizableImage.configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: {
      class: 'editor-image',
      style: 'max-width: 100%; height: auto; display: inline-block; margin: 4px 0; border-radius: 4px;',
      loading: 'lazy',
    },
  }),
  
  // YouTube 임베드 (커스텀 extension 사용)
  CustomYoutube.configure({
    inline: false,
    width: 685,
    height: 540,
    controls: true,
    allowFullscreen: true,
    addPasteHandler: true, // paste handler 활성화
    HTMLAttributes: {
      class: 'youtube-video',
    },
  }),
  
  // YouTube URL 자동 변환 (스페이스/엔터 키로 변환)
  // 주의: CustomYoutube의 paste handler와 충돌하지 않도록 설정
  YoutubeAutoEmbed,
  
  // 링크
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'editor-link',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  
  // 텍스트 스타일
  TextStyle,
  Color.configure({
    types: ['textStyle'],
  }),
  
  // 제목
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
    HTMLAttributes: {
      class: 'editor-heading',
    },
  }),
  
  // 하이라이트
  Highlight.configure({
    multicolor: true,
    HTMLAttributes: {
      class: 'editor-highlight',
    },
  }),
  
  // 텍스트 포맷팅
  Underline,
  Subscript,
  Superscript,
  
  // 플레이스홀더
  Placeholder.configure({
    placeholder: placeholder || EDITOR_DOCUMENT_CONFIG.PLACEHOLDER,
  }),
  
  // 텍스트 정렬
  TextAlign.configure({
    types: ['heading', 'paragraph', 'listItem'],
    alignments: ['left', 'center', 'right', 'justify'],
    defaultAlignment: null,
  }),
  
  // 코드 블록 하이라이팅
  CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: {
      class: 'hljs',
    },
  }),

  // 리스트
  ListItem,
  BulletList.configure({
    HTMLAttributes: {
      class: 'list-disc pl-5 space-y-1',
    },
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: 'list-decimal pl-5 space-y-1',
    },
  }),
];

/**
 * 읽기 전용 에디터 확장 기능 설정
 */
export const getReadOnlyExtensions = () => [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
  }),
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  Underline,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Link.configure({
    openOnClick: true,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  ResizableImage.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: {
      class: 'max-w-full h-auto rounded-lg',
    },
  }),
  CustomYoutube.configure({
    width: YOUTUBE_CONFIG.DEFAULT_WIDTH,
    height: YOUTUBE_CONFIG.DEFAULT_HEIGHT,
    HTMLAttributes: {
      class: 'youtube-video rounded-lg overflow-hidden',
    },
  }),
  ListItem,
  BulletList.configure({
    HTMLAttributes: {
      class: 'list-disc pl-5 space-y-1',
    },
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: 'list-decimal pl-5 space-y-1',
    },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    HTMLAttributes: {
      class: 'hljs bg-gray-100 rounded p-4 font-mono text-sm',
    },
  }),
];